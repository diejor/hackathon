using SpacetimeDB;

// Lobby: create a room (get a short code / QR), others join by code, everyone readies up,
// the host picks a game and starts. Games plug in later with their own tables keyed by RoomId.
//
// Privacy model (this is a security hackathon, so it matters):
//  - Room / RoomMember / JoinAttempt tables are PRIVATE. Clients can't list rooms or codes.
//  - Clients only see their own room and its members through per-user views (MyRoom, MyRoomMembers).
//  - Joining needs the code; failed join attempts are rate-limited per identity (anti brute-force).
//  - All authorization uses ctx.Sender; no identity is ever taken from arguments.
public static partial class Module
{
    const int MaxMembers = 8;
    const int MinPlayersToStart = 2;
    const int CodeLength = 4;
    // No 0/O, 1/I/L: easy to read off a phone screen and type on a keypad.
    const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const int MaxFailedJoins = 8;
    const long FailedJoinWindowMicros = 60_000_000; // 60 s

    [SpacetimeDB.Type]
    public enum RoomState { Lobby, Playing }

    [SpacetimeDB.Table(Accessor = "Room")]
    public partial struct Room
    {
        [PrimaryKey, AutoInc] public ulong Id;
        [Unique] public string Code;
        public Identity Host;
        public RoomState State;
        public string Game;         // selected game id ("" = none yet)
        public Timestamp CreatedAt;
    }

    [SpacetimeDB.Table(Accessor = "RoomMember")]
    public partial struct RoomMember
    {
        [PrimaryKey] public Identity Identity;   // a player is in at most one room
        [SpacetimeDB.Index.BTree] public ulong RoomId;
        public string Name;
        public bool Ready;
        public byte Seat;                        // 0..MaxMembers-1: stable slot/color in the UI
        public Timestamp JoinedAt;
        public bool Online;                      // false during the reconnect grace period
    }

    // Phones drop the socket when the user switches apps (e.g. to the camera to scan a QR) or locks
    // the screen. Instead of kicking immediately, a disconnect schedules this cleanup; reconnecting
    // within the grace period keeps the seat.
    const long ReconnectGraceMicros = 30_000_000; // 30 s

    [SpacetimeDB.Table(Accessor = "DisconnectCleanup", Scheduled = nameof(CleanupDisconnected), ScheduledAt = nameof(ScheduledAt))]
    public partial struct DisconnectCleanup
    {
        [PrimaryKey, AutoInc] public ulong ScheduledId;
        public ScheduleAt ScheduledAt;
        public Identity Identity;
    }

    [SpacetimeDB.Table(Accessor = "JoinAttempt")]
    public partial struct JoinAttempt
    {
        [PrimaryKey] public Identity Identity;
        public uint Failures;
        public Timestamp WindowStart;
    }

    // ---------- Views: the only lobby data clients can see ----------

    [SpacetimeDB.View(Accessor = "MyRoom", Public = true)]
    public static List<Room> MyRoom(ViewContext ctx)
    {
        var result = new List<Room>();
        if (ctx.Db.RoomMember.Identity.Find(ctx.Sender) is { } me && ctx.Db.Room.Id.Find(me.RoomId) is { } room)
            result.Add(room);
        return result;
    }

    [SpacetimeDB.View(Accessor = "MyRoomMembers", Public = true)]
    public static List<RoomMember> MyRoomMembers(ViewContext ctx)
    {
        if (ctx.Db.RoomMember.Identity.Find(ctx.Sender) is not { } me) return new List<RoomMember>();
        return ctx.Db.RoomMember.RoomId.Filter(me.RoomId).ToList();
    }

    // ---------- Reducers ----------

    [SpacetimeDB.Reducer]
    public static void CreateRoom(ReducerContext ctx, string name)
    {
        name = CleanName(name);
        LeaveCurrentRoom(ctx);

        string code;
        var tries = 0;
        do
        {
            if (++tries > 50) throw new Exception("Could not allocate a room code, try again");
            code = RandomCode(ctx);
        } while (ctx.Db.Room.Code.Find(code) is not null);

        var room = ctx.Db.Room.Insert(new Room
        {
            Id = 0,
            Code = code,
            Host = ctx.Sender,
            State = RoomState.Lobby,
            Game = "",
            CreatedAt = ctx.Timestamp,
        });
        AddMember(ctx, room.Id, name, seat: 0);
        Log.Info($"Room {code} created");
    }

