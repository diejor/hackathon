mergeInto(LibraryManager.library, {
  // Post a JSON message to the embedding page. targetOrigin is always an explicit origin
  // (HostBridge.cs refuses to call this without one), so other sites can't read it.
  HostBridge_Post: function (jsonPtr, originPtr) {
    try {
      if (!window.parent || window.parent === window) return;
      var msg = JSON.parse(UTF8ToString(jsonPtr));
      window.parent.postMessage(msg, UTF8ToString(originPtr));
    } catch (e) {
      console.warn("[HostBridge] post failed", e);
    }
  },
});
