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
    d: false,
    shift: false
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
        this.timeLeft = 180; // 3 Minuten in Sekunden
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
        const width = this.scale.width;
        const height = this.scale.height;

        // Hintergrund skaliert auf volle Canvas-Größe
        bg = this.add.image(0, 0, "bg").setOrigin(0, 0);
        bg.setDisplaySize(width, height);

        // Dynamisches Resizing falls Fenstergröße verändert wird
        this.scale.on('resize', (gameSize) => {
            bg.setDisplaySize(gameSize.width, gameSize.height);
        });

        // Ball als Physik-Objekt anlegen
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

        // --- DOM-ELEMENTE FÜR HUD ---
        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");

        this.elUsernameA = document.getElementById("username-a");
        this.elUsernameB = document.getElementById("username-b");
        this.elUsernameA.innerText="userA"; this.elUsernameB.innerText="userB";


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
                this.colliderPlayerOne = this.physics.add.collider(this.ball, this.playerOne);
                this.colliderPlayerTwo = this.physics.add.collider(this.ball, this.playerTwo);
            }

            if (data.type === "ballVelocity") {
                this.ball.setPosition(sizes.width - data.x, sizes.height - data.y);
            }

            if (data.type === "score" && !this.playerOne.isHost) {
                console.log(`Received data:`, data);
                if (data.winner === "player_1") {
                    this.playerTwo.score = data.playerOneScore;
                }
                if (data.winner === "player_2") {
                    this.playerOne.score = data.playerTwoScore;
                }

                this.updateScore(this.playerOne.score, this.playerTwo.score);
            }

            if (data.type === "pause") {
                if (data.freezed) {
                // HTML Scoreboard synchronisieren
                this.updateScore(this.playerOne.score, this.playerTwo.score);
            }

            if (data.type === "pause") {
                if (data.freezed) {
                    this.paused = true;
                    this.ball.setPosition(this.scale.width / 2, this.scale.height / 2);
                    this.ball.body.setVelocity(0, 0);
                } else {
                    this.paused = false;
                }
                else this.paused = false;
            }

            if (data.scoreA !== undefined || data.scoreB !== undefined) {
                this.updateScore(data.scoreA, data.scoreB);
            }
        });
        });

        // Particle Effects
        // confetti
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        colors.forEach((color, i) => {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(color, 1);
            g.fillRect(0, 0, 8, 8);
            g.generateTexture(`confetti${i}`, 8, 8);
        });
        this.confettiEmitters = colors.map((_, i) =>
            this.add.particles(0, 0, `confetti${i}`, {
                emitting: false,
                lifespan: 2000,
                speed: { min: 150, max: 400 },
                angle: { min: 0, max: 360 }, // upward-ish spread
                gravityY: 300,
                rotate: { min: 0, max: 360 },
                scale: { start: 1, end: 0.5 },
                alpha: { start: 1, end: 0 },
                quantity: 3
            })
        );
    }
    celebrateGoal(x, y) {
        this.confettiEmitters.forEach(emitter => {
            emitter.setPosition(x, y);
            emitter.explode(20); // burst of 20 particles per color
        });
    }

    update() {
        if (this.paused) return;

        // Spieler 1 Bewegung
        const speed = 4;
        if (keys.w) this.playerOne.y -= speed;
        if (keys.s) this.playerOne.y += speed;
        if (keys.a) this.playerOne.x -= speed;
        if (keys.d) this.playerOne.x += speed;
        // sprint with shift button?
        if (keys.shift) this.celebrateGoal(this.ball.x, this.ball.y)
    }

    updateScore(scoreOne, scoreTwo) {
        if (scoreOne !== undefined) {
            this.playerOne.score = scoreOne;
            if (this.elScoreA) this.elScoreA.innerText = this.playerOne.score;
        }
        if (scoreTwo !== undefined) {
            this.playerTwo.score = scoreTwo;
            if (this.elScoreB) this.elScoreB.innerText = this.playerTwo.score;
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