    // A wrong code does NOT throw: throwing would roll back the failed-attempt counter.
    // The client sees it is still not in a room and shows "wrong code".
    [SpacetimeDB.Reducer]
    public static void JoinRoom(ReducerContext ctx, string code, string name)
    {
        name = CleanName(name);
        code = (code ?? "").Trim().ToUpperInvariant();
        CheckJoinRateLimit(ctx);

        if (ctx.Db.Room.Code.Find(code) is not { } room)
        {
            RecordFailedJoin(ctx);
            return;
        }

        // Re-joining your own room (e.g. after a refresh) just updates your name.
        if (ctx.Db.RoomMember.Identity.Find(ctx.Sender) is { } existing && existing.RoomId == room.Id)
        {
            ctx.Db.RoomMember.Identity.Update(existing with { Name = name });
            return;
        }

        if (room.State != RoomState.Lobby) throw new Exception("That game already started");
        var members = ctx.Db.RoomMember.RoomId.Filter(room.Id).ToList();
        if (members.Count >= MaxMembers) throw new Exception("Room is full");

        LeaveCurrentRoom(ctx);
        AddMember(ctx, room.Id, name, FreeSeat(members));
        ctx.Db.JoinAttempt.Identity.Delete(ctx.Sender);
    }

    [SpacetimeDB.Reducer]
    public static void LeaveRoom(ReducerContext ctx) => LeaveCurrentRoom(ctx);

    [SpacetimeDB.Reducer]
    public static void SetName(ReducerContext ctx, string name)
    {
        var me = RequireMember(ctx);
        ctx.Db.RoomMember.Identity.Update(me with { Name = CleanName(name) });
    }

    [SpacetimeDB.Reducer]
    public static void SetReady(ReducerContext ctx, bool ready)
    {
        var me = RequireMember(ctx);
        ctx.Db.RoomMember.Identity.Update(me with { Ready = ready });
    }

    [SpacetimeDB.Reducer]
    public static void ChooseGame(ReducerContext ctx, string game)
    {
        var room = RequireHostedLobby(ctx);
        game = (game ?? "").Trim();
        if (game.Length > 32) throw new Exception("Invalid game id");
        ctx.Db.Room.Id.Update(room with { Game = game });
    }

    [SpacetimeDB.Reducer]
    public static void StartGame(ReducerContext ctx)
    {
        var room = RequireHostedLobby(ctx);
        var members = ctx.Db.RoomMember.RoomId.Filter(room.Id).ToList();
        if (members.Count < MinPlayersToStart) throw new Exception($"Need at least {MinPlayersToStart} players");
        if (members.Any(m => !m.Ready)) throw new Exception("Everyone must be ready");
        if (room.Game == "") throw new Exception("Pick a game first");
        ctx.Db.Room.Id.Update(room with { State = RoomState.Playing });
        Log.Info($"Room {room.Code} started '{room.Game}' with {members.Count} players");
    }

    // Host-only: send everyone back to the lobby (end of a game / abort).
    [SpacetimeDB.Reducer]
    public static void ReturnToLobby(ReducerContext ctx)
    {
        var me = RequireMember(ctx);
        if (ctx.Db.Room.Id.Find(me.RoomId) is not { } room || room.Host != ctx.Sender)
            throw new Exception("Only the host can do that");
        ctx.Db.Room.Id.Update(room with { State = RoomState.Lobby });
        foreach (var m in ctx.Db.RoomMember.RoomId.Filter(room.Id).ToList())
            ctx.Db.RoomMember.Identity.Update(m with { Ready = false });
    }

    [SpacetimeDB.Reducer(ReducerKind.ClientConnected)]
    public static void ClientConnected(ReducerContext ctx)
    {
        if (ctx.Db.RoomMember.Identity.Find(ctx.Sender) is { Online: false } me)
            ctx.Db.RoomMember.Identity.Update(me with { Online = true });
    }

    [SpacetimeDB.Reducer(ReducerKind.ClientDisconnected)]
    public static void ClientDisconnected(ReducerContext ctx)
    {
        if (ctx.Db.RoomMember.Identity.Find(ctx.Sender) is not { } me) return;
        ctx.Db.RoomMember.Identity.Update(me with { Online = false });
        ctx.Db.DisconnectCleanup.Insert(new DisconnectCleanup
        {
            ScheduledId = 0,
            ScheduledAt = new ScheduleAt.Time(ctx.Timestamp + new TimeDuration(ReconnectGraceMicros)),
            Identity = ctx.Sender,
        });
    }

