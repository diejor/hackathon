using System;
using SpacetimeDB;
using SpacetimeDB.Types;
using UnityEngine;
using UnityEngine.InputSystem;

// Owns the SpacetimeDB connection and feeds the Lobby store. Auto-spawns on Play (any scene);
// place one in a scene to override serverUri/databaseName in the Inspector.
// It adds the SDK's SpacetimeDBNetworkManager (which ticks the connection) to the same GameObject.
public class GameManager : MonoBehaviour
{
    // Defaults to the shared Maincloud db. For local dev, place a GameManager in your scene and set
    // serverUri = ws://127.0.0.1:3001, databaseName = hackathon-local (or use ?server=&db= on WebGL).
    [SerializeField] string serverUri = "wss://maincloud.spacetimedb.com";
    [SerializeField] string databaseName = "hackathon-1aa18263";
    [Tooltip("Base URL put in room QR codes when it can't be derived from the page (editor/native) and no ?joinUrl= is given.")]
    [SerializeField] string fallbackJoinUrl = "https://diejor.github.io/hackathon/";

    public static GameManager Instance { get; private set; }
    public static DbConnection Conn { get; private set; }
    public static Identity LocalIdentity { get; private set; }
    public string FallbackJoinUrl => fallbackJoinUrl;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Bootstrap()
    {
        if (FindFirstObjectByType<GameManager>() == null)
            new GameObject("GameManager").AddComponent<GameManager>();
    }

    void Awake()
    {
        if (Instance != null) { Destroy(gameObject); return; }
        Instance = this;
        gameObject.name = "GameManager"; // HostBridge (WebGL) sends messages to this name
        DontDestroyOnLoad(gameObject);
        Application.runInBackground = true;

        if (FindFirstObjectByType<SpacetimeDBNetworkManager>() == null)
            gameObject.AddComponent<SpacetimeDBNetworkManager>();
    }

    void Start()
    {
        if (UrlParams.Get("server") is { Length: > 0 } s) serverUri = s;
        if (UrlParams.Get("db") is { Length: > 0 } d) databaseName = d;
        Lobby.Init();
        Lobby.Changed += HostBridge.PublishState;

        Conn = DbConnection.Builder()
            .WithUri(serverUri)
            .WithDatabaseName(databaseName)
            .WithToken(string.IsNullOrEmpty(AuthToken.Token) ? null : AuthToken.Token)
            .WithAutomaticReconnect()
            .OnConnect(OnConnected)
            .OnAutomaticReconnect((conn, identity, token) =>
            {
                Debug.Log("[STDB] reconnected");
                LocalIdentity = identity;
                Lobby.OnConnected();
            })
            .OnConnectError(err =>
            {
                Debug.LogError($"[STDB] connect error: {err}");
                Lobby.OnDisconnected(err.Message);
            })
            .OnDisconnect((_, err) =>
            {
                Debug.LogWarning($"[STDB] disconnected: {err}");
                Lobby.OnDisconnected(err?.Message);
            })
            .Build();
        Lobby.Hook(Conn);
        Debug.Log($"[STDB] connecting to {serverUri} / {databaseName}");
    }

    void OnConnected(DbConnection conn, Identity identity, string token)
    {
        AuthToken.SaveToken(token);
        LocalIdentity = identity;
        Debug.Log($"[STDB] connected as {identity}");
        Lobby.OnConnected();

        conn.SubscriptionBuilder()
            .OnApplied(_ =>
            {
                Debug.Log("[STDB] lobby subscription applied");
                Lobby.OnSubscribed();
            })
            .OnError((_, err) => Debug.LogError($"[STDB] subscription error: {err}"))
            .Subscribe(new[] { "SELECT * FROM my_room", "SELECT * FROM my_room_members" });
    }

    void OnEnable()
    {
        if (Keyboard.current != null) Keyboard.current.onTextInput += OnTextInput;
    }

    void OnDisable()
    {
        if (Keyboard.current != null) Keyboard.current.onTextInput -= OnTextInput;
    }

    // Desktop: type the room code on a physical keyboard.
    static void OnTextInput(char c) => Lobby.TypeChar(c);

    void Update()
    {
        Lobby.Tick();
        var kb = Keyboard.current;
        if (kb == null) return;
        if (kb.backspaceKey.wasPressedThisFrame) Lobby.Backspace();
        if (kb.escapeKey.wasPressedThisFrame && Lobby.CurrentScreen == Lobby.Screen.Join) Lobby.BackHome();
    }

    // Called from the embedding page via HostBridge (WebGL template): set the player's display name.
    public void HostSetName(string name) => Lobby.SetName(name);

    void OnApplicationQuit() => Conn?.Disconnect();
}
