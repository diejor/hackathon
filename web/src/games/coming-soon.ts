import Phaser from "phaser";

export class ComingSoonScene extends Phaser.Scene {
  constructor() { super("coming-soon"); }
  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2, "This game is coming soon", { fontFamily: "system-ui, sans-serif", fontSize: "20px", color: "#A3A3B2" }).setOrigin(0.5);
  }
}
