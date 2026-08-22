import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";


const sizes = {
    width: 500,
    height: 500,
};

const speedDown = 300

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
    }

    preload() {
    }

    create() {
    }

    update() {
    }

}

window.onload = () => {
    console.log("page is fully loaded");
};
const config = {
    type: Phaser.WEBGL,
    width: sizes.width,
    height: sizes.height,
    canvas: gameCanvas,
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: speedDown },
            debug: true,
        },
    },
    scene: [GameScene],
};

const game = new Phaser.Game(config);



