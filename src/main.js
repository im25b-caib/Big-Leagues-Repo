import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

let bg, ball, playerOne, playerTwo;

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
    }

    preload() {
        // Zeigt in der Konsole genau, welche Datei fehlschlägt und unter welcher URL
        this.load.on("loaderror", (file) => {
            console.error("Laden fehlgeschlagen:", file.key, "→", file.src);
        });

        // index.html liegt in /src/, die Bilder in /assets/ → eine Ebene hoch
        this.load.setPath("../assets/");

        this.load.image("bg", "Only_Field.webp");
        this.load.image("ball", "football.png");
        this.load.image("playerOne", "redcircle.png");
        this.load.image("playerTwo", "bluecircle.png");
    }

    create() {
        // Hintergrund
        bg = this.add.image(0, 0, "bg").setOrigin(0, 0);
        bg.setDisplaySize(sizes.width, sizes.height);

        // Ball
        ball = this.add.image(sizes.width / 2, sizes.height / 2, "ball");
        ball.setDisplaySize(30, 30);

        // Spieler 1 — quadratisch, sonst wird der Kreis zur Ellipse
        playerOne = this.add.image(200, sizes.height / 2, "playerOne");
        playerOne.setDisplaySize(50, 50);

        // Spieler 2
        playerTwo = this.add.image(sizes.width - 200, sizes.height / 2, "playerTwo");
        playerTwo.setDisplaySize(50, 50);
    }

    update() {
        // Bewegung kommt hier rein
    }
}

const config = {
    type: Phaser.AUTO,
    width: sizes.width,
    height: sizes.height,
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
            debug: true,
        },
    },
    scene: [GameScene],
};

const game = new Phaser.Game(config);