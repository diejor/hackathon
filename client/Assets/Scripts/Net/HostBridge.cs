using System.Runtime.InteropServices;
using UnityEngine;

// Talks to the web page that embeds this WebGL build in an <iframe>.
//
//   Unity -> page: window.parent.postMessage({ source: "security-arcade", type: "state", ... }, parentOrigin)
//   page -> Unity: iframe.contentWindow.postMessage({ type: "setName", name: "Ada" }, gameOrigin)
//
// Secure by default: nothing is sent or accepted unless the iframe URL has ?parentOrigin=https://host.example
// (exact origin, no wildcard). The incoming side is enforced in WebGLTemplates/Mobile/index.html.
public static class HostBridge
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")] static extern void HostBridge_Post(string json, string targetOrigin);
#else
    static void HostBridge_Post(string json, string targetOrigin) { }
#endif

    static string _lastSent;

    public static void PublishState()
    {
        var origin = UrlParams.Get("parentOrigin");
        if (string.IsNullOrEmpty(origin) || origin == "*") return;

        var room = Lobby.MyRoom;
        var json = "{\"source\":\"security-arcade\",\"type\":\"state\"" +
                   $",\"screen\":\"{Lobby.CurrentScreen}\"" +
                   $",\"room\":{(room != null ? Quote(room.Code) : "null")}" +
                   $",\"game\":{(room != null && room.Game != "" ? Quote(room.Game) : "null")}" +
                   $",\"players\":{Lobby.Members.Count}" +
                   $",\"name\":{Quote(Lobby.MyName)}}}";
        if (json == _lastSent) return;
        _lastSent = json;
        HostBridge_Post(json, origin);
    }

    static string Quote(string s) =>
        "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", " ").Replace("\r", " ") + "\"";
}
