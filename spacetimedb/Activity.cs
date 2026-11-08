using System.Text;
using System.Text.Json;
using SpacetimeDB;

// Security Arcade activity: the games log what each player did (log_activity), and the Help Bot uses a
// compact summary of it to coach the player on the scam patterns they keep missing.
//
// Contract for the games: log_activity(game, kind, details)
//   game, kind: slugs (a-z, 0-9, '-', '_'; 1-32 chars), e.g. "friend-or-fraud", "answer_wrong".
//   details:    short JSON text (<= 500 chars), e.g. {"item":"usps-sms","tactic":"urgency","chose":"friend"}.
//               Stored as text, never parsed here. "tactic" is what the bot counts for coaching.
// The owner is always ctx.Sender and the time ctx.Timestamp. ActivityEvent is private; each client sees
// only its own rows through my_activity. ForgetMe (Bot.cs) deletes them too.
public static partial class Module
{
    const int MaxActivityPerUser = 200;
    const int MaxSlugChars = 32;
    const int MaxDetailsChars = 500;
    const int MaxActivitySummaryChars = 1500;
    const int ActivityRecentWrong = 10;

    [SpacetimeDB.Table(Accessor = "ActivityEvent")]
    public partial struct ActivityEvent
    {
        [PrimaryKey, AutoInc] public ulong Id;
        [SpacetimeDB.Index.BTree] public Identity Owner;
        public string Game;             // slug, e.g. "friend-or-fraud"
        public string Kind;             // slug, e.g. "answer_correct" | "answer_wrong" | "round_done"
        public string Details;          // short JSON text, e.g. {"item":"usps-sms","tactic":"urgency","chose":"friend"}
        public Timestamp CreatedAt;     // order by this, never by Id
    }

    [SpacetimeDB.View(Accessor = "MyActivity", Public = true)]
    public static List<ActivityEvent> MyActivity(ViewContext ctx) =>
        ctx.Db.ActivityEvent.Owner.Filter(ctx.Sender).ToList();

    [SpacetimeDB.Reducer]
    public static void LogActivity(ReducerContext ctx, string game, string kind, string details)
    {
        game = (game ?? "").Trim();
        kind = (kind ?? "").Trim();
        details = (details ?? "").Trim();
        if (!IsSlug(game)) throw new Exception($"game must be a slug (a-z, 0-9, '-', '_'; 1-{MaxSlugChars} chars)");
        if (!IsSlug(kind)) throw new Exception($"kind must be a slug (a-z, 0-9, '-', '_'; 1-{MaxSlugChars} chars)");
        if (details.Length > MaxDetailsChars) throw new Exception($"details too long (max {MaxDetailsChars} characters)");
        if (details.Any(char.IsControl)) throw new Exception("details must be single-line JSON text");
        InsertActivity(ctx, ctx.Sender, game, kind, details, ctx.Timestamp);
        CapActivity(ctx, ctx.Sender, MaxActivityPerUser);
    }

    // Demo data for the pitch: ~15 events for the caller, spread over the last few days, with an obvious
    // weak spot (fake-delivery texts). Calling it again replaces the earlier demo events.
    [SpacetimeDB.Reducer]
    public static void SeedDemoActivity(ReducerContext ctx)
    {
        var me = ctx.Sender;
        foreach (var e in ctx.Db.ActivityEvent.Owner.Filter(me).ToList())
            if (e.Details.Contains("\"demo\":true")) ctx.Db.ActivityEvent.Id.Delete(e.Id);

        const string F = "friend-or-fraud", W = "scam-wordle";
        (double hoursAgo, string game, string kind, string details)[] demo =
        {
            (76, F, "answer_correct", """{"item":"gift-card-boss","tactic":"urgency","chose":"fraud","answer":"fraud","demo":true}"""),
            (75.9, F, "answer_wrong", """{"item":"usps-sms","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}"""),
            (75.8, F, "answer_correct", """{"item":"chase-alert","tactic":"bank-impersonation","chose":"fraud","answer":"fraud","demo":true}"""),
            (75.7, W, "round_done", """{"word":"PHISH","guesses":4,"solved":true,"demo":true}"""),
            (52, F, "answer_correct", """{"item":"prize-iphone","tactic":"prize","chose":"fraud","answer":"fraud","demo":true}"""),
            (51.9, F, "answer_wrong", """{"item":"fedex-redelivery","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}"""),
            (51.8, F, "answer_correct", """{"item":"wrong-number-hi","tactic":"wrong-number","chose":"fraud","answer":"fraud","demo":true}"""),
            (51.7, F, "answer_wrong", """{"item":"toll-unpaid","tactic":"urgency","chose":"friend","answer":"fraud","demo":true}"""),
            (51.6, W, "round_done", """{"word":"SMISH","guesses":3,"solved":true,"demo":true}"""),
            (27, F, "answer_correct", """{"item":"pharmacy-ready","tactic":"none","chose":"friend","answer":"friend","demo":true}"""),
            (26.9, F, "answer_wrong", """{"item":"ups-customs-fee","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}"""),
            (26.8, F, "answer_correct", """{"item":"bofa-locked","tactic":"bank-impersonation","chose":"fraud","answer":"fraud","demo":true}"""),
            (26.7, W, "round_done", """{"word":"SPOOF","guesses":6,"solved":false,"demo":true}"""),
            (3, F, "answer_wrong", """{"item":"amazon-package-hold","tactic":"fake-delivery","chose":"friend","answer":"fraud","demo":true}"""),
            (2.9, W, "round_done", """{"word":"TOKEN","guesses":5,"solved":true,"demo":true}"""),
        };
        // Demo events are backdated, so make room first; otherwise the cap would drop them right away.
        CapActivity(ctx, me, MaxActivityPerUser - demo.Length);
        var now = ctx.Timestamp.MicrosecondsSinceUnixEpoch;
        foreach (var (hoursAgo, game, kind, details) in demo)
            InsertActivity(ctx, me, game, kind, details, new Timestamp(now - (long)(hoursAgo * 3_600_000_000)));
    }

