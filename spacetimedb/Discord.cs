#pragma warning disable STDB_UNSTABLE // HTTP handlers, procedures + outbound HTTP are marked unstable in SpacetimeDB 2.x
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using SpacetimeDB;

// Help Bot on Discord through HTTP interactions (no gateway, no long-running process).
//
//   Discord --POST /discord (Ed25519-signed interaction)--> this module --> {"type":5} (deferred, ephemeral)
//   scheduled procedure DiscordRunJob --PATCH {DISCORD_API_BASE}/webhooks/{app}/{token}/messages/@original--> Discord
//
// Served at /v1/database/<db>/route/discord (the app's Interactions Endpoint URL). Configure DISCORD_PUBLIC_KEY.
// Commands (registered by scripts/discord-register.sh): /check [message] [screenshot], the message context-menu
// command "Check with Help Bot", /link code, /unlink. The bot token is only used by that script, never here.
//
// Security model:
//  - Every request must carry a valid Ed25519 signature (X-Signature-Ed25519 over X-Signature-Timestamp + body,
//    app public key) and a timestamp within 5 minutes; else 401. No public key: 503.
//  - Each interaction id is handled once (WebhookSeen, shared with Photon.cs).
//  - Senders get a pseudo identity per Discord user id until they /link with a one-time code from the web app
//    (same ChannelLink / LinkCode / LinkAttempt tables and wrong-code limit as iMessage).
//  - AI turns use the messaging budget (ChannelAiUsage, 8 per rolling minute per Discord user).
//  - Screenshots are downloaded in the scheduled procedure, sent to the model and never stored. Only JPEG/PNG/WebP.
//  - All replies are ephemeral (only the person who ran the command sees them), mention no one, and contain no
//    clickable links: URLs in the reply are wrapped in inline code.
//  - DiscordJob rows (they hold the 15-minute interaction token) are private and deleted when the job runs.
public static partial class Module
{
    const string DefaultDiscordApiBase = "https://discord.com/api/v10";
    const long DiscordToleranceSeconds = 5 * 60;
    const int EphemeralFlag = 64;
    const string DiscordCheckCommand = "check";
    const string DiscordContextCommand = "Check with Help Bot";
    const string DiscordNotAScreenshot = "I can read text and screenshots (PNG, JPEG or WebP). Attach a screenshot of the message, or paste its text in `/check message:`.";
    static readonly HashSet<string> DiscordImageMimes = new() { "image/jpeg", "image/png", "image/webp" };

    // One pending check. Scheduled "now" by the interaction handler; the row is deleted after DiscordRunJob.
    [SpacetimeDB.Table(Accessor = "DiscordJob", Scheduled = nameof(DiscordRunJob), ScheduledAt = nameof(ScheduledAt))]
    public partial struct DiscordJob
    {
        [PrimaryKey, AutoInc] public ulong ScheduledId;
        public ScheduleAt ScheduledAt;
        public string ApplicationId;
        public string InteractionToken; // valid 15 min; lets us edit our own deferred reply
        public string UserId;           // Discord user id (snowflake)
        public string Text;
        public string AttachmentUrl;    // "" = none
    }

    [SpacetimeDB.HttpHandler]
    public static HttpResponse DiscordInteractions(HandlerContext ctx, HttpRequest request)
    {
        var keyHex = Env.DISCORD_PUBLIC_KEY;
        if (string.IsNullOrEmpty(keyHex)) return Respond(503, "discord not configured");
        if (Ed25519.FromHex(keyHex) is not { Length: 32 } publicKey)
        {
            Log.Error("Discord: DISCORD_PUBLIC_KEY is not 64 hex characters");
            return Respond(503, "discord not configured");
        }

        var ts = Header(request, "x-signature-timestamp");
        var sig = Ed25519.FromHex(Header(request, "x-signature-ed25519"));
        var body = request.Body.ToBytes();
        var nowSec = ctx.Timestamp.MicrosecondsSinceUnixEpoch / 1_000_000;
        if (sig is not { Length: 64 } || !long.TryParse(ts, out var tsSec) || Math.Abs(nowSec - tsSec) > DiscordToleranceSeconds
            || !Ed25519.Verify(publicKey, Concat(Encoding.UTF8.GetBytes(ts), body), sig))
            return Respond(401, "invalid request signature");

        try
        {
            using var doc = JsonDocument.Parse(body);
            return HandleInteraction(ctx, doc.RootElement);
        }
        catch (Exception e)
        {
            Log.Warn($"Discord: could not handle interaction: {e.GetType().Name}: {e.Message}");
            return DiscordReply("Sorry, something went wrong. Please try again.");
        }
    }

