// PLACEHOLDER (local only, not networked yet): proves the Phaser pipeline on phones.
// Packets slide toward the server; tap the red (malicious) ones before they arrive.
import Phaser from "phaser";

const MAGENTA = 0xe20074;
const BAD = 0xff4d5e;
const GOOD = 0x2bd48a;
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export class FirewallScene extends Phaser.Scene {
  private score = 0;
  private breaches = 0;
  private hud!: Phaser.GameObjects.Text;
  private server!: Phaser.GameObjects.Rectangle;

  constructor() { super("firewall"); }

  create() {
    const { width, height } = this.scale;
    this.server = this.add.rectangle(width / 2, height - 60, Math.min(width - 40, 360), 56, MAGENTA).setStrokeStyle(2, 0xffffff, 0.3);
    this.add.text(width / 2, height - 60, "SERVER", { fontFamily: FONT, fontSize: "18px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5);
    this.hud = this.add.text(16, 12, "", { fontFamily: FONT, fontSize: "16px", color: "#ffffff" });
    this.updateHud();
    this.time.addEvent({ delay: 900, loop: true, callback: () => this.spawn() });
    this.scale.on("resize", (s: Phaser.Structs.Size) => this.server.setPosition(s.width / 2, s.height - 60));
  }

  private spawn() {
    const { width, height } = this.scale;
    const bad = Math.random() < 0.45;
    const x = Phaser.Math.Between(40, width - 40);
    const packet = this.add.container(x, -30);
    const box = this.add.rectangle(0, 0, 76, 44, bad ? BAD : GOOD, 0.95).setStrokeStyle(2, 0xffffff, 0.25);
    const label = this.add.text(0, 0, bad ? "MALWARE" : "OK", { fontFamily: FONT, fontSize: "13px", fontStyle: "bold", color: "#0E0E13" }).setOrigin(0.5);
    packet.add([box, label]);
    packet.setSize(76, 44).setInteractive({ useHandCursor: true });

    const fall = this.tweens.add({
      targets: packet, y: height - 90, duration: Phaser.Math.Between(2600, 4200), ease: "Linear",
      onComplete: () => {
        if (bad) { this.breaches++; this.cameras.main.shake(120, 0.006); }
        packet.destroy();
        this.updateHud();
      },
    });

    packet.on("pointerdown", () => {
      fall.stop();
      this.score += bad ? 1 : -1;
      this.tweens.add({ targets: packet, scale: 0, alpha: 0, duration: 140, onComplete: () => packet.destroy() });
      this.updateHud();
    });
  }

  private updateHud() {
    this.hud.setText(`Blocked: ${this.score}   Breaches: ${this.breaches}`);
  }
}
