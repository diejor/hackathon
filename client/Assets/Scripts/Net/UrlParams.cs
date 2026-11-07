using System;
using System.Collections.Generic;
using UnityEngine;

// Query-string parameters of the page the WebGL build runs in (the iframe URL when embedded).
// Supported: server, db, room, name, joinUrl, parentOrigin. Empty in the editor / native builds.
public static class UrlParams
{
    static Dictionary<string, string> _values;

    public static string Get(string key)
    {
        if (_values == null) Parse();
        return _values.TryGetValue(key, out var v) ? v : null;
    }

    // The page URL without query/hash, or null when not running in a browser.
    public static string PageBase
    {
        get
        {
            var url = Application.absoluteURL;
            if (string.IsNullOrEmpty(url) || !url.StartsWith("http")) return null;
            var cut = url.IndexOfAny(new[] { '?', '#' });
            return cut >= 0 ? url.Substring(0, cut) : url;
        }
    }

    static void Parse()
    {
        _values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var url = Application.absoluteURL;
        if (string.IsNullOrEmpty(url)) return;
        var q = url.IndexOf('?');
        if (q < 0) return;
        var query = url.Substring(q + 1);
        var hash = query.IndexOf('#');
        if (hash >= 0) query = query.Substring(0, hash);
        foreach (var pair in query.Split('&'))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length != 2 || parts[0].Length == 0) continue;
            _values[Uri.UnescapeDataString(parts[0])] = Uri.UnescapeDataString(parts[1].Replace('+', ' '));
        }
    }
}
