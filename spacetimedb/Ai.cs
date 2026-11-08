#pragma warning disable STDB_UNSTABLE // procedures + outbound HTTP are marked unstable in SpacetimeDB 2.x
using System.Text;
using System.Text.Json;
using SpacetimeDB;

// Provider-neutral AI access over the OpenAI-compatible "chat completions" API.
// Default provider: Google Gemini (https://generativelanguage.googleapis.com/v1beta/openai).
// Secrets live in the database environment (supplied at publish time from the gitignored .env,
// never in source or clients). Switch provider by changing AI_BASE_URL / AI_API_KEY / AI_MODEL.
[SpacetimeDB.Env]
public partial struct EnvironmentSchema
{
    public string? AI_API_KEY;
    public string? AI_BASE_URL;     // default: Gemini's OpenAI-compatible endpoint
    public string? AI_MODEL;        // chat model id (run ai_ping to list what your key can use)
    public string? AI_VISION_MODEL; // model for screenshots; defaults to AI_MODEL
    public string? AI_FALLBACK_MODEL; // used once if the main model is overloaded (5xx/429)
}

public static partial class Module
{
    const string DefaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    const string DefaultModel = "gemini-3.5-flash";          // accurate, ~3 s
    const string DefaultFallbackModel = "gemini-3.5-flash-lite"; // ~1 s, used when the main model is overloaded
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

    readonly record struct AiConfig(string Key, string BaseUrl, string Model, string VisionModel, string FallbackModel);

    static AiConfig? LoadAiConfig(ProcedureContext ctx)
    {
        var key = ctx.Env.AI_API_KEY;
        if (string.IsNullOrEmpty(key)) return null;
        var baseUrl = (string.IsNullOrEmpty(ctx.Env.AI_BASE_URL) ? DefaultBaseUrl : ctx.Env.AI_BASE_URL!).TrimEnd('/');
        var model = string.IsNullOrEmpty(ctx.Env.AI_MODEL) ? DefaultModel : ctx.Env.AI_MODEL!;
        var vision = string.IsNullOrEmpty(ctx.Env.AI_VISION_MODEL) ? model : ctx.Env.AI_VISION_MODEL!;
        var fallback = string.IsNullOrEmpty(ctx.Env.AI_FALLBACK_MODEL) ? DefaultFallbackModel : ctx.Env.AI_FALLBACK_MODEL!;
        return new AiConfig(key, baseUrl, model, vision, fallback);
    }

    // Connectivity + key check: lists the models this key can use.
    [SpacetimeDB.Procedure]
    public static AiResult AiPing(ProcedureContext ctx)
    {
        if (LoadAiConfig(ctx) is not { } cfg) return NotConfigured();
        var result = ctx.Http.Send(new HttpRequest
        {
            Uri = $"{cfg.BaseUrl}/models",
            Method = SpacetimeDB.HttpMethod.Get,
            Headers = new() { new HttpHeader("authorization", $"Bearer {cfg.Key}") },
            Body = HttpBody.FromString(""),
        });
        return result.Match(
            response =>
            {
                var body = response.Body.ToStringUtf8Lossy();
                if (response.StatusCode != 200) return Fail($"HTTP {response.StatusCode}: {Trim(body, 300)}");
                using var doc = JsonDocument.Parse(body);
                var ids = doc.RootElement.GetProperty("data").EnumerateArray()
                    .Select(m => m.GetProperty("id").GetString() ?? "")
                    .Where(id => id.Length > 0)
                    .ToList();
                return new AiResult { Ok = true, Text = string.Join("\n", ids), Model = cfg.Model, LatencyMs = 0 };
            },
            error => Fail($"HTTP error: {error.Message}"));
    }