    static bool IsSlug(string s) =>
        s.Length is > 0 and <= MaxSlugChars && s.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-' or '_');

    static void InsertActivity(ReducerContext ctx, Identity owner, string game, string kind, string details, Timestamp at) =>
        ctx.Db.ActivityEvent.Insert(new ActivityEvent { Id = 0, Owner = owner, Game = game, Kind = kind, Details = details, CreatedAt = at });

    // Keep at most `max` events for the owner, dropping the oldest.
    static void CapActivity(ReducerContext ctx, Identity owner, int max)
    {
        var all = ctx.Db.ActivityEvent.Owner.Filter(owner).ToList();
        if (all.Count <= max) return;
        foreach (var old in all.OrderBy(e => e.CreatedAt.MicrosecondsSinceUnixEpoch).ThenBy(e => e.Id).Take(all.Count - max))
            ctx.Db.ActivityEvent.Id.Delete(old.Id);
    }

    // Compact, model-facing summary (<= ~1,500 chars): counts per game/kind, most-missed tactics and the
    // last wrong answers. "" when there is no activity. Details are player-supplied text: they are cleaned
    // here and the whole summary is passed to the model as data (WrapUserContent).
    static string ActivitySummary(List<ActivityEvent> events, Timestamp now)
    {
        if (events.Count == 0) return "";
        var sb = new StringBuilder();
        sb.Append("Counts: ");
        sb.Append(string.Join("; ", events.GroupBy(e => e.Game).OrderByDescending(g => g.Count()).Select(g =>
            $"{g.Key}: " + string.Join(", ", g.GroupBy(e => e.Kind).OrderByDescending(k => k.Count()).Select(k => $"{k.Key} {k.Count()}")))));
        sb.Append('\n');

        var wrong = events.Where(e => e.Kind.Contains("wrong")).OrderByDescending(e => e.CreatedAt.MicrosecondsSinceUnixEpoch).ToList();
        var tactics = wrong.Select(e => DetailString(e.Details, "tactic")).Where(t => t.Length > 0)
            .GroupBy(t => t).OrderByDescending(g => g.Count()).Take(5).Select(g => $"{g.Key} x{g.Count()}").ToList();
        sb.Append("Most-missed tactics: ").Append(tactics.Count > 0 ? string.Join(", ", tactics) : "(none)").Append('\n');

        sb.Append("Recent wrong answers (newest first):");
        if (wrong.Count == 0) sb.Append(" (none)");
        foreach (var e in wrong.Take(ActivityRecentWrong))
            sb.Append($"\n- {e.Game}, {Ago(now, e.CreatedAt)}: {Clean(e.Details.Replace(",\"demo\":true", ""), 160)}");

        // Latest finished round per game (e.g. Bad Scam's chosen tactics, Guess Who's checks): not right/wrong answers.
        var rounds = events.Where(e => e.Kind == "round_done").GroupBy(e => e.Game)
            .Select(g => g.MaxBy(e => e.CreatedAt.MicrosecondsSinceUnixEpoch)).Take(4).ToList();
        if (rounds.Count > 0) sb.Append("\nLatest rounds:");
        foreach (var e in rounds)
            sb.Append($"\n- {e.Game}, {Ago(now, e.CreatedAt)}: {Clean(e.Details.Replace(",\"demo\":true", ""), 160)}");

        var s = sb.ToString();
        return s.Length <= MaxActivitySummaryChars ? s : s[..MaxActivitySummaryChars] + "…";
    }

    static string DetailString(string json, string key)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty(key, out var v) && v.ValueKind == JsonValueKind.String
                ? Clean(v.GetString() ?? "", 40) : "";
        }
        catch (JsonException) { return ""; }
    }

    static string Clean(string s, int max)
    {
        var t = new string(s.Where(c => !char.IsControl(c)).ToArray()).Replace(ContentStart, "").Replace(ContentEnd, "");
        return Trim(t, max);
    }

    static string Ago(Timestamp now, Timestamp at)
    {
        var h = (now.MicrosecondsSinceUnixEpoch - at.MicrosecondsSinceUnixEpoch) / 3_600_000_000;
        return h < 1 ? "just now" : h < 24 ? $"{h}h ago" : $"{h / 24}d ago";
    }
}
