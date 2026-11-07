using System.Linq;
using UnityEditor;
using UnityEngine;

// Menu: Hackathon > Build WebGL   (output: client/Builds/WebGL)
// CLI:  Unity -batchmode -quit -projectPath client -buildTarget WebGL -executeMethod BuildWebGL.Build
public static class BuildWebGL
{
    const string OutDir = "Builds/WebGL";

    [MenuItem("Hackathon/Build WebGL")]
    public static void Build()
    {
        // Gzip + decompression fallback: works on any static host (python http.server, itch.io,
        // GitHub Pages) without configuring Content-Encoding headers.
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.runInBackground = true;

        var scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
        if (scenes.Length == 0)
        {
            var active = UnityEngine.SceneManagement.SceneManager.GetActiveScene().path;
            if (string.IsNullOrEmpty(active)) { Debug.LogError("Save a scene (or add one to Build Settings) first."); return; }
            scenes = new[] { active };
        }

        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = scenes,
            locationPathName = OutDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.None,
        });
        Debug.Log($"WebGL build {report.summary.result}: {report.summary.outputPath} ({report.summary.totalSize / (1024 * 1024)} MB)");
        if (Application.isBatchMode && report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
            EditorApplication.Exit(1);
    }
}
