#pragma warning disable STDB_UNSTABLE // procedures + outbound HTTP are marked unstable in SpacetimeDB 2.x
using System.Text;
using System.Text.Json;
using SpacetimeDB;

// Secrets live in the database environment (supplied at publish time, never in source or clients).
// Publish with: NVIDIA_API_KEY=... scripts/publish.sh   (scripts load it from the gitignored .env file)
[SpacetimeDB.Env]
public partial struct EnvironmentSchema
{
    public string? NVIDIA_API_KEY;
    public string? NVIDIA_MODEL; // optional override, e.g. "nvidia/nemotron-3.5-lightning-30b-a3b"
}

public static partial class Module
{
    const string NvidiaBase = "https://integrate.api.nvidia.com/v1";
    const string DefaultModel = "nvidia/nemotron-3-super-120b-a12b";
    const int MaxPromptChars = 4000;
    const long AiCooldownMicros = 3_000_000; // one AI call per player every 3 s (protects API credits)

    // Per-identity rate limit for AI calls. Private.
    [SpacetimeDB.Table(Accessor = "AiUsage")]
    public partial struct AiUsage
    {
        [PrimaryKey] public Identity Identity;
        public Timestamp LastCall;
        public uint Calls;
    }

    [SpacetimeDB.Type]
    public partial struct AiResult
    {
        public bool Ok;
        public string Text;   // model reply, or error message
        public string Model;
        public uint LatencyMs;
    }

    // Connectivity check, no key needed: lists NVIDIA's hosted models and returns the Nemotron ones.
    [SpacetimeDB.Procedure]
    public static AiResult AiPing(ProcedureContext ctx)
    {
        var started = ctx.Timestamp;
        var result = ctx.Http.Get($"{NvidiaBase}/models");
        return result.Match(
            response =>
            {
                var body = response.Body.ToStringUtf8Lossy();
                if (response.StatusCode != 200)
                    return Fail($"HTTP {response.StatusCode}: {Trim(body, 300)}");
                using var doc = JsonDocument.Parse(body);
                var ids = new List<string>();
                foreach (var m in doc.RootElement.GetProperty("data").EnumerateArray())
                {
                    var id = m.GetProperty("id").GetString() ?? "";
                    if (id.Contains("nemotron", StringComparison.OrdinalIgnoreCase)) ids.Add(id);
                }
                return new AiResult { Ok = true, Text = string.Join("\n", ids), Model = "", LatencyMs = 0 };
            },
            error => Fail($"HTTP error: {error.Message}"));
    }

    // Send one prompt to Nemotron. Rate-limited per identity; key never leaves the server.
    [SpacetimeDB.Procedure]
    public static AiResult AiAsk(ProcedureContext ctx, string system, string prompt)
    {
        if (string.IsNullOrWhiteSpace(prompt)) return Fail("Empty prompt");
        if (prompt.Length > MaxPromptChars || (system ?? "").Length > MaxPromptChars) return Fail("Prompt too long");

        var key = ctx.Env.NVIDIA_API_KEY;
        if (string.IsNullOrEmpty(key)) return Fail("AI is not configured on the server (NVIDIA_API_KEY missing)");
        var model = string.IsNullOrEmpty(ctx.Env.NVIDIA_MODEL) ? DefaultModel : ctx.Env.NVIDIA_MODEL!;

        // Rate limit (short transaction before any network I/O).
        var sender = ctx.Sender;
        var now = ctx.Timestamp;
        var allowed = ctx.WithTx(tx =>
        {
            var usage = tx.Db.AiUsage.Identity.Find(sender);
            if (usage is { } u && now.MicrosecondsSinceUnixEpoch - u.LastCall.MicrosecondsSinceUnixEpoch < AiCooldownMicros)
                return false;
            if (usage is { } existing) tx.Db.AiUsage.Identity.Update(existing with { LastCall = now, Calls = existing.Calls + 1 });
            else tx.Db.AiUsage.Insert(new AiUsage { Identity = sender, LastCall = now, Calls = 1 });
            return true;
        });
        if (!allowed) return Fail("Slow down a little — try again in a few seconds");

        var payload = ChatPayload(model, system ?? "", prompt);
        var result = ctx.Http.Send(new HttpRequest
        {
            Uri = $"{NvidiaBase}/chat/completions",
            Method = SpacetimeDB.HttpMethod.Post,
            Headers = new()
            {
                new HttpHeader("content-type", "application/json"),
                new HttpHeader("accept", "application/json"),
                new HttpHeader("authorization", $"Bearer {key}"),
            },
            Body = HttpBody.FromString(payload),
        });

        return result.Match(
            response =>
            {
                var body = response.Body.ToStringUtf8Lossy();
                if (response.StatusCode != 200)
                {
                    Log.Warn($"AiAsk HTTP {response.StatusCode}: {Trim(body, 500)}");
                    return Fail($"AI service error (HTTP {response.StatusCode})");
                }
                using var doc = JsonDocument.Parse(body);
                var text = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
                return new AiResult { Ok = true, Text = text.Trim(), Model = model, LatencyMs = 0 };
            },
            error => Fail($"AI request failed: {error.Message}"));
    }

    static string ChatPayload(string model, string system, string prompt)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteString("model", model);
            w.WriteNumber("temperature", 0.6);
            w.WriteNumber("max_tokens", 600);
            w.WriteStartArray("messages");
            if (system.Length > 0)
            {
                w.WriteStartObject(); w.WriteString("role", "system"); w.WriteString("content", system); w.WriteEndObject();
            }
            w.WriteStartObject(); w.WriteString("role", "user"); w.WriteString("content", prompt); w.WriteEndObject();
            w.WriteEndArray();
            w.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    static AiResult Fail(string message) => new() { Ok = false, Text = message, Model = "", LatencyMs = 0 };

    static string Trim(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
