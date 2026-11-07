// Loaded on demand (dynamic import in main.ts) so Phaser isn't in the lobby bundle.
import Phaser from "phaser";
import type { GameHandle } from "./types";
import { FirewallScene } from "./firewall";
import { ComingSoonScene } from "./coming-soon";

const SCENES: Record<string, Phaser.Types.Scenes.SceneType> = {
  firewall: FirewallScene,
};

export function mountGame(id: string, parent: HTMLElement): GameHandle {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0E0E13",
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    // Phones report DPR 3+; 2 looks the same and is much cheaper.
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    input: { activePointers: 3 },
    scene: [SCENES[id] ?? ComingSoonScene],
  } as Phaser.Types.Core.GameConfig);
  return { destroy: () => game.destroy(true) };
}
