#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using SpacetimeDB;
using SpacetimeDB.Types;
using UnityEngine;

// Single source of truth for the lobby UI. Reads SpacetimeDB's client cache (MyRoom / MyRoomMembers
// views), holds local UI state (typed code, errors, pending action) and exposes actions.
// Rish UI re-renders whenever Version changes (see UI/AppRoot.cs).
public static class Lobby
{
    public enum Screen { Connecting, Home, Join, Room, Playing }

    public readonly struct GameInfo
    {
        public readonly string Id, Title, Blurb;
        public GameInfo(string id, string title, string blurb) { Id = id; Title = title; Blurb = blurb; }
    }

    // Placeholder catalog; each real game plugs in its own tables + screen later.
    public static readonly GameInfo[] Games =
    {
        new("firewall", "Firewall", "Co-op · block the bad packets together"),
        new("patch-race", "Patch Race", "1v1 · patch vulns before they're exploited"),
        new("split-key", "Split Key", "Co-op · each of you holds half the secret"),
    };

    public const int CodeLength = 4;
    public const string CodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // must match server
    public const int MinPlayers = 2;

    public static event Action? Changed;
    public static uint Version { get; private set; }

    public static bool Connected { get; private set; }
    public static string? ConnectError { get; private set; }
    public static string MyName { get; private set; } = "";
    public static string TypedCode { get; private set; } = "";
    public static string? Error { get; private set; }
    public static string? Busy { get; private set; }   // "create" / "join" / null
    static bool _joinScreen;
    static float _errorUntil;
    static string? _pendingAutoJoin;

    static DbConnection Conn => GameManager.Conn;

    // ---------- Derived state ----------

    public static Room? MyRoom
    {
        get
        {
            if (Conn == null || !Connected) return null;
            foreach (var r in Conn.Db.MyRoom.Iter()) return r;
            return null;
        }
    }

    public static List<RoomMember> Members =>
        Conn == null || !Connected ? new List<RoomMember>() : Conn.Db.MyRoomMembers.Iter().OrderBy(m => m.Seat).ToList();

    public static bool IsHost => MyRoom is { } r && r.Host == GameManager.LocalIdentity;

    public static RoomMember? Me => Members.FirstOrDefault(m => m.Identity == GameManager.LocalIdentity);

    public static Screen CurrentScreen
    {
        get
        {
            if (!Connected) return Screen.Connecting;
            if (MyRoom is { } room) return room.State is RoomState.Playing ? Screen.Playing : Screen.Room;
            return _joinScreen ? Screen.Join : Screen.Home;
        }
    }

    public static bool CanStart
    {
        get
        {
            var members = Members;
            return IsHost && MyRoom is { } r && r.Game != "" && members.Count >= MinPlayers && members.All(m => m.Ready);
        }
    }

    public static GameInfo? GameById(string id)
    {
        foreach (var g in Games) if (g.Id == id) return g;
        return null;
    }

    // Link encoded in the room QR. Opens the game straight into this room.
    public static string JoinLink(string code)
    {
        var baseUrl = UrlParams.Get("joinUrl") ?? UrlParams.PageBase ?? GameManager.Instance.FallbackJoinUrl;
        var sep = baseUrl.Contains("?") ? "&" : "?";
        var link = $"{baseUrl}{sep}room={Uri.EscapeDataString(code)}";
        // Carry a non-default server/db through so local test builds QR-join the same server.
        if (UrlParams.Get("server") is { } s) link += $"&server={Uri.EscapeDataString(s)}";
        if (UrlParams.Get("db") is { } d) link += $"&db={Uri.EscapeDataString(d)}";
        return link;
    }

    // ---------- Wiring (called by GameManager) ----------

    public static void Init()
    {
        MyName = UrlParams.Get("name") is { Length: > 0 } n ? Clip(n) : PlayerPrefs.GetString("lobby.name", "");
        if (string.IsNullOrWhiteSpace(MyName)) RerollName();
        if (UrlParams.Get("room") is { Length: > 0 } code) _pendingAutoJoin = code.Trim().ToUpperInvariant();
    }

    public static void Hook(DbConnection conn)
    {
        conn.Db.MyRoom.OnInsert += (_, _) => Bump();
        conn.Db.MyRoom.OnDelete += (_, _) => Bump();
        conn.Db.MyRoomMembers.OnInsert += (_, _) => Bump();
        conn.Db.MyRoomMembers.OnDelete += (_, _) => Bump();

        conn.Reducers.OnCreateRoom += (ctx, _) => FinishBusy("create", ctx);
        conn.Reducers.OnJoinRoom += (ctx, _, _) =>
        {
            if (Busy != "join") return;
            if (ctx.Event.Status is Status.Committed && MyRoom == null)
            {
                Busy = null;
                TypedCode = ""; // let them retype immediately
                ShowError("No room with that code. Check it and try again.");
                return;
            }
            FinishBusy("join", ctx);
            TypedCode = "";
        };
        conn.OnUnhandledReducerError += (_, ex) => ShowError(ex.Message);
    }

