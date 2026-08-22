import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";



const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

let bg, ball, playerOne, playerTwo;

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

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
        this.ball = this.add.image(sizes.width / 2, sizes.height / 2, "ball");
        this.ball.setDisplaySize(30, 30);

        // Spieler 1 — quadratisch, sonst wird der Kreis zur Ellipse
        this.playerOne = this.physics.add.sprite(200, sizes.height / 2, "playerOne");
        this.playerOne.setDisplaySize(50, 50);

        //Properties
        this.paused = false;
        this.playerOne.isHost = null;
        this.playerOne.lobbyId = null;
        this.playerOne.score = 0;
        this.ball.ballLaunched = false;



        // Spieler 2
        this.playerTwo = this.physics.add.sprite(sizes.width - 200, sizes.height / 2, "playerTwo");
        this.playerTwo.setDisplaySize(50, 50);
        this.playerTwo.score = 0;

        //SOCKET
        this.socket = new WebSocket(`ws://127.0.0.1:8000/ws`);
        this.socket.onopen = (event) => {
            console.log("New socket connected!");
        };
        this.socket.onclose = (event) => {
            console.log("Socket closed");
        };
        this.socket.onerror = (error) => {
            console.error("Websocket error: ", error);
        }

        this.socket.addEventListener("message", (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "move") {
                this.playerTwo.setPosition(sizes.width - data.x, config.height - data.y);
            }

            if (data.type === "lobby_connect") {
                console.log("Lobby info: " + data.lobbyId + " " + data.isHost);
                this.playerOne.isHost = data.isHost;
                this.playerOne.lobbyId = data.lobbyId;
            }
            if (this.playerOne.isHost) {
                this.ball.setBounce(1, 1).setCollideWorldBounds(true);
                this.colliderPlayerOne = this.physics.add.collider(this.ball, this.playerOne);
                this.colliderPlayerTwo = this.physics.add.collider(this.ball, this.playerTwo);
            }

            if (data.type === "ballVelocity") {
                this.ball.setPosition(sizes.width - data.x, sizes.height - data.y);
            }

            if (data.type === "score" && !this.playerOne.isHost){
                console.log(`Received data: ${data}`);
                if (data.winner === "player_1") {
                    this.playerTwo.score = data.playerOneScore;
                }
                if (data.winner === "player_2"){
                    this.playerOne.score = data.playerTwoScore;
                }
            
            if (data.type === "pause"){
                if (data.freezed){
                    this.paused = true;

                    this.ball.setPosition(sizes.width / 2, sizes.height / 2);
                    this.ball.body.setVelocity(0, 0);
                }
                else this.paused = false;
            }
        }
        })
    }

    update() {
        // Bewegung kommt hier rein
        const speed = 4;
        if (keys.w) this.playerOne.y -= speed;
        if (keys.s) this.playerOne.y += speed;
        if (keys.a) this.playerOne.x -= speed;
        if (keys.d) this.playerOne.x += speed;
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
            gravity: { y: 0 },
            debug: true,
        },
    },
    scene: [GameScene],
};

const game = new Phaser.Game(config);


class SoccerPlayer {
    constructor() {this.x = x, this.y = y}
}



