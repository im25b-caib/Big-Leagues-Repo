import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

const PLAYER_SPEED = 280;
const BALL_SPEED = 320;
const NETWORK_INTERVAL = 50;
const GOAL_HEIGHT_RATIO = 0.36;

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
        this.scoreA = 0;
        this.scoreB = 0;
        this.timeLeft = 180;
        this.paused = false;
        this.lastMoveSentAt = 0;
        this.lastBallSentAt = 0;
    }

    preload() {
        this.load.setPath("/assets/");
        this.load.image("bg", "Only_Field.webp");
        this.load.image("ball", "football.png");
        this.load.image("playerOne", "redcircle.png");
        this.load.image("playerTwo", "bluecircle.png");
    }

    create() {
        const { width, height } = this.scale;
        this.bg = this.add.image(0, 0, "bg").setOrigin(0).setDisplaySize(width, height);
        this.physics.world.setBounds(0, 0, width, height);

        this.ball = this.physics.add.image(width / 2, height / 2, "ball")
            .setDisplaySize(30, 30).setBounce(1).setCollideWorldBounds(true);
        this.playerOne = this.physics.add.image(width * 0.18, height / 2, "playerOne")
            .setDisplaySize(50, 50).setCollideWorldBounds(true).setImmovable(true);
        this.playerTwo = this.physics.add.image(width * 0.82, height / 2, "playerTwo")
            .setDisplaySize(50, 50).setCollideWorldBounds(true).setImmovable(true);

        this.playerOne.isHost = null;
        this.playerOne.lobbyId = null;
        this.ball.ballLaunched = false;
        this.remotePlayerTarget = new Phaser.Math.Vector2(this.playerTwo.x, this.playerTwo.y);
        this.remoteBallTarget = new Phaser.Math.Vector2(this.ball.x, this.ball.y);
        this.physics.add.collider(this.ball, this.playerOne);
        this.physics.add.collider(this.ball, this.playerTwo);

        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");
        this.keys = this.input.keyboard.addKeys("W,A,S,D");
        this.scale.on("resize", this.resizeGame, this);
        this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
        this.connectSocket();
    }

    connectSocket() {
        const protocol = location.protocol === "https:" ? "wss" : "ws";
        this.socket = new WebSocket(`${protocol}://${location.hostname || "127.0.0.1"}:8000/ws`);
        this.socket.addEventListener("message", (event) => this.handleMessage(JSON.parse(event.data)));
        this.socket.addEventListener("error", (error) => console.error("WebSocket error", error));
    }

    handleMessage(data) {
        if (data.type === "lobby_connect") {
            this.playerOne.isHost = data.isHost;
            this.playerOne.lobbyId = data.lobbyId;
        } else if (data.type === "move") {
            this.remotePlayerTarget.set(
                this.scale.width * (1 - this.readNormalized(data, "x")),
                this.scale.height * (1 - this.readNormalized(data, "y"))
            );
        } else if (data.type === "launch_ball" && this.playerOne.isHost) {
            this.resetBall();
            this.physics.velocityFromAngle(data.angle, BALL_SPEED, this.ball.body.velocity);
            this.ball.ballLaunched = true;
        } else if (data.type === "ballVelocity" && !this.playerOne.isHost) {
            this.remoteBallTarget.set(
                this.scale.width * (1 - this.readNormalized(data, "x")),
                this.scale.height * (1 - this.readNormalized(data, "y"))
            );
            this.ball.ballLaunched = true;
        } else if (data.type === "score") {
            this.updateScore(data.scoreA, data.scoreB);
        } else if (data.type === "pause") {
            this.paused = data.freezed;
            if (this.paused) this.resetBall();
        }
    }

    readNormalized(data, axis) {
        const value = data[`n${axis}`];
        if (Number.isFinite(value)) return Phaser.Math.Clamp(value, 0, 1);
        const dimension = axis === "x" ? this.scale.width : this.scale.height;
        return Phaser.Math.Clamp(data[axis] / dimension, 0, 1);
    }

    update(time) {
        if (!this.playerOne) return;
        this.updateLocalPlayer();

        // Ease toward received snapshots instead of teleporting on each packet.
        this.playerTwo.x = Phaser.Math.Linear(this.playerTwo.x, this.remotePlayerTarget.x, 0.28);
        this.playerTwo.y = Phaser.Math.Linear(this.playerTwo.y, this.remotePlayerTarget.y, 0.28);
        if (!this.playerOne.isHost) {
            this.ball.x = Phaser.Math.Linear(this.ball.x, this.remoteBallTarget.x, 0.35);
            this.ball.y = Phaser.Math.Linear(this.ball.y, this.remoteBallTarget.y, 0.35);
        }

        if (this.socket?.readyState !== WebSocket.OPEN || this.playerOne.lobbyId === null) return;
        if (time - this.lastMoveSentAt >= NETWORK_INTERVAL) this.sendMovement(time);
        if (this.playerOne.isHost && this.ball.ballLaunched) {
            if (time - this.lastBallSentAt >= NETWORK_INTERVAL) this.sendBall(time);
            this.checkForGoal();
        }
    }

    updateLocalPlayer() {
        if (this.paused) {
            this.playerOne.setVelocity(0);
            return;
        }
        const x = Number(this.keys.D.isDown) - Number(this.keys.A.isDown);
        const y = Number(this.keys.S.isDown) - Number(this.keys.W.isDown);
        if (x || y) {
            const velocity = new Phaser.Math.Vector2(x, y).normalize().scale(PLAYER_SPEED);
            this.playerOne.setVelocity(velocity.x, velocity.y);
        } else {
            this.playerOne.setVelocity(0);
        }
    }

    sendMovement(time) {
        this.lastMoveSentAt = time;
        this.send({
            type: "move", x: this.playerOne.x, y: this.playerOne.y,
            nx: this.playerOne.x / this.scale.width, ny: this.playerOne.y / this.scale.height,
            lobbyId: this.playerOne.lobbyId
        });
    }

    sendBall(time) {
        this.lastBallSentAt = time;
        this.send({
            type: "ballVelocity", x: this.ball.x, y: this.ball.y,
            nx: this.ball.x / this.scale.width, ny: this.ball.y / this.scale.height,
            lobbyId: this.playerOne.lobbyId
        });
    }

    checkForGoal() {
        const goalTop = this.scale.height * (0.5 - GOAL_HEIGHT_RATIO / 2);
        const goalBottom = this.scale.height * (0.5 + GOAL_HEIGHT_RATIO / 2);
        const inGoal = this.ball.y >= goalTop && this.ball.y <= goalBottom;
        if (!inGoal || (this.ball.x > 18 && this.ball.x < this.scale.width - 18)) return;
        if (this.ball.x <= 18) this.scoreB += 1;
        else this.scoreA += 1;
        this.updateScore(this.scoreA, this.scoreB);
        this.ball.ballLaunched = false;
        this.send({ type: "score", scoreA: this.scoreA, scoreB: this.scoreB, lobbyId: this.playerOne.lobbyId });
    }

    send(payload) {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
    }

    resetBall() {
        this.ball.setPosition(this.scale.width / 2, this.scale.height / 2).setVelocity(0);
        this.remoteBallTarget.set(this.ball.x, this.ball.y);
        this.ball.ballLaunched = false;
    }

    resizeGame(gameSize) {
        this.bg.setDisplaySize(gameSize.width, gameSize.height);
        this.physics.world.setBounds(0, 0, gameSize.width, gameSize.height);
        this.playerOne.setPosition(
            Phaser.Math.Clamp(this.playerOne.x, 25, gameSize.width - 25),
            Phaser.Math.Clamp(this.playerOne.y, 25, gameSize.height - 25)
        );
    }

    updateScore(scoreA, scoreB) {
        if (Number.isFinite(scoreA)) this.scoreA = scoreA;
        if (Number.isFinite(scoreB)) this.scoreB = scoreB;
        if (this.elScoreA) this.elScoreA.textContent = this.scoreA;
        if (this.elScoreB) this.elScoreB.textContent = this.scoreB;
    }

    updateTimer() {
        if (this.paused || this.timeLeft <= 0) return;
        this.timeLeft -= 1;
        const minutes = Math.floor(this.timeLeft / 60).toString().padStart(2, "0");
        const seconds = (this.timeLeft % 60).toString().padStart(2, "0");
        if (this.elTimer) this.elTimer.textContent = `${minutes}:${seconds}`;
    }
}

const config = {
    type: Phaser.AUTO,
    parent: "game-container",
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [GameScene]
};

new Phaser.Game(config);
