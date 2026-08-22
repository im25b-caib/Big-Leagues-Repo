import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
};

let bg, ball, playerOne, playerTwo;

// Event-Listener für Tastatur
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

function movePlayer() {
    // Hier deine Bewegungslogik
}

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
        this.scoreA = 0;
        this.scoreB = 0;
        this.timeLeft = 180; // 3 Minuten in Sekunden
    }

    preload() {
        this.load.on("loaderror", (file) => {
            console.error("Laden fehlgeschlagen:", file.key, "→", file.src);
        });

        this.load.setPath("../assets/");

        this.load.image("bg", "Only_Field.webp");
        this.load.image("ball", "football.png");
        this.load.image("playerOne", "redcircle.png");
        this.load.image("playerTwo", "bluecircle.png");
    }

    create() {
        const width = this.scale.width;
        const height = this.scale.height;

        // Hintergrund skaliert auf volle Canvas-Größe
        bg = this.add.image(0, 0, "bg").setOrigin(0, 0);
        bg.setDisplaySize(width, height);

        // Dynamisches Resizing falls Fenstergröße verändert wird
        this.scale.on('resize', (gameSize) => {
            bg.setDisplaySize(gameSize.width, gameSize.height);
        });

        // Ball als Physik-Objekt anlegen (damit Collider funktionieren)
        this.ball = this.physics.add.image(width / 2, height / 2, "ball");
        this.ball.setDisplaySize(30, 30);

        // Spieler 1
        this.playerOne = this.physics.add.sprite(200, height / 2, "playerOne");
        this.playerOne.setDisplaySize(50, 50);

        // Spieler 2
        this.playerTwo = this.physics.add.sprite(width - 200, height / 2, "playerTwo");
        this.playerTwo.setDisplaySize(50, 50);

        // Properties setzen
        this.paused = false;
        this.playerOne.isHost = null;
        this.playerOne.lobbyId = null;
        this.playerOne.score = 0;
        this.playerTwo.score = 0;
        this.ball.ballLaunched = false;

        // --- DOM-ELEMENTE FÜR HUD REFERENZIEREN ---
        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");

        // --- PHASER TIMER EVENT ---
        this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // --- WEBSOCKET ---
        this.socket = new WebSocket(`ws://127.0.0.1:8000/ws`);

        this.socket.onopen = (event) => {
            console.log("New socket connected!");
        };

        this.socket.onclose = (event) => {
            console.log("Socket closed");
        };

        this.socket.onerror = (error) => {
            console.error("Websocket error: ", error);
        };

        this.socket.addEventListener("message", (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "move") {
                this.playerTwo.setPosition(this.scale.width - data.x, this.scale.height - data.y);
            }

            if (data.type === "lobby_connect") {
                console.log("Lobby info: " + data.lobbyId + " " + data.isHost);
                this.playerOne.isHost = data.isHost;
                this.playerOne.lobbyId = data.lobbyId;
            }

            if (this.playerOne.isHost) {
                this.ball.setBounce(1, 1).setCollideWorldBounds(true);
                this.colliderPlayer = this.physics.add.collider(this.ball, this.playerOne);
                this.colliderEnemy = this.physics.add.collider(this.ball, this.playerTwo);
            }

            if (data.scoreA !== undefined || data.scoreB !== undefined) {
                this.updateScore(data.scoreA, data.scoreB);
            }
        });
    }

    update() {
        // Spieler 1 Bewegung
        const speed = 4;
        if (keys.w) this.playerOne.y -= speed;
        if (keys.s) this.playerOne.y += speed;
        if (keys.a) this.playerOne.x -= speed;
        if (keys.d) this.playerOne.x += speed;

        movePlayer();
    }

    updateScore(scoreA, scoreB) {
        if (scoreA !== undefined) {
            this.scoreA = scoreA;
            if (this.elScoreA) this.elScoreA.innerText = this.scoreA;
        }
        if (scoreB !== undefined) {
            this.scoreB = scoreB;
            if (this.elScoreB) this.elScoreB.innerText = this.scoreB;
        }
    }

    updateTimer() {
        if (this.timeLeft > 0) {
            this.timeLeft--;
            const minutes = Math.floor(this.timeLeft / 60).toString().padStart(2, "0");
            const seconds = (this.timeLeft % 60).toString().padStart(2, "0");

            if (this.elTimer) {
                this.elTimer.innerText = `${minutes}:${seconds}`;
            }
        }
    }
}

class SoccerPlayer {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

window.onload = () => {
    console.log("page is fully loaded");
};

const config = {
    type: Phaser.WEBGL,
    canvas: document.getElementById("gameCanvas"),
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: "100%",
        height: "100%"
    },
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