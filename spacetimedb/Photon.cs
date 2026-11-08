#pragma warning disable STDB_UNSTABLE // HTTP handlers, procedures + outbound HTTP are marked unstable in SpacetimeDB 2.x
using System.Text;
using System.Text.Json;
using SpacetimeDB;

// Help Bot on messaging apps (iMessage, WhatsApp, ...) through Photon (https://photon.codes, Beta 2.0 API).
//
//   Photon --POST /photon (signed webhook, event message.received)--> this module
//   this module --POST {PHOTON_BASE_URL}/v1/projects/{id}/messages--> Photon --> the person's phone
//
// Served at /v1/database/<db>/route/photon. Configure PHOTON_WEBHOOK_SECRET (+ PHOTON_API_KEY to reply).
//
// Security model:
//  - Every request must carry a valid Standard Webhooks signature (HMAC-SHA256 over id.timestamp.body,
//    keyed with the destination's whsec_ secret) and a timestamp within 5 minutes; else 401. No secret: 503.
//  - Each webhook-id is handled once (WebhookSeen, private). Retries of a handled event just get 200.
//  - A sender is identified by Photon's user id. Until it is linked, it gets its own pseudo identity
//    (PseudoIdentity), so strangers never see or touch anyone else's chat. Linking needs a one-time code
//    that only the player can see (MyLinkCode), valid 10 minutes, with wrong codes rate-limited per sender.
//  - Screenshots are downloaded, sent to the model and never stored (same as the web). Only JPEG/PNG/WebP/
//    HEIC/HEIF are accepted (Content-Type, else magic bytes); other attachments get a fixed reply, no model call.
//  - AI turns are budgeted per sender (ChannelAiUsage: 8 per rolling minute), not the web's 3 s cooldown.
//  - ChannelLink / LinkCode / LinkAttempt / WebhookSeen are private; players see only their own rows.
public static partial class Module
{
    const string DefaultPhotonBaseUrl = "https://api.photon.codes";
    const long WebhookToleranceSeconds = 5 * 60;
    const int MaxWebhookSeen = 2000;
    const int LinkCodeLength = 6;
    const long LinkCodeTtlMicros = 10 * 60_000_000L; // 10 min
    const int MaxFailedLinks = 5;
    const long FailedLinkWindowMicros = 10 * 60_000_000L; // 10 min
    const int MaxAttachmentBytes = 8 * 1024 * 1024;
    const int MaxChannelReplyChars = 1200;
    // Photon gives up after 20 s; keep the whole webhook well under that.
    const long WebhookBudgetMicros = 15_000_000;
    // Messaging AI budget per sender (replaces the web's 3 s cooldown here: people often send a text and
    // a screenshot as two messages within a second).
    const int MaxChannelAiTurns = 8;
    const long ChannelAiWindowMicros = 60_000_000L; // rolling 60 s
    const string ChannelBusyReply = "You're sending a lot at once — give me a minute.";
    const string NotAScreenshotReply = "I can read text messages and screenshots (PNG/JPEG). Send a screenshot of it and I'll take a look.";
    static readonly HashSet<string> ChannelImageMimes = new() { "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif" };

    // A messaging-app sender linked to a player. SenderKey = "<platform>:<Photon user id>".
    [SpacetimeDB.Table(Accessor = "ChannelLink")]
    public partial struct ChannelLink
    {
        [PrimaryKey] public string SenderKey;
        [SpacetimeDB.Index.BTree] public Identity Owner;
        public string Platform;         // "imessage", "whatsapp", ...
        public string HandleHint;       // masked sender handle for display, e.g. "•••0123"
        public Timestamp CreatedAt;
    }

    // One pending one-time link code per player (CreateLinkCode replaces it).
    [SpacetimeDB.Table(Accessor = "LinkCode")]
    public partial struct LinkCode
    {
        [PrimaryKey] public Identity Owner;
        [Unique] public string Code;
        public Timestamp ExpiresAt;
    }

    // Wrong LINK codes per sender (anti brute-force), like the lobby's JoinAttempt.
    [SpacetimeDB.Table(Accessor = "LinkAttempt")]
    public partial struct LinkAttempt
    {
        [PrimaryKey] public string SenderKey;
        public uint Failures;
        public Timestamp WindowStart;
    }

