import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";


const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

const speedDown = 300

let bg;
class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
    }

    preload() {
        bg = this.load.image("bg", "/assets/Only_Field.webp");
        bg.width = sizes.width;
        bg.height = sizes.height;
    }

    create() {
        bg = this.add.image(200,200 , "bg");
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


class SoccerPlayer {
    constructor() {this.x = x, this.y = y}
}