    static HttpResponse HandleInteraction(HandlerContext ctx, JsonElement root)
    {
        var type = root.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.Number ? t.GetInt32() : 0;
        if (type == 1) return Json("""{"type":1}"""); // PING
        if (type != 2) return DiscordReply("That isn't something I can do yet. Try /check.");

        var interactionId = Str(root, "id");
        var token = Str(root, "token");
        var appId = Str(root, "application_id");
        var configuredApp = Env.DISCORD_APPLICATION_ID;
        if (!string.IsNullOrEmpty(configuredApp) && appId != configuredApp) return Respond(400, "wrong application");
        var user = root.TryGetProperty("member", out var member) && member.TryGetProperty("user", out var mu) ? mu
            : root.TryGetProperty("user", out var u) ? u : default;
        var userId = Str(user, "id");
        if (interactionId.Length == 0 || token.Length == 0 || appId.Length == 0 || userId.Length == 0 || !userId.All(char.IsAsciiDigit))
            return Respond(400, "bad interaction");

        var host = new HandlerBotHost(ctx);
        var seenKey = $"discord:{interactionId}";
        var fresh = host.Tx((db, now) =>
        {
            if (db.WebhookSeen.Id.Find(seenKey) is not null) return false;
            db.WebhookSeen.Insert(new WebhookSeen { Id = seenKey, SeenAt = now });
            if (db.WebhookSeen.Count > MaxWebhookSeen)
                foreach (var old in db.WebhookSeen.Iter().OrderBy(w => w.SeenAt.MicrosecondsSinceUnixEpoch).Take(MaxWebhookSeen / 4).ToList())
                    db.WebhookSeen.Id.Delete(old.Id);
            return true;
        });
        if (!fresh) return Respond(409, "duplicate interaction");

        var data = root.GetProperty("data");
        var name = Str(data, "name");
        var senderKey = $"discord:{userId}";
        var pseudo = PseudoIdentity("discord", userId);

        // ---- Commands without AI: immediate ephemeral reply ----
        if (name == "link")
        {
            var code = Option(data, "code");
            var handle = Str(user, "username");
            var hint = handle.Length > 0 ? "@" + Trim(handle, 32) : "";
            return DiscordReply(host.Tx((db, now) => LinkSender(db, now, senderKey, pseudo, "discord", hint, code)));
        }
        if (name == "unlink")
            return DiscordReply(host.Tx((db, _) =>
            {
                if (db.ChannelLink.SenderKey.Find(senderKey) is null) return "Your Discord isn't linked to a Security Arcade account.";
                db.ChannelLink.SenderKey.Delete(senderKey);
                return "Unlinked. I'll keep checking messages for you here, but separately from your Security Arcade account.";
            }));

        // ---- Checks: validate, then defer and let the scheduled procedure do the work ----
        string text, url = "";
        if (name == DiscordCheckCommand)
        {
            text = Option(data, "message").Trim();
            var attachmentId = Option(data, "screenshot");
            if (attachmentId.Length > 0)
            {
                if (Resolved(data, "attachments", attachmentId) is not { } att) return DiscordReply("I couldn't find that attachment. Try again.");
                if (AttachmentProblem(att) is { } problem) return DiscordReply(problem);
                url = Str(att, "url");
            }
        }
        else if (name == DiscordContextCommand)
        {
            if (Resolved(data, "messages", Str(data, "target_id")) is not { } target) return DiscordReply("I couldn't read that message. Try again.");
            text = Str(target, "content").Trim();
            // The first image attachment; other files are ignored when there's text to check.
            if (target.TryGetProperty("attachments", out var list) && list.ValueKind == JsonValueKind.Array)
            {
                var atts = list.EnumerateArray().ToList();
                var image = atts.FirstOrDefault(a => AttachmentProblem(a) is null);
                if (image.ValueKind == JsonValueKind.Object) url = Str(image, "url");
                else if (atts.Count > 0 && text.Length == 0) return DiscordReply(AttachmentProblem(atts[0])!);
            }
        }
        else return DiscordReply("I don't know that command. Try /check.");

        if (text.Length > MaxBotTextChars) text = text[..MaxBotTextChars];
        if (text.Length == 0 && url.Length == 0)
            return DiscordReply(name == DiscordContextCommand
                ? "That message has no text or screenshot I can check."
                : "Add the message to check: `/check message:` (paste the text or link) or `/check screenshot:` (attach a screenshot).");
        if (url.Length > 0 && !url.StartsWith("https://", StringComparison.Ordinal)) return DiscordReply("I couldn't open that attachment. Try again.");
        if (LoadAiConfig() is null) return DiscordReply("Sorry, I'm not set up to answer right now. Please try again later.");

        var busy = host.Tx((db, now) =>
        {
            if (TakeChannelBudget(db, senderKey, now, consume: true) is not null) return true;
            db.DiscordJob.Insert(new DiscordJob
            {
                ScheduledId = 0,
                ScheduledAt = new ScheduleAt.Time(now),
                ApplicationId = appId,
                InteractionToken = token,
                UserId = userId,
                Text = text,
                AttachmentUrl = url,
            });
            return false;
        });
        if (busy) return DiscordReply(ChannelBusyReply);
        return Json("{\"type\":5,\"data\":{\"flags\":" + EphemeralFlag + "}}"); // deferred, ephemeral
    }