    // AI turns per messaging sender in the last ChannelAiWindowMicros (private). Notified: the "sending a
    // lot" reply went out for the current over-budget streak, so further messages are dropped silently.
    [SpacetimeDB.Table(Accessor = "ChannelAiUsage")]
    public partial struct ChannelAiUsage
    {
        [PrimaryKey] public string SenderKey;
        public List<long> RecentMicros;
        public bool Notified;
    }

    // Webhook ids already handled (Photon retries; webhook-id stays the same). Capped at MaxWebhookSeen.
    [SpacetimeDB.Table(Accessor = "WebhookSeen")]
    public partial struct WebhookSeen
    {
        [PrimaryKey] public string Id;
        public Timestamp SeenAt;
    }

    [SpacetimeDB.View(Accessor = "MyLinkCode", Public = true)]
    public static List<LinkCode> MyLinkCode(ViewContext ctx) =>
        ctx.Db.LinkCode.Owner.Find(ctx.Sender) is { } c ? new List<LinkCode> { c } : new List<LinkCode>();

    [SpacetimeDB.View(Accessor = "MyChannelLinks", Public = true)]
    public static List<ChannelLink> MyChannelLinks(ViewContext ctx) =>
        ctx.Db.ChannelLink.Owner.Filter(ctx.Sender).ToList();

    // Make a fresh one-time code for the caller (shown via my_link_code). Texting "LINK <code>" to the bot
    // links that messaging-app sender to the caller. The code mixes the reducer RNG with an HMAC keyed by the
    // webhook secret, so it can't be predicted from the (deterministic) RNG seed alone.
    [SpacetimeDB.Reducer]
    public static void CreateLinkCode(ReducerContext ctx)
    {
        var now = ctx.Timestamp.MicrosecondsSinceUnixEpoch;
        foreach (var old in ctx.Db.LinkCode.Iter().Where(c => c.ExpiresAt.MicrosecondsSinceUnixEpoch <= now).ToList())
            ctx.Db.LinkCode.Owner.Delete(old.Owner);
        ctx.Db.LinkCode.Owner.Delete(ctx.Sender);

        var secret = Encoding.UTF8.GetBytes(ctx.Env.PHOTON_WEBHOOK_SECRET ?? "");
        string code;
        var tries = 0;
        do
        {
            if (++tries > 50) throw new Exception("Could not make a code, try again");
            var noise = new byte[32];
            ctx.Rng.NextBytes(noise);
            var mix = Sha256.Hmac(secret, Encoding.UTF8.GetBytes($"{ctx.Sender}|{now}|{tries}|{Convert.ToHexString(noise)}"));
            var chars = new char[LinkCodeLength];
            for (var i = 0; i < LinkCodeLength; i++) chars[i] = CodeAlphabet[mix[i] % CodeAlphabet.Length];
            code = new string(chars);
        } while (ctx.Db.LinkCode.Code.Find(code) is not null);

        ctx.Db.LinkCode.Insert(new LinkCode { Owner = ctx.Sender, Code = code, ExpiresAt = new Timestamp(now + LinkCodeTtlMicros) });
    }

    // Remove all of the caller's messaging-app links (they can also text UNLINK).
    [SpacetimeDB.Reducer]
    public static void UnlinkChannels(ReducerContext ctx)
    {
        foreach (var l in ctx.Db.ChannelLink.Owner.Filter(ctx.Sender).ToList()) ctx.Db.ChannelLink.SenderKey.Delete(l.SenderKey);
        ctx.Db.LinkCode.Owner.Delete(ctx.Sender);
    }

    [SpacetimeDB.HttpRouter]
    public static Router Routes() => SpacetimeDB.Router.New().Post("/photon", Handlers.PhotonWebhook);

