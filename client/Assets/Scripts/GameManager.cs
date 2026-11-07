using System;
using SpacetimeDB;
using SpacetimeDB.Types;
using UnityEngine;

// Drop on an empty GameObject in your first scene. It adds the SDK's SpacetimeDBNetworkManager
// (which ticks the connection) to the same GameObject, so you don't call FrameTick yourself.
public class GameManager : MonoBehaviour
{
    [SerializeField] string serverUri = "ws://127.0.0.1:3001";
    [SerializeField] string databaseName = "hackathon";

    public static GameManager Instance { get; private set; }
    public static DbConnection Conn { get; private set; }
    public static Identity LocalIdentity { get; private set; }

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);
        Application.runInBackground = true; // keep ticking when testing 2 clients side by side

        // The SDK only ticks connections (and, on WebGL, parses messages) via this component.
        // It must exist before DbConnection.Builder().Build() runs.
        if (FindFirstObjectByType<SpacetimeDBNetworkManager>() == null)
            gameObject.AddComponent<SpacetimeDBNetworkManager>();
    }

    void Start()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        // Override from the page URL, e.g. index.html?server=wss://maincloud.spacetimedb.com&db=hackathon
        var query = new System.Uri(Application.absoluteURL).Query.TrimStart('?').Split('&');
        foreach (var kv in query)
        {
            var parts = kv.Split('=', 2);
            if (parts.Length != 2) continue;
            var value = System.Uri.UnescapeDataString(parts[1]);
            if (parts[0] == "server") serverUri = value;
            else if (parts[0] == "db") databaseName = value;
        }
#endif
        Conn = DbConnection.Builder()
            .WithUri(serverUri)
            .WithDatabaseName(databaseName)
            .WithToken(string.IsNullOrEmpty(AuthToken.Token) ? null : AuthToken.Token)
            .OnConnect(OnConnected)
            .OnConnectError(err => Debug.LogError($"[STDB] connect error: {err}"))
            .OnDisconnect((_, err) => Debug.LogWarning($"[STDB] disconnected: {err}"))
            .Build();
    }

    void OnConnected(DbConnection conn, Identity identity, string token)
    {
        AuthToken.SaveToken(token);
        LocalIdentity = identity;
        Debug.Log($"[STDB] connected as {identity}");

        // Row callbacks: register before subscribing.
        conn.Db.Person.OnInsert += (ctx, row) => Debug.Log($"[STDB] person inserted: {row.Name}");

        conn.SubscriptionBuilder()
            .OnApplied(ctx =>
            {
                Debug.Log($"[STDB] subscribed, {ctx.Db.Person.Count} people in cache");
                conn.Reducers.Add($"unity-{UnityEngine.Random.Range(0, 9999)}"); // smoke test
            })
            .OnError((_, err) => Debug.LogError($"[STDB] subscription error: {err}"))
            .SubscribeToAllTables(); // fine for a hackathon; narrow with AddQuery later if needed
    }

    void OnApplicationQuit() => Conn?.Disconnect();
}