    // Scheduled only (DiscordJob): download the screenshot, run the bot, edit the deferred reply.
    [SpacetimeDB.Procedure]
    public static void DiscordRunJob(ProcedureContext ctx, DiscordJob job)
    {
        if (!ctx.SenderAuth.IsInternal) throw new Exception("Not allowed");
        var host = new ProcedureBotHost(ctx);
        try
        {
            if (LoadAiConfig() is not { } cfg) { EditDiscordReply(ctx.Http, job, PlainMessage("Sorry, I'm not set up to answer right now.")); return; }
            var imageDataUrl = "";
            if (job.AttachmentUrl.Length > 0)
            {
                var (dataUrl, problem) = FetchDiscordImage(ctx.Http, job.AttachmentUrl);
                if (problem.Length > 0) { EditDiscordReply(ctx.Http, job, PlainMessage(problem)); return; }
                imageDataUrl = dataUrl;
            }
            var senderKey = $"discord:{job.UserId}";
            var pseudo = PseudoIdentity("discord", job.UserId);
            var owner = host.Tx((db, _) => db.ChannelLink.SenderKey.Find(senderKey)?.Owner ?? pseudo);
            var turn = RunBotTurn(host, cfg, owner, "discord", job.Text, imageDataUrl, cooldown: false);
            var payload = turn.Stored && turn.Ai.Ok ? VerdictEmbed(turn.Reply) : PlainMessage(BotApology);
            EditDiscordReply(ctx.Http, job, payload);
        }
        catch (Exception e)
        {
            Log.Error($"Discord: job {job.ScheduledId} failed: {e.GetType().Name}: {e.Message}");
            try { EditDiscordReply(ctx.Http, job, PlainMessage(BotApology)); } catch (Exception) { }
        }
    }