    [SpacetimeDB.HttpHandler]
    public static HttpResponse PhotonWebhook(HandlerContext ctx, HttpRequest request)
    {
        var secretText = Env.PHOTON_WEBHOOK_SECRET;
        if (string.IsNullOrEmpty(secretText)) return Respond(503, "webhook not configured");
        if (DecodeWebhookSecret(secretText) is not { } secret)
        {
            Log.Error("Photon: PHOTON_WEBHOOK_SECRET is not valid base64 (expected whsec_...)");
            return Respond(503, "webhook not configured");
        }

        var id = Header(request, "webhook-id");
        var ts = Header(request, "webhook-timestamp");
        var sigs = Header(request, "webhook-signature");
        var body = request.Body.ToBytes();
        var nowSec = ctx.Timestamp.MicrosecondsSinceUnixEpoch / 1_000_000;
        if (id.Length == 0 || id.Length > 200 || !long.TryParse(ts, out var tsSec) || Math.Abs(nowSec - tsSec) > WebhookToleranceSeconds
            || !SignatureMatches(secret, id, ts, body, sigs))
        {
            Log.Warn("Photon: rejected webhook (bad signature or timestamp)");
            return Respond(401, "invalid signature");
        }

        // From here on always 2xx: Photon must not retry something we already handled.
        var host = new HandlerBotHost(ctx);
        var fresh = host.Tx((db, now) =>
        {
            if (db.WebhookSeen.Id.Find(id) is not null) return false;
            db.WebhookSeen.Insert(new WebhookSeen { Id = id, SeenAt = now });
            if (db.WebhookSeen.Count > MaxWebhookSeen)
                foreach (var old in db.WebhookSeen.Iter().OrderBy(w => w.SeenAt.MicrosecondsSinceUnixEpoch).Take(MaxWebhookSeen / 4).ToList())
                    db.WebhookSeen.Id.Delete(old.Id);
            return true;
        });
        if (!fresh) return Respond(200, "duplicate");

        InboundMessage msg;
        try
        {
            if (ParseInbound(body) is not { } parsed) return Respond(200, "ignored");
            msg = parsed;
        }
        catch (Exception e)
        {
            Log.Warn($"Photon: could not parse event {id}: {e.GetType().Name}");
            return Respond(200, "ignored");
        }

        try
        {
            var reply = HandleInbound(ctx, host, msg);
            if (reply.Length > 0) SendChannelReply(host.Http, msg, reply, idempotencyKey: id);
        }
        catch (Exception e)
        {
            Log.Error($"Photon: handling {id} failed: {e.GetType().Name}: {e.Message}");
            try { SendChannelReply(host.Http, msg, BotApology, idempotencyKey: id); } catch (Exception) { }
        }
        return Respond(200, "ok");
    }

    readonly record struct InboundMessage(
        string ProjectId, string MessageId, string Platform, string SpaceId, string SenderUserId,
        string SenderHandle, string AgentUserId, string Text, string AttachmentId, bool HasVoice);