    // Scheduled only. Clients could call it directly, so refuse anything not sent by the database itself.
    [SpacetimeDB.Reducer]
    public static void CleanupDisconnected(ReducerContext ctx, DisconnectCleanup job)
    {
        if (!ctx.SenderAuth.IsInternal) throw new Exception("Not allowed");
        if (ctx.Db.RoomMember.Identity.Find(job.Identity) is { Online: false })
            RemoveMember(ctx, job.Identity);
    }

    // ---------- Helpers ----------

    static string CleanName(string? name)
    {
        name = (name ?? "").Trim();
        if (name.Length == 0) throw new Exception("Name required");
        if (name.Length > 20) name = name[..20];
        foreach (var c in name)
            if (char.IsControl(c)) throw new Exception("Invalid characters in name");
        return name;
    }

    static string RandomCode(ReducerContext ctx)
    {
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++) chars[i] = CodeAlphabet[ctx.Rng.Next(CodeAlphabet.Length)];
        return new string(chars);
    }

    static void AddMember(ReducerContext ctx, ulong roomId, string name, byte seat) =>
        ctx.Db.RoomMember.Insert(new RoomMember
        {
            Identity = ctx.Sender,
            RoomId = roomId,
            Name = name,
            Ready = false,
            Seat = seat,
            JoinedAt = ctx.Timestamp,
            Online = true,
        });

    static byte FreeSeat(List<RoomMember> members)
    {
        for (byte s = 0; s < MaxMembers; s++)
            if (!members.Any(m => m.Seat == s)) return s;
        throw new Exception("Room is full");
    }

    static RoomMember RequireMember(ReducerContext ctx) =>
        ctx.Db.RoomMember.Identity.Find(ctx.Sender) ?? throw new Exception("You are not in a room");

    static Room RequireHostedLobby(ReducerContext ctx)
    {
        var me = RequireMember(ctx);
        if (ctx.Db.Room.Id.Find(me.RoomId) is not { } room) throw new Exception("Room not found");
        if (room.Host != ctx.Sender) throw new Exception("Only the host can do that");
        if (room.State != RoomState.Lobby) throw new Exception("Game already running");
        return room;
    }

    static void LeaveCurrentRoom(ReducerContext ctx) => RemoveMember(ctx, ctx.Sender);

    static void RemoveMember(ReducerContext ctx, Identity who)
    {
        if (ctx.Db.RoomMember.Identity.Find(who) is not { } me) return;
        ctx.Db.RoomMember.Identity.Delete(who);
        if (ctx.Db.Room.Id.Find(me.RoomId) is not { } room) return;

        var remaining = ctx.Db.RoomMember.RoomId.Filter(room.Id).ToList();
        if (remaining.Count == 0)
        {
            ctx.Db.Room.Id.Delete(room.Id);
            return;
        }
        if (room.Host == who)
        {
            // Hand host to whoever has been there longest (preferring someone online).
            var next = remaining.OrderBy(m => m.Online ? 0 : 1).ThenBy(m => m.JoinedAt.MicrosecondsSinceUnixEpoch).First();
            ctx.Db.Room.Id.Update(room with { Host = next.Identity });
        }
    }

    static void CheckJoinRateLimit(ReducerContext ctx)
    {
        if (ctx.Db.JoinAttempt.Identity.Find(ctx.Sender) is not { } a) return;
        var elapsed = ctx.Timestamp.MicrosecondsSinceUnixEpoch - a.WindowStart.MicrosecondsSinceUnixEpoch;
        if (elapsed > FailedJoinWindowMicros) { ctx.Db.JoinAttempt.Identity.Delete(ctx.Sender); return; }
        if (a.Failures >= MaxFailedJoins) throw new Exception("Too many wrong codes. Wait a minute and try again");
    }

    static void RecordFailedJoin(ReducerContext ctx)
    {
        if (ctx.Db.JoinAttempt.Identity.Find(ctx.Sender) is { } a)
            ctx.Db.JoinAttempt.Identity.Update(a with { Failures = a.Failures + 1 });
        else
            ctx.Db.JoinAttempt.Insert(new JoinAttempt { Identity = ctx.Sender, Failures = 1, WindowStart = ctx.Timestamp });
    }
}