    // ---------- Interaction helpers ----------

    // A string option of a slash command ("" when missing). Attachment options carry the attachment id.
    static string Option(JsonElement data, string name)
    {
        if (!data.TryGetProperty("options", out var opts) || opts.ValueKind != JsonValueKind.Array) return "";
        foreach (var o in opts.EnumerateArray())
            if (Str(o, "name") == name && o.TryGetProperty("value", out var v))
                return v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : v.ToString();
        return "";
    }

    static JsonElement? Resolved(JsonElement data, string kind, string id) =>
        id.Length > 0 && data.TryGetProperty("resolved", out var r) && r.TryGetProperty(kind, out var map)
            && map.ValueKind == JsonValueKind.Object && map.TryGetProperty(id, out var el) ? el : null;

    // null = an image we can check; otherwise the reply to send. Uses Discord's metadata (type, size);
    // the bytes are checked again after the download.
    static string? AttachmentProblem(JsonElement att)
    {
        var mime = NormalizeMime(Str(att, "content_type"));
        if (mime.Length == 0) mime = Path.GetExtension(Str(att, "filename")).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "",
        };
        if (!DiscordImageMimes.Contains(mime)) return DiscordNotAScreenshot;
        if (att.TryGetProperty("size", out var s) && s.ValueKind == JsonValueKind.Number && s.GetInt64() > MaxAttachmentBytes)
            return "That picture is too big for me. Try a screenshot under 8 MB.";
        return null;
    }

    static (string, string) FetchDiscordImage(SpacetimeDB.HttpClient http, string url)
    {
        var result = http.Send(new HttpRequest
        {
            Uri = url,
            Method = SpacetimeDB.HttpMethod.Get,
            Timeout = TimeSpan.FromSeconds(8),
            Headers = new(),
            Body = HttpBody.FromString(""),
        });
        return result.Match(
            response =>
            {
                if (response.StatusCode != 200)
                {
                    Log.Warn($"Discord: attachment download HTTP {response.StatusCode}");
                    return ("", "Sorry, I couldn't open that picture. Try again, or paste the text.");
                }
                var bytes = response.Body.ToBytes();
                if (bytes.Length > MaxAttachmentBytes) return ("", "That picture is too big for me. Try a screenshot under 8 MB.");
                var mime = SniffImageMime(bytes);
                if (!DiscordImageMimes.Contains(mime)) return ("", DiscordNotAScreenshot);
                return ($"data:{mime};base64,{Convert.ToBase64String(bytes)}", "");
            },
            error => ("", "Sorry, I couldn't open that picture. Try again, or paste the text."));
    }

    static string DiscordApiBase() =>
        (string.IsNullOrEmpty(Env.DISCORD_API_BASE) ? DefaultDiscordApiBase : Env.DISCORD_API_BASE!).TrimEnd('/');

    // Edit the deferred (ephemeral) reply. No bot token: the interaction token authorizes this for 15 min.
    static void EditDiscordReply(SpacetimeDB.HttpClient http, DiscordJob job, string payload)
    {
        var result = http.Send(new HttpRequest
        {
            Uri = $"{DiscordApiBase()}/webhooks/{Uri.EscapeDataString(job.ApplicationId)}/{Uri.EscapeDataString(job.InteractionToken)}/messages/@original",
            Method = SpacetimeDB.HttpMethod.Patch,
            Timeout = TimeSpan.FromSeconds(6),
            Headers = new() { new HttpHeader("content-type", "application/json") },
            Body = HttpBody.FromString(payload),
        });
        result.Match(
            response =>
            {
                if (response.StatusCode is < 200 or >= 300)
                    Log.Warn($"Discord: editing the reply failed HTTP {response.StatusCode}: {Trim(response.Body.ToStringUtf8Lossy(), 300)}");
                return 0;
            },
            error => { Log.Warn($"Discord: editing the reply failed: {error.Message}"); return 0; });
    }

    // ---------- Reply formatting ----------

    // One embed: colour + title by verdict, the reply, "Red flags" and "What to do". Within Discord's limits
    // (title 256, description 4096, field value 1024, total 6000).
    static string VerdictEmbed(BotReply r)
    {
        var (color, title) = r.Verdict switch
        {
            "scam" => (0xE53935, "🚩 Scam"),
            "suspicious" => (0xFFA000, "⚠️ Suspicious"),
            "likely_safe" => (0x43A047, "✅ Looks safe"),
            _ => (0x99AAB5, ""),
        };
        return DiscordPayload(ephemeral: false, w =>
        {
            w.WriteString("content", "");
            w.WriteStartArray("embeds");
            w.WriteStartObject();
            if (title.Length > 0) w.WriteString("title", title);
            w.WriteString("description", Trim(NoLinks(r.Reply), 3500));
            w.WriteNumber("color", color);
            w.WriteStartArray("fields");
            if (r.Verdict.Length > 0)
            {
                Field(w, "Red flags", r.RedFlags);
                Field(w, "What to do", r.NextSteps);
            }
            w.WriteEndArray();
            w.WriteStartObject("footer");
            w.WriteString("text", "Help Bot · only you can see this");
            w.WriteEndObject();
            w.WriteEndObject();
            w.WriteEndArray();
        });

        static void Field(Utf8JsonWriter w, string name, List<string> items)
        {
            if (items.Count == 0) return;
            var value = string.Join("\n", items.Take(6).Select(i => "• " + Trim(NoLinks(i), 160)));
            w.WriteStartObject();
            w.WriteString("name", name);
            w.WriteString("value", Trim(value, 1000));
            w.WriteBoolean("inline", false);
            w.WriteEndObject();
        }
    }

    static string PlainMessage(string text) => DiscordPayload(ephemeral: false, w =>
    {
        w.WriteString("content", Trim(text, 1900));
        w.WriteStartArray("embeds");
        w.WriteEndArray();
    });

    // Common message fields: never mention anyone; ephemeral for immediate replies (an edited deferred reply
    // stays ephemeral, and edits can't set that flag).
    static string DiscordPayload(bool ephemeral, Action<Utf8JsonWriter> fields)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            fields(w);
            if (ephemeral) w.WriteNumber("flags", EphemeralFlag);
            w.WriteStartObject("allowed_mentions");
            w.WriteStartArray("parse");
            w.WriteEndArray();
            w.WriteEndObject();
            w.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    static HttpResponse DiscordReply(string text) =>
        Json("""{"type":4,"data":""" + DiscordPayload(ephemeral: true, w => w.WriteString("content", Trim(text, 1900))) + "}");

    static readonly Regex UrlLike = new(
        @"(?:https?://|www\.)[^\s<>`]+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b(?:/[^\s<>`]*)?",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    // Model output -> no clickable links: URLs and bare domains go in inline code, backticks in the text become
    // quotes (so nothing can close the code span), and masked-link syntax "[text](url)" is broken up.
    static string NoLinks(string text)
    {
        var s = text.Replace('`', '\'').Replace("](", "] (");
        return UrlLike.Replace(s, m =>
        {
            var v = m.Value;
            var tail = "";
            while (v.Length > 0 && ".,;:!?)]'\"".Contains(v[^1])) { tail = v[^1] + tail; v = v[..^1]; }
            return v.Length == 0 ? m.Value : $"`{v}`{tail}";
        });
    }

    static HttpResponse Json(string json) =>
        new(200, HttpVersion.Http11, new() { new HttpHeader("content-type", "application/json") }, HttpBody.FromString(json));

    static byte[] Concat(byte[] a, byte[] b)
    {
        var r = new byte[a.Length + b.Length];
        a.CopyTo(r, 0);
        b.CopyTo(r, a.Length);
        return r;
    }
}