    // Pull what we need out of a message.received event. null = nothing to answer (other events, our own
    // outbound messages, group chats, read receipts / typing updates, ...).
    static InboundMessage? ParseInbound(byte[] body)
    {
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;
        if (Str(root, "type") != "message.received") return null;
        if (!root.TryGetProperty("data", out var data) || !data.TryGetProperty("object", out var obj)) return null;
        if (Str(obj, "status") != "received") return null;

        var platform = new string(Str(obj, "platform").ToLowerInvariant().Where(c => c is >= 'a' and <= 'z' or '_').Take(20).ToArray());
        var space = obj.TryGetProperty("space", out var sp) ? sp : default;
        var sentBy = obj.TryGetProperty("sentBy", out var sb) ? sb : default;
        var agent = obj.TryGetProperty("receivedBy", out var rb) ? rb : obj.TryGetProperty("addressedTo", out var at) ? at : default;
        var senderId = Str(sentBy, "id");
        var agentId = Str(agent, "id");
        if (platform.Length == 0 || senderId.Length == 0 || agentId.Length == 0 || Str(space, "id").Length == 0) return null;
        if (senderId == agentId || Str(sentBy, "kind") == "agent") return null; // our own messages
        if (Str(space, "kind") is "group") return null; // only 1:1 chats (shared lines can't answer groups anyway)

        var text = new StringBuilder();
        var attachmentId = "";
        var voice = false;
        void Part(JsonElement c)
        {
            switch (Str(c, "type"))
            {
                case "text": text.Append(text.Length > 0 ? "\n" : "").Append(Str(c, "text")); break;
                case "attachment": if (attachmentId.Length == 0) attachmentId = Str(c, "attachmentId"); break;
                case "voice": voice = true; break;
            }
        }
        if (obj.TryGetProperty("content", out var content))
        {
            if (Str(content, "type") == "group" && content.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
                foreach (var p in parts.EnumerateArray()) Part(p);
            else Part(content);
        }
        if (text.Length == 0 && attachmentId.Length == 0 && !voice) return null;

        return new InboundMessage(Str(data, "projectId"), Str(obj, "id"), platform, Str(space, "id"), senderId,
            Str(sentBy, "handle"), agentId, text.ToString().Trim(), attachmentId, voice);
    }

    // Returns the text to send back ("" = nothing).
    static string HandleInbound(HandlerContext ctx, HandlerBotHost host, InboundMessage msg)
    {
        var senderKey = $"{msg.Platform}:{msg.SenderUserId}";
        var pseudo = PseudoIdentity(msg.Platform, msg.SenderUserId);
        var text = msg.Text.Length > MaxBotTextChars ? msg.Text[..MaxBotTextChars] : msg.Text;
        var command = msg.AttachmentId.Length == 0 ? text.Trim().ToUpperInvariant() : "";

        // ---- Commands (no AI call) ----
        // "LINK ABC123" (also "link abc-123"); a longer text that merely starts with "link" is a normal message.
        if (System.Text.RegularExpressions.Regex.Match(command, @"^LINK[\s:]+([A-Z0-9][A-Z0-9 \-]{0,10})$") is { Success: true } link)
            return host.Tx((db, now) => LinkSender(db, now, senderKey, pseudo, msg, link.Groups[1].Value));
        if (command == "UNLINK")
            return host.Tx((db, now) =>
            {
                if (db.ChannelLink.SenderKey.Find(senderKey) is null) return "This chat isn't linked to a Security Arcade account.";
                db.ChannelLink.SenderKey.Delete(senderKey);
                return "Unlinked. I'll keep chatting with you here, but separately from your Security Arcade account.";
            });
        if (command is "FORGET ME" or "FORGETME")
            return host.Tx((db, now) =>
            {
                var owner = db.ChannelLink.SenderKey.Find(senderKey)?.Owner ?? pseudo;
                ForgetAll(db, owner);
                ForgetAll(db, pseudo);
                db.ChannelLink.SenderKey.Delete(senderKey);
                return "Done. I deleted our conversation and everything I remembered about you.";
            });

        if (msg.HasVoice && text.Length == 0 && msg.AttachmentId.Length == 0)
            return "I can't listen to voice notes yet. Please type your question, paste the message, or send a screenshot.";
        if (LoadAiConfig() is not { } cfg) return "Sorry, I'm not set up to answer right now. Please try again later.";

        // ---- Screenshot: download once, never store (skip the download when already over budget) ----
        var imageDataUrl = "";
        if (msg.AttachmentId.Length > 0)
        {
            if (host.Tx((db, now) => TakeChannelBudget(db, senderKey, now, consume: false)) is { } busy) return busy;
            var (dataUrl, problem) = FetchAttachmentDataUrl(host.Http, msg);
            if (problem.Length > 0) return problem;
            imageDataUrl = dataUrl;
        }
        if (host.Tx((db, now) => TakeChannelBudget(db, senderKey, now, consume: true)) is { } over) return over;

        var owner = host.Tx((db, _) => db.ChannelLink.SenderKey.Find(senderKey)?.Owner ?? pseudo);
        // Time left for the model: the webhook must finish in ~15 s (Photon times out at 20 s), and the
        // reply still has to be sent. The fallback model only gets a turn when there's room.
        var elapsed = host.Tx((_, now) => now.MicrosecondsSinceUnixEpoch) - ctx.Timestamp.MicrosecondsSinceUnixEpoch;
        var left = TimeSpan.FromMilliseconds(Math.Max(2_000, (WebhookBudgetMicros - elapsed) / 1000 - 2_500));
        var first = left > TimeSpan.FromSeconds(9) ? TimeSpan.FromSeconds(9) : left;
        var fallback = left - first > TimeSpan.FromSeconds(3) ? left - first : TimeSpan.Zero;

        var turn = RunBotTurn(host, cfg, owner, msg.Platform, text, imageDataUrl, first, fallback, cooldown: false);
        if (!turn.Stored) return "One message at a time, please. Send that again in a few seconds.";
        if (!turn.Ai.Ok) return BotApology;
        return FormatChannelReply(turn.Reply);
    }

    // Per-sender rolling budget for messaging AI turns. null = go ahead (a turn is recorded when `consume`);
    // otherwise the reply to send: ChannelBusyReply once per over-budget streak, then "" (stay quiet).
    static string? TakeChannelBudget(Local db, string senderKey, Timestamp now, bool consume)
    {
        var t = now.MicrosecondsSinceUnixEpoch;
        var row = db.ChannelAiUsage.SenderKey.Find(senderKey);
        var recent = (row?.RecentMicros ?? new()).Where(x => t - x < ChannelAiWindowMicros).ToList();
        if (recent.Count >= MaxChannelAiTurns)
        {
            var notified = row?.Notified ?? false;
            Save(new ChannelAiUsage { SenderKey = senderKey, RecentMicros = recent, Notified = true });
            return notified ? "" : ChannelBusyReply;
        }
        if (consume)
        {
            recent.Add(t);
            Save(new ChannelAiUsage { SenderKey = senderKey, RecentMicros = recent, Notified = false });
        }
        return null;

        void Save(ChannelAiUsage u)
        {
            if (row is null) db.ChannelAiUsage.Insert(u); else db.ChannelAiUsage.SenderKey.Update(u);
        }
    }

    static string LinkSender(Local db, Timestamp now, string senderKey, Identity pseudo, InboundMessage msg, string arg)
    {
        var code = new string(arg.Where(char.IsLetterOrDigit).ToArray());
        if (db.LinkAttempt.SenderKey.Find(senderKey) is { } a)
        {
            if (now.MicrosecondsSinceUnixEpoch - a.WindowStart.MicrosecondsSinceUnixEpoch > FailedLinkWindowMicros)
                db.LinkAttempt.SenderKey.Delete(senderKey);
            else if (a.Failures >= MaxFailedLinks)
                return "Too many wrong codes. Wait 10 minutes, then make a new code in the app and try again.";
        }

        if (code.Length != LinkCodeLength || db.LinkCode.Code.Find(code) is not { } found
            || found.ExpiresAt.MicrosecondsSinceUnixEpoch <= now.MicrosecondsSinceUnixEpoch)
        {
            if (db.LinkAttempt.SenderKey.Find(senderKey) is { } f) db.LinkAttempt.SenderKey.Update(f with { Failures = f.Failures + 1 });
            else db.LinkAttempt.Insert(new LinkAttempt { SenderKey = senderKey, Failures = 1, WindowStart = now });
            return "That code didn't work. Codes are 6 characters and expire after 10 minutes. " +
                "In the Security Arcade app, open Help Bot → ⋯ → Link iMessage for a new one.";
        }

        var player = found.Owner;
        db.LinkCode.Owner.Delete(player);
        db.LinkAttempt.SenderKey.Delete(senderKey);
        db.ChannelLink.SenderKey.Delete(senderKey);
        db.ChannelLink.Insert(new ChannelLink
        {
            SenderKey = senderKey,
            Owner = player,
            Platform = msg.Platform,
            HandleHint = MaskHandle(msg.SenderHandle),
            CreatedAt = now,
        });
        // Bring along what this sender said before linking (it's the same person: they had the code).
        foreach (var m in db.ChatMessage.Owner.Filter(pseudo).ToList()) db.ChatMessage.Id.Update(m with { Owner = player });
        var facts = db.MemoryFact.Owner.Filter(pseudo).ToList();
        foreach (var f in facts) db.MemoryFact.Id.Delete(f.Id);
        UpsertFacts(db, player, facts.Select(f => f.Fact).ToList(), now);
        return "Linked! Your chats here now share your Security Arcade history and game progress, and show up in the app. " +
            "Text UNLINK to undo.";
    }

    // Plain text for messaging apps (no cards): verdict line, reply, up to 3 red flags, one next step.
    static string FormatChannelReply(BotReply r)
    {
        var sb = new StringBuilder();
        var verdict = r.Verdict switch
        {
            "scam" => "🚩 SCAM",
            "suspicious" => "⚠️ Suspicious",
            "likely_safe" => "✅ Looks safe",
            _ => "",
        };
        if (verdict.Length > 0) sb.Append(verdict).Append('\n');
        sb.Append(Trim(r.Reply, 700));
        if (verdict.Length > 0)
        {
            foreach (var f in r.RedFlags.Take(3)) sb.Append("\n• ").Append(Trim(f, 120));
            if (r.NextSteps.Count > 0) sb.Append("\nNext: ").Append(Trim(r.NextSteps[0], 160));
        }
        return Trim(sb.ToString(), MaxChannelReplyChars);
    }

    // ---------- Photon REST ----------

    static string PhotonBaseUrl() =>
        (string.IsNullOrEmpty(Env.PHOTON_BASE_URL) ? DefaultPhotonBaseUrl : Env.PHOTON_BASE_URL!).TrimEnd('/');

    static string PhotonProject(InboundMessage msg) =>
        string.IsNullOrEmpty(Env.PHOTON_PROJECT_ID) ? msg.ProjectId : Env.PHOTON_PROJECT_ID!;

    static void SendChannelReply(SpacetimeDB.HttpClient http, InboundMessage msg, string text, string idempotencyKey)
    {
        var key = Env.PHOTON_API_KEY;
        var project = PhotonProject(msg);
        if (string.IsNullOrEmpty(key) || project.Length == 0)
        {
            Log.Warn("Photon: PHOTON_API_KEY or project id missing; can't send the reply");
            return;
        }
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteString("spaceId", msg.SpaceId);
            w.WriteString("senderId", msg.AgentUserId); // our line: the inbound message's receivedBy
            w.WriteStartObject("content");
            w.WriteString("type", "text");
            w.WriteString("format", "plain");
            w.WriteString("text", text);
            w.WriteEndObject();
            w.WriteEndObject();
        }
        var result = http.Send(new HttpRequest
        {
            Uri = $"{PhotonBaseUrl()}/v1/projects/{Uri.EscapeDataString(project)}/messages",
            Method = SpacetimeDB.HttpMethod.Post,
            Timeout = TimeSpan.FromSeconds(4),
            Headers = new()
            {
                new HttpHeader("content-type", "application/json"),
                new HttpHeader("authorization", Encoding.UTF8.GetBytes($"Bearer {key}"), true),
                new HttpHeader("idempotency-key", idempotencyKey),
            },
            Body = new HttpBody(stream.ToArray()),
        });
        result.Match(
            response =>
            {
                if (response.StatusCode is < 200 or >= 300)
                    Log.Warn($"Photon: send failed HTTP {response.StatusCode}: {Trim(response.Body.ToStringUtf8Lossy(), 300)}");
                return 0;
            },
            error => { Log.Warn($"Photon: send failed: {error.Message}"); return 0; });
    }

