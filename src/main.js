import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

const PLAYER_SIZE = 68;
const BALL_SIZE = 42;
const PLAYER_SPEED = 280;
const KICK_SPEED = 520;
const NETWORK_INTERVAL = 50;
const PICKUP_COOLDOWN = 350;
const STEAL_COOLDOWN = 180;
// Ratios measured from Only_Field.webp so physics follows the painted lines.
const PITCH = { left: 0.107, right: 0.893, top: 0.106, bottom: 0.894 };
const GOAL = { top: 0.405, bottom: 0.596 };

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
        this.scoreA = 0;
        this.scoreB = 0;
        this.timeLeft = 180;
        this.paused = false;
        this.lastMoveSentAt = 0;
        this.lastBallSentAt = 0;
        this.ballOwner = null;
        this.pickupLockedUntil = 0;
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
        this.setPitchBounds(width, height);

        const pitch = this.getPitchBounds(width, height);

        this.ball = this.physics.add.image(pitch.centerX, pitch.centerY, "ball")
            .setDisplaySize(BALL_SIZE, BALL_SIZE).setBounce(0.9).setCollideWorldBounds(true);
        this.playerOne = this.physics.add.image(pitch.left + pitch.width * 0.22, pitch.centerY, "playerOne")
            .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setCollideWorldBounds(true).setImmovable(true);
        this.playerTwo = this.physics.add.image(pitch.right - pitch.width * 0.22, pitch.centerY, "playerTwo")
            .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setCollideWorldBounds(true).setImmovable(true);

        this.playerOne.isHost = null;
        this.playerOne.lobbyId = null;
        this.localFacing = new Phaser.Math.Vector2(1, 0);
        this.remoteFacing = new Phaser.Math.Vector2(-1, 0);
        this.remotePlayerTarget = new Phaser.Math.Vector2(this.playerTwo.x, this.playerTwo.y);
        this.remoteBallTarget = new Phaser.Math.Vector2(this.ball.x, this.ball.y);
        this.physics.add.overlap(this.ball, this.playerOne, () => this.tryTakeBall("player_1"));
        this.physics.add.overlap(this.ball, this.playerTwo, () => this.tryTakeBall("player_2"));

        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");
        this.keys = this.input.keyboard.addKeys("W,A,S,D,SPACE");
        this.scale.on("resize", this.resizeGame, this);
        this.time.addEvent({ delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true });
        this.connectSocket();
    }

    get localRole() {
        return this.playerOne?.isHost ? "player_1" : "player_2";
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
            this.updateScore(data.scoreA, data.scoreB);
        } else if (data.type === "move") {
            this.remotePlayerTarget.set(
                this.scale.width * (1 - this.readNormalized(data, "x")),
                this.scale.height * (1 - this.readNormalized(data, "y"))
            );
            if (Number.isFinite(data.dx) && Number.isFinite(data.dy) && (data.dx || data.dy)) {
                this.remoteFacing.set(-data.dx, -data.dy).normalize();
            }
        } else if (data.type === "ball_state" && !this.playerOne.isHost) {
            this.ballOwner = data.owner ?? null;
            this.remoteBallTarget.set(
                this.scale.width * (1 - this.readNormalized(data, "x")),
                this.scale.height * (1 - this.readNormalized(data, "y"))
            );
        } else if (data.type === "kick_request" && this.playerOne.isHost) {
            this.kickBall(new Phaser.Math.Vector2(-data.dx, -data.dy), "player_2");
        } else if (data.type === "score") {
            this.updateScore(data.scoreA, data.scoreB);
        } else if (data.type === "pause") {
            this.paused = data.freezed;
            if (this.paused) {
                this.resetBall();
                this.resetPlayers();
            }
        } else if (data.type === "game_start") {
            this.paused = false;
            this.resetBall();
            this.resetPlayers();
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
        this.playerTwo.x = Phaser.Math.Linear(this.playerTwo.x, this.remotePlayerTarget.x, 0.28);
        this.playerTwo.y = Phaser.Math.Linear(this.playerTwo.y, this.remotePlayerTarget.y, 0.28);

        if (this.playerOne.isHost) {
            if (this.ballOwner) this.attachBallToOwner();
        } else if (this.ballOwner) {
            this.attachBallForGuestView();
        } else {
            this.ball.x = Phaser.Math.Linear(this.ball.x, this.remoteBallTarget.x, 0.35);
            this.ball.y = Phaser.Math.Linear(this.ball.y, this.remoteBallTarget.y, 0.35);
        }

        if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && this.ballOwner === this.localRole && !this.paused) {
            if (this.playerOne.isHost) this.kickBall(this.localFacing, "player_1");
            else this.send({
                type: "kick_request", dx: this.localFacing.x, dy: this.localFacing.y,
                lobbyId: this.playerOne.lobbyId
            });
        }

        if (this.socket?.readyState !== WebSocket.OPEN || this.playerOne.lobbyId === null) return;
        if (time - this.lastMoveSentAt >= NETWORK_INTERVAL) this.sendMovement(time);
        if (this.playerOne.isHost) {
            if (time - this.lastBallSentAt >= NETWORK_INTERVAL) this.sendBallState(time);
            if (!this.ballOwner && !this.paused) this.checkForGoal();
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
            this.localFacing.set(x, y).normalize();
            this.playerOne.setVelocity(this.localFacing.x * PLAYER_SPEED, this.localFacing.y * PLAYER_SPEED);
        } else {
            this.playerOne.setVelocity(0);
        }
    }

    tryTakeBall(owner) {
        if (!this.playerOne.isHost || this.paused || this.time.now < this.pickupLockedUntil) return;
        if (this.ballOwner === owner) return;

        // A collision from the opponent transfers possession. Briefly lock the
        // new owner so overlapping bodies cannot steal it back every frame.
        this.ballOwner = owner;
        this.pickupLockedUntil = this.time.now + STEAL_COOLDOWN;
        this.ball.setVelocity(0);
        this.attachBallToOwner();
        this.sendBallState(0);
    }

    attachBallToOwner() {
        const player = this.ballOwner === "player_1" ? this.playerOne : this.playerTwo;
        const facing = this.ballOwner === "player_1" ? this.localFacing : this.remoteFacing;
        const distance = PLAYER_SIZE / 2 + BALL_SIZE / 2 - 5;
        this.ball.setPosition(player.x + facing.x * distance, player.y + facing.y * distance).setVelocity(0);
    }

    attachBallForGuestView() {
        const isLocalOwner = this.ballOwner === this.localRole;
        const player = isLocalOwner ? this.playerOne : this.playerTwo;
        const facing = isLocalOwner ? this.localFacing : this.remoteFacing;
        const distance = PLAYER_SIZE / 2 + BALL_SIZE / 2 - 5;
        this.ball.setPosition(player.x + facing.x * distance, player.y + facing.y * distance).setVelocity(0);
    }

    kickBall(direction, expectedOwner) {
        if (!this.playerOne.isHost || this.ballOwner !== expectedOwner || this.paused) return;
        if (!direction.lengthSq()) direction.set(1, 0);
        direction.normalize();
        this.ballOwner = null;
        this.pickupLockedUntil = this.time.now + PICKUP_COOLDOWN;
        this.ball.setVelocity(direction.x * KICK_SPEED, direction.y * KICK_SPEED);
        this.sendBallState(0);
    }

    sendMovement(time) {
        this.lastMoveSentAt = time;
        this.send({
            type: "move", x: this.playerOne.x, y: this.playerOne.y,
            nx: this.playerOne.x / this.scale.width, ny: this.playerOne.y / this.scale.height,
            dx: this.localFacing.x, dy: this.localFacing.y, lobbyId: this.playerOne.lobbyId
        });
    }

    sendBallState(time) {
        this.lastBallSentAt = time;
        this.send({
            type: "ball_state", x: this.ball.x, y: this.ball.y,
            nx: this.ball.x / this.scale.width, ny: this.ball.y / this.scale.height,
            vx: this.ball.body.velocity.x, vy: this.ball.body.velocity.y,
            owner: this.ballOwner, lobbyId: this.playerOne.lobbyId
        });
    }

    checkForGoal() {
        const pitch = this.getPitchBounds();
        const goalTop = this.scale.height * GOAL.top;
        const goalBottom = this.scale.height * GOAL.bottom;
        const inGoal = this.ball.y >= goalTop && this.ball.y <= goalBottom;
        const leftGoalLine = pitch.left + BALL_SIZE / 2 + 2;
        const rightGoalLine = pitch.right - BALL_SIZE / 2 - 2;
        if (!inGoal || (this.ball.x > leftGoalLine && this.ball.x < rightGoalLine)) return;
        const goal = this.ball.x <= leftGoalLine ? "left" : "right";
        this.paused = true;
        this.resetBall();
        this.send({ type: "goal", goal, lobbyId: this.playerOne.lobbyId });
    }

    send(payload) {
        if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
    }

    resetBall() {
        const pitch = this.getPitchBounds();
        this.ballOwner = null;
        this.ball.setPosition(pitch.centerX, pitch.centerY).setVelocity(0);
        this.remoteBallTarget.set(this.ball.x, this.ball.y);
    }

    resetPlayers() {
        const pitch = this.getPitchBounds();
        this.playerOne.setPosition(pitch.left + pitch.width * 0.22, pitch.centerY).setVelocity(0);
        this.playerTwo.setPosition(pitch.right - pitch.width * 0.22, pitch.centerY).setVelocity(0);
        this.remotePlayerTarget.set(this.playerTwo.x, this.playerTwo.y);
        this.localFacing.set(1, 0);
        this.remoteFacing.set(-1, 0);
    }

    getPitchBounds(width = this.scale.width, height = this.scale.height) {
        const left = width * PITCH.left;
        const right = width * PITCH.right;
        const top = height * PITCH.top;
        const bottom = height * PITCH.bottom;
        return {
            left, right, top, bottom,
            width: right - left,
            height: bottom - top,
            centerX: (left + right) / 2,
            centerY: (top + bottom) / 2
        };
    }

    setPitchBounds(width, height) {
        const pitch = this.getPitchBounds(width, height);
        this.physics.world.setBounds(pitch.left, pitch.top, pitch.width, pitch.height);
    }

    resizeGame(gameSize) {
        this.bg.setDisplaySize(gameSize.width, gameSize.height);
        this.setPitchBounds(gameSize.width, gameSize.height);
        const pitch = this.getPitchBounds(gameSize.width, gameSize.height);
        this.playerOne.setPosition(
            Phaser.Math.Clamp(this.playerOne.x, pitch.left + PLAYER_SIZE / 2, pitch.right - PLAYER_SIZE / 2),
            Phaser.Math.Clamp(this.playerOne.y, pitch.top + PLAYER_SIZE / 2, pitch.bottom - PLAYER_SIZE / 2)
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
