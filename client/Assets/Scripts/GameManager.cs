using System;
using SpacetimeDB;
using SpacetimeDB.Types;
using UnityEngine;

// Drop on an empty GameObject in your first scene. The SDK's SpacetimeDBNetworkManager
// ticks the connection automatically; you don't need to call FrameTick yourself.
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
    }

    void Start()
    {
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