    // Send one prompt. Rate-limited per identity; the key never leaves the server.
    [SpacetimeDB.Procedure]
    public static AiResult AiAsk(ProcedureContext ctx, string system, string prompt)
    {
        if (string.IsNullOrWhiteSpace(prompt)) return Fail("Empty prompt");
        if (prompt.Length > MaxPromptChars || (system ?? "").Length > MaxPromptChars) return Fail("Prompt too long");
        if (LoadAiConfig(ctx) is not { } cfg) return NotConfigured();
        if (!TakeAiQuota(ctx)) return Fail("Slow down a little — try again in a few seconds");
        return Complete(ctx, cfg, cfg.Model, m => ChatPayload(m, system ?? "", prompt));
    }

    // Rate limit: a short transaction before any network I/O.
    static bool TakeAiQuota(ProcedureContext ctx)
    {
        var sender = ctx.Sender;
        var now = ctx.Timestamp;
        return ctx.WithTx(tx =>
        {
            var usage = tx.Db.AiUsage.Identity.Find(sender);
            if (usage is { } u && now.MicrosecondsSinceUnixEpoch - u.LastCall.MicrosecondsSinceUnixEpoch < AiCooldownMicros)
                return false;
            if (usage is { } existing) tx.Db.AiUsage.Identity.Update(existing with { LastCall = now, Calls = existing.Calls + 1 });
            else tx.Db.AiUsage.Insert(new AiUsage { Identity = sender, LastCall = now, Calls = 1 });
            return true;
        });
    }

    // Calls the model; if it's overloaded (429/5xx), retries once with the fallback model.
    static AiResult Complete(ProcedureContext ctx, AiConfig cfg, string model, Func<string, string> payloadFor)
    {
        var first = CompleteOnce(ctx, cfg, model, payloadFor(model), TimeSpan.FromSeconds(12), out var retryable);
        if (first.Ok || !retryable || cfg.FallbackModel == model) return first;
        Log.Info($"AI: {model} unavailable, falling back to {cfg.FallbackModel}");
        return CompleteOnce(ctx, cfg, cfg.FallbackModel, payloadFor(cfg.FallbackModel), TimeSpan.FromSeconds(20), out _);
    }

    static AiResult CompleteOnce(ProcedureContext ctx, AiConfig cfg, string model, string payload, TimeSpan timeout, out bool retryable)
    {
        var overloaded = false;
        var result = ctx.Http.Send(new HttpRequest
        {
            Uri = $"{cfg.BaseUrl}/chat/completions",
            Method = SpacetimeDB.HttpMethod.Post,
            Timeout = timeout,
            Headers = new()
            {
                new HttpHeader("content-type", "application/json"),
                new HttpHeader("authorization", $"Bearer {cfg.Key}"),
            },
            Body = HttpBody.FromString(payload),
        });
        var outcome = result.Match(
            response =>
            {
                var body = response.Body.ToStringUtf8Lossy();
                if (response.StatusCode != 200)
                {
                    overloaded = response.StatusCode == 429 || response.StatusCode >= 500;
                    Log.Warn($"AI HTTP {response.StatusCode} ({model}): {Trim(System.Text.RegularExpressions.Regex.Replace(body, @"\s+", " "), 600)}");
                    return Fail($"AI service error (HTTP {response.StatusCode})");
                }
                using var doc = JsonDocument.Parse(body);
                var text = doc.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";
                return new AiResult { Ok = true, Text = text.Trim(), Model = model, LatencyMs = 0 };
            },
            error => { overloaded = true; return Fail($"AI request failed: {error.Message}"); });
        retryable = overloaded;
        return outcome;
    }

    static string ChatPayload(string model, string system, string prompt)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteString("model", model);
            w.WriteNumber("temperature", 0.6);
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

    static AiResult NotConfigured() => Fail("AI is not configured on the server (AI_API_KEY missing)");
    static AiResult Fail(string message) => new() { Ok = false, Text = message, Model = "", LatencyMs = 0 };
    static string Trim(string s, int max) => s.Length <= max ? s : s[..max] + "…";
}