    // One attempt (Photon itself waits up to ~10 s for the bytes). Returns (dataUrl, "") or ("", reply to send).
    static (string, string) FetchAttachmentDataUrl(SpacetimeDB.HttpClient http, InboundMessage msg)
    {
        var key = Env.PHOTON_API_KEY;
        var project = PhotonProject(msg);
        if (string.IsNullOrEmpty(key) || project.Length == 0) return ("", "Sorry, I can't open pictures right now. Please paste the text instead.");
        var result = http.Send(new HttpRequest
        {
            Uri = $"{PhotonBaseUrl()}/v1/projects/{Uri.EscapeDataString(project)}/attachments/{Uri.EscapeDataString(msg.AttachmentId)}/content",
            Method = SpacetimeDB.HttpMethod.Get,
            Timeout = TimeSpan.FromSeconds(6),
            Headers = new() { new HttpHeader("authorization", Encoding.UTF8.GetBytes($"Bearer {key}"), true) },
            Body = HttpBody.FromString(""),
        });
        return result.Match(
            response =>
            {
                if (response.StatusCode == 409) return ("", "Got your screenshot; send it again in a few seconds.");
                if (response.StatusCode != 200)
                {
                    Log.Warn($"Photon: attachment download HTTP {response.StatusCode}");
                    return ("", "Sorry, I couldn't open that picture. Try sending it again, or paste the text.");
                }
                // Video, audio, PDF, ...: say what we can read instead of calling the model.
                var declared = NormalizeMime(Header(response.Headers, "content-type"));
                if (declared.Length > 0 && !ChannelImageMimes.Contains(declared)) return ("", NotAScreenshotReply);
                var bytes = response.Body.ToBytes();
                if (bytes.Length == 0) return ("", NotAScreenshotReply);
                if (bytes.Length > MaxAttachmentBytes) return ("", "That picture is too big for me. Try a screenshot instead (under 8 MB).");
                // Prefer what the bytes say; with no usable Content-Type, the bytes must be a known image.
                var sniffed = SniffImageMime(bytes);
                var mime = sniffed.Length > 0 ? sniffed : declared;
                if (mime.Length == 0) return ("", NotAScreenshotReply);
                return ($"data:{mime};base64,{Convert.ToBase64String(bytes)}", "");
            },
            error => ("", "Got your screenshot; send it again in a few seconds."));
    }

