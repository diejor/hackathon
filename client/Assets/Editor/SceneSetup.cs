using RishUI;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

// Menu: Hackathon > Rebuild Main Scene
// CLI:  Unity -batchmode -quit -projectPath client -executeMethod SceneSetup.Run
// Recreates Assets/Scenes/Main.unity (camera + Rish UI root + GameManager) and the player settings
// the phone/WebGL build relies on. Safe to re-run; it overwrites the scene.
public static class SceneSetup
{
    const string ScenePath = "Assets/Scenes/Main.unity";
    const string PanelSettingsPath = "Assets/UI/PanelSettings.asset";
    const string ThemePath = "Assets/UI/Theme.tss";
    const string StylePath = "Assets/UI/app.uss";
    const string AppClass = "Hackathon.UI.HackathonApp";
    static readonly Color Background = new Color32(0x0E, 0x0E, 0x13, 0xFF);

    [MenuItem("Hackathon/Rebuild Main Scene")]
    public static void Run()
    {
        AssetDatabase.Refresh();
        var panel = EnsurePanelSettings();
        var style = AssetDatabase.LoadAssetAtPath<StyleSheet>(StylePath);
        if (style == null) throw new System.Exception($"Missing {StylePath}");

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        var cam = new GameObject("Main Camera", typeof(Camera)).GetComponent<Camera>();
        cam.tag = "MainCamera";
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = Background;
        cam.orthographic = true;

        var ui = new GameObject("UI");
        var doc = ui.AddComponent<UIDocument>();
        doc.panelSettings = panel;
        var root = ui.AddComponent<RishRoot>();
        var so = new SerializedObject(root);
        so.FindProperty("_rootClassName").stringValue = AppClass;
        // Styles come from the panel theme (Theme.tss @imports app.uss), so no sheets here.
        so.FindProperty("_styleSheets").arraySize = 0;
        so.ApplyModifiedPropertiesWithoutUndo();

        new GameObject("GameManager").AddComponent<GameManager>();

        System.IO.Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

        PlayerSettings.productName = "Security Arcade";
        PlayerSettings.runInBackground = true;
        PlayerSettings.WebGL.template = "PROJECT:Mobile";
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.dataCaching = true;
        AssetDatabase.SaveAssets();
        Debug.Log($"[SceneSetup] Wrote {ScenePath}");
    }

    static PanelSettings EnsurePanelSettings()
    {
        var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(PanelSettingsPath);
        if (panel == null)
        {
            panel = ScriptableObject.CreateInstance<PanelSettings>();
            AssetDatabase.CreateAsset(panel, PanelSettingsPath);
        }
        panel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(ThemePath);
        // Phone-first: lay out against a ~420x860 portrait reference, scaled to the screen height.
        // Desktop/landscape just gets a centered column (max-width in app.uss).
        panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
        panel.referenceResolution = new Vector2Int(420, 860);
        panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
        panel.match = 1f;
        EditorUtility.SetDirty(panel);
        return panel;
    }
}