    public static void OnConnected()
    {
        Connected = true;
        ConnectError = null;
        Bump();
    }

    // Called once the subscription has applied, so MyRoom reflects reality.
    public static void OnSubscribed()
    {
        Bump();
        if (_pendingAutoJoin is { } code)
        {
            _pendingAutoJoin = null;
            if (MyRoom is { } r && r.Code == code) return;
            TypedCode = code;
            SubmitCode();
        }
    }

    public static void OnDisconnected(string? error)
    {
        Connected = false;
        ConnectError = error;
        Busy = null;
        Bump();
    }

    public static void Tick()
    {
        if (Error != null && Time.unscaledTime > _errorUntil) { Error = null; Bump(); }
    }

    // ---------- Actions (called from UI) ----------

    public static void CreateRoom()
    {
        if (Busy != null) return;
        Busy = "create";
        Conn.Reducers.CreateRoom(MyName);
        Bump();
    }

    public static void OpenJoin() { _joinScreen = true; TypedCode = ""; Bump(); }
    public static void BackHome() { _joinScreen = false; TypedCode = ""; Bump(); }

    public static void TypeChar(char c)
    {
        c = char.ToUpperInvariant(c);
        if (CurrentScreen != Screen.Join || TypedCode.Length >= CodeLength || CodeAlphabet.IndexOf(c) < 0) return;
        TypedCode += c;
        Bump();
        if (TypedCode.Length == CodeLength) SubmitCode();
    }

    public static void Backspace()
    {
        if (CurrentScreen != Screen.Join || TypedCode.Length == 0) return;
        TypedCode = TypedCode.Substring(0, TypedCode.Length - 1);
        Bump();
    }

    public static void SubmitCode()
    {
        if (Busy != null || TypedCode.Length != CodeLength) return;
        Busy = "join";
        _joinScreen = true;
        Conn.Reducers.JoinRoom(TypedCode, MyName);
        Bump();
    }

    public static void ToggleReady()
    {
        if (Me is { } me) Conn.Reducers.SetReady(!me.Ready);
    }

    public static void ChooseGame(string id)
    {
        if (IsHost) Conn.Reducers.ChooseGame(id);
    }

    public static void StartGame()
    {
        if (CanStart) Conn.Reducers.StartGame();
    }

    public static void ReturnToLobby()
    {
        if (IsHost) Conn.Reducers.ReturnToLobby();
    }

    public static void LeaveRoom()
    {
        Conn.Reducers.LeaveRoom();
        _joinScreen = false;
        TypedCode = "";
        Bump();
    }

    public static void RerollName() => SetName(RandomName());

    public static void SetName(string name)
    {
        name = Clip(name);
        if (name.Length == 0 || name == MyName) return;
        MyName = name;
        PlayerPrefs.SetString("lobby.name", MyName);
        if (Connected && MyRoom != null) Conn.Reducers.SetName(MyName);
        Bump();
    }

    // ---------- Helpers ----------

    static void FinishBusy(string kind, ReducerEventContext ctx)
    {
        if (Busy != kind) return;
        Busy = null;
        if (ctx.Event.Status is Status.Failed(var reason)) ShowError(reason);
        Bump();
    }

    public static void ShowError(string message)
    {
        Error = message;
        _errorUntil = Time.unscaledTime + 4f;
        Bump();
    }

    static void Bump()
    {
        Version++;
        Changed?.Invoke();
    }

    static string Clip(string? s)
    {
        s = (s ?? "").Trim();
        return s.Length > 20 ? s.Substring(0, 20) : s;
    }

    static readonly string[] Adjectives =
        { "Swift", "Sneaky", "Secure", "Stealthy", "Clever", "Encrypted", "Brave", "Hidden", "Quantum", "Rapid", "Silent", "Lucky", "Turbo", "Mighty", "Patched", "Magenta" };
    static readonly string[] Nouns =
        { "Firewall", "Packet", "Cipher", "Router", "Token", "Otter", "Falcon", "Byte", "Proxy", "Kernel", "Badger", "Signal", "Tower", "Hash", "Key", "Panda" };

    static string RandomName()
    {
        // Default System.Random seeding repeats across fresh WebGL page loads; seed from a Guid.
        var rng = new System.Random(Guid.NewGuid().GetHashCode());
        string name;
        do name = $"{Adjectives[rng.Next(Adjectives.Length)]} {Nouns[rng.Next(Nouns.Length)]}";
        while (name == MyName);
        return name;
    }
}