    // Magic bytes of the image types we accept (ChannelImageMimes); "" for anything else.
    static string SniffImageMime(byte[] b)
    {
        bool At(int off, string ascii) => b.Length >= off + ascii.Length && ascii.Select((c, i) => b[off + i] == c).All(x => x);
        if (b.Length > 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return "image/jpeg";
        if (b.Length > 8 && b[0] == 0x89 && At(1, "PNG")) return "image/png";
        if (At(0, "RIFF") && At(8, "WEBP")) return "image/webp";
        if (At(4, "ftyp") && (At(8, "heic") || At(8, "heix") || At(8, "heim") || At(8, "heis"))) return "image/heic";
        if (At(4, "ftyp") && (At(8, "mif1") || At(8, "msf1") || At(8, "heif"))) return "image/heif";
        return "";
    }

    // "Image/JPEG; charset=..." -> "image/jpeg"; generic binary types count as missing ("").
    static string NormalizeMime(string contentType)
    {
        var m = contentType.Split(';')[0].Trim().ToLowerInvariant();
        if (m == "image/jpg") return "image/jpeg";
        return m is "application/octet-stream" or "binary/octet-stream" ? "" : m;
    }

    // ---------- Helpers ----------

    // A stable identity for an unlinked sender, derived from platform + Photon user id. The first two bytes
    // are a fixed 0xB07C tag (real SpacetimeDB identities start with 0xC200), so it can't collide with a
    // player; the rest is SHA-256 of a versioned, domain-separated string.
    static Identity PseudoIdentity(string platform, string senderUserId)
    {
        var bytes = Sha256.Hash(Encoding.UTF8.GetBytes($"help-bot/channel-sender/v1\n{platform}\n{senderUserId}"));
        bytes[0] = 0xB0;
        bytes[1] = 0x7C;
        return Identity.FromBigEndian(bytes);
    }

    static string MaskHandle(string handle)
    {
        handle = handle.Trim();
        if (handle.Contains('@')) return handle.Length > 0 ? $"{handle[0]}•••@{handle.Split('@').Last()}" : "";
        var digits = new string(handle.Where(char.IsDigit).ToArray());
        return digits.Length >= 4 ? $"•••{digits[^4..]}" : "";
    }

    static byte[]? DecodeWebhookSecret(string secret)
    {
        var s = secret.Trim();
        if (s.StartsWith("whsec_", StringComparison.Ordinal)) s = s[6..];
        try { var key = Convert.FromBase64String(s); return key.Length > 0 ? key : null; }
        catch (FormatException) { return null; }
    }

    static bool SignatureMatches(byte[] secret, string id, string ts, byte[] body, string signatures)
    {
        var prefix = Encoding.UTF8.GetBytes($"{id}.{ts}.");
        var signed = new byte[prefix.Length + body.Length];
        prefix.CopyTo(signed, 0);
        body.CopyTo(signed, prefix.Length);
        var expected = Sha256.Hmac(secret, signed);
        foreach (var sig in signatures.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (!sig.StartsWith("v1,", StringComparison.Ordinal)) continue;
            byte[] given;
            try { given = Convert.FromBase64String(sig[3..]); } catch (FormatException) { continue; }
            if (Sha256.FixedTimeEquals(given, expected)) return true;
        }
        return false;
    }

    static string Header(HttpRequest request, string name) => Header(request.Headers, name);

    static string Header(IEnumerable<HttpHeader> headers, string name)
    {
        foreach (var h in headers)
            if (string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase)) return Encoding.UTF8.GetString(h.Value).Trim();
        return "";
    }

    static string Str(JsonElement el, string name) =>
        el.ValueKind == JsonValueKind.Object && el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    static HttpResponse Respond(ushort status, string text) =>
        new(status, HttpVersion.Http11, new() { new HttpHeader("content-type", "text/plain") }, HttpBody.FromString(text));
}
