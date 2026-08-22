import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";
const speedDown = 200;

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};
const speed = 5;

// Eventlisteners

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
        keys[key] = true;
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) {
        keys[key] = false;
    }
});

function movePlayer() {
    // adjust  x and y of player
}

let bg;
let ball;
class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
    }

    preload() {
        bg = this.load.image("bg", "/assets/Only_Field.webp");
        bg.width = sizes.width;
        bg.height = sizes.height;

        ball = this.load.image("ball", "/assets/football.png");

    }

    create() {
        bg = this.add.image(0,0 , "bg").setOrigin(0, 0);
        bg.setDisplaySize(sizes.width, sizes.height);

        ball = this.add.image(0,0 , "ball").setOrigin(0, 0);
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



