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
    d: false,
    shift: false
};

window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "shift") {
        keys.shift = true;
    } else if (key in keys) {
        keys[key] = true;
    }
});

window.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "shift") {
        keys.shift = false;
    } else if (key in keys) {
        keys[key] = false;
    }
});

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
        this.scoreA = 0;
        this.scoreB = 0;
        this.timeLeft = 180;
        this.isGoalScored = false;
        this.attachedPlayer = null;
        this.canAttachBall = true;

        // Slide Status & Cooldown
        this.isSliding = false;
        this.canSlide = true;
        this.slideVector = { x: 0, y: 0 };
        this.hasStolenInCurrentSlide = false;

        // Dribble Status & Cooldown
        this.isDodging = false;
        this.canDribble = true;
        this.dribbleAngleOffset = 0;
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

        bg = this.add.image(0, 0, "bg").setOrigin(0, 0);
        bg.setDisplaySize(width, height);

        this.walls = this.physics.add.staticGroup();

        const marginX = width * 0.108;
        const marginTop = height * 0.095;
        const marginBottom = height * 0.095;

        const goalTop = height * 0.38;
        const goalBottom = height * 0.62;

        // WÄNDE & TORE
        this.createWall(width / 2, marginTop / 2, width, marginTop);
        this.createWall(width / 2, height - (marginBottom / 2), width, marginBottom);
        this.createWall(marginX / 2, (marginTop + goalTop) / 2, marginX, goalTop - marginTop);
        this.createWall(marginX / 2, (goalBottom + (height - marginBottom)) / 2, marginX, (height - marginBottom) - goalBottom);
        this.createWall(width - (marginX / 2), (marginTop + goalTop) / 2, marginX, goalTop - marginTop);
        this.createWall(width - (marginX / 2), (goalBottom + (height - marginBottom)) / 2, marginX, (height - marginBottom) - goalBottom);
        this.createWall(10, (goalTop + goalBottom) / 2, 20, goalBottom - goalTop);
        this.createWall(width - 10, (goalTop + goalBottom) / 2, 20, goalBottom - goalTop);

        this.goalLeft = this.add.rectangle(marginX * 0.4, (goalTop + goalBottom) / 2, 20, goalBottom - goalTop, 0x000000, 0);
        this.physics.add.existing(this.goalLeft, true);
        this.goalLeft.teamWinner = "B";

        this.goalRight = this.add.rectangle(width - (marginX * 0.4), (goalTop + goalBottom) / 2, 20, goalBottom - goalTop, 0x000000, 0);
        this.physics.add.existing(this.goalRight, true);
        this.goalRight.teamWinner = "A";

        // BALL & SPIELER
        this.ball = this.physics.add.image(width / 2, height / 2, "ball");
        this.ball.setDisplaySize(30, 30);
        this.ball.setCircle(this.ball.width / 2);
        this.ball.setBounce(0.8, 0.8);
        this.ball.setDamping(true);
        this.ball.setDrag(0.98);
        this.ball.setAngularDrag(100);

        this.playerOne = this.physics.add.sprite(width * 0.25, height / 2, "playerOne");
        this.playerOne.setDisplaySize(50, 50);
        this.playerOne.setCircle(this.playerOne.width / 2);

        this.playerTwo = this.physics.add.sprite(width * 0.75, height / 2, "playerTwo");
        this.playerTwo.setDisplaySize(50, 50);
        this.playerTwo.setCircle(this.playerTwo.width / 2);

        // ZIEL-CURSOR
        this.aimCursor = this.add.circle(0, 0, 6, 0xffff00);

        // TASTEN-INPUTS (F, E, Q)
        this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        this.paused = false;
        this.playerOne.isHost = null;
        this.playerOne.lobbyId = null;
        this.playerOne.score = 0;
        this.playerTwo.score = 0;

        // KOLLISIONEN
        this.physics.add.collider(this.ball, this.walls);
        this.physics.add.collider(this.playerOne, this.playerTwo, this.hitPlayers, null, this);
        this.physics.add.overlap(this.ball, this.goalLeft, this.checkGoal, null, this);
        this.physics.add.overlap(this.ball, this.goalRight, this.checkGoal, null, this);

        // DOM-Elemente & Timer
        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");

        this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });

        // WebSocket Setup
        this.socket = new WebSocket(`ws://127.0.0.1:8000/ws`);
        this.socket.onopen = (event) => console.log("New socket connected!");
        this.socket.onclose = (event) => console.log("Socket closed");
        this.socket.onerror = (error) => console.error("Websocket error: ", error);

        this.socket.addEventListener("message", (event) => {
            const data = JSON.parse(event.data);
            if (data.type === "move") {
                this.playerTwo.setPosition(this.scale.width - data.x, this.scale.height - data.y);
            }
            if (data.type === "lobby_connect") {
                this.playerOne.isHost = data.isHost;
                this.playerOne.lobbyId = data.lobbyId;
            }
            if (data.type === "ballVelocity") {
                this.ball.setPosition(this.scale.width - data.x, this.scale.height - data.y);
            }
            if (data.type === "score" && !this.playerOne.isHost) {

                this.updateScore(data.scoreA, data.scoreB);
            }
            if (data.type === "pause") {
                if (data.freezed) this.paused = true;
            }
            if (data.scoreA !== undefined || data.scoreB !== undefined) {
                this.updateScore(data.scoreA, data.scoreB);
            }
        });
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        colors.forEach((color, i) => {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(color, 1);
            g.fillCircle(4, 4, 4); // center (4,4), radius 4 — fits an 8x8 texture
            g.generateTexture(`confetti${i}`, 8, 8);
        });

        this.confettiEmitters = colors.map((_, i) =>
            this.add.particles(0, 0, `confetti${i}`, {
                emitting: false,
                lifespan: 2000,
                speed: { min: 150, max: 400 },
                angle: { min: 240, max: 300 },
                gravityY: 300,
                rotate: { min: 0, max: 360 },
                scale: { start: 1, end: 0.5 },
                alpha: { start: 1, end: 0 },
                quantity: 3
            })
        );
    }

    createWall(x, y, w, h) {
        const wall = this.add.rectangle(x, y, w, h, 0x000000, 0);
        this.physics.add.existing(wall, true);
        this.walls.add(wall);
    }

    showMissText(x, y) {
        const missText = this.add.text(x, y - 25, "MISS!", {
            fontSize: "22px",
            fontStyle: "bold",
            color: "#ff2222"
        }).setOrigin(0.5);

        this.tweens.add({
            targets: missText,
            y: y - 60,
            alpha: 0,
            duration: 700,
            onComplete: () => missText.destroy()
        });
    }

    checkGoal(ball, goalZone) {
        if (this.isGoalScored) return;

        this.isGoalScored = true;
        this.attachedPlayer = null;

        this.ball.setVelocity(0, 0);
        this.ball.setAngularVelocity(0);
        this.ball.body.enable = false;
        this.ball.setTint(0x00ffff);

        if (goalZone.teamWinner === "A") {
            this.scoreA++;
        } else if (goalZone.teamWinner === "B") {
            this.scoreB++;
        }

        this.updateScore(this.scoreA, this.scoreB);
        this.celebrateGoal(this.ball.x, this.ball.y);
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "score",
                scoreA: this.scoreA,
                scoreB: this.scoreB
            }));
        }

        this.time.delayedCall(1500, this.resetPositions, [], this);
    }

    resetPositions() {
        const width = this.scale.width;
        const height = this.scale.height;

        this.ball.clearTint();
        this.ball.body.enable = true;
        this.ball.setPosition(width / 2, height / 2);
        this.ball.setVelocity(0, 0);
        this.ball.setAngularVelocity(0);

        this.playerOne.setPosition(width * 0.25, height / 2);
        this.playerTwo.setPosition(width * 0.75, height / 2);

        this.isGoalScored = false;
        this.attachedPlayer = null;
        this.canAttachBall = true;
        this.isSliding = false;
        this.isDodging = false;
        this.hasStolenInCurrentSlide = false;
    }

    hitPlayers(p1, p2) {
        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        const pushDistance = 15;

        p1.x -= Math.cos(angle) * pushDistance;
        p1.y -= Math.sin(angle) * pushDistance;

        p2.x += Math.cos(angle) * pushDistance;
        p2.y += Math.sin(angle) * pushDistance;
    }

    update() {
        if (this.paused) return;

        // maus winkel
        const pointer = this.input.activePointer;
        const angleToMouse = Phaser.Math.Angle.Between(this.playerOne.x, this.playerOne.y, pointer.x, pointer.y);

        // slide
        if (Phaser.Input.Keyboard.JustDown(this.keyE) && this.canSlide && !this.isSliding) {
            this.isSliding = true;
            this.canSlide = false;
            this.hasStolenInCurrentSlide = false;

            let moveX = 0;
            let moveY = 0;
            if (keys.w) moveY -= 1;
            if (keys.s) moveY += 1;
            if (keys.a) moveX -= 1;
            if (keys.d) moveX += 1;

            if (moveX !== 0 || moveY !== 0) {
                const len = Math.hypot(moveX, moveY);
                this.slideVector = { x: (moveX / len) * 14, y: (moveY / len) * 14 };
            } else {
                this.slideVector = { x: Math.cos(angleToMouse) * 14, y: Math.sin(angleToMouse) * 14 };
            }

            // slide
            this.time.delayedCall(400, () => {
                this.isSliding = false;
            });

            // cooldown
            this.time.delayedCall(3000, () => {
                this.canSlide = true;
            });
        }

        // movement
        if (this.isSliding) {
            this.playerOne.x += this.slideVector.x;
            this.playerOne.y += this.slideVector.y;
            this.slideVector.x *= 0.95;
            this.slideVector.y *= 0.95;

            // ball klauen
            if (!this.hasStolenInCurrentSlide && this.attachedPlayer !== this.playerOne) {
                const distToBall = Phaser.Math.Distance.Between(this.playerOne.x, this.playerOne.y, this.ball.x, this.ball.y);
                const stealDistance = 85;

                if (distToBall < stealDistance) {
                    if (this.isDodging && this.attachedPlayer === this.playerTwo) {
                        // Gegner dribbelt rechtzeitig aus -> MISS
                        this.showMissText(this.playerOne.x, this.playerOne.y);
                        this.hasStolenInCurrentSlide = true;
                    } else {
                        // Ball geklaut!
                        this.attachedPlayer = this.playerOne;
                        this.canAttachBall = true;
                        this.hasStolenInCurrentSlide = true;
                    }
                }
            }
        } else {
            const speed = keys.shift ? 6.5 : 5;
            if (keys.w) this.playerOne.y -= speed;
            if (keys.s) this.playerOne.y += speed;
            if (keys.a) this.playerOne.x -= speed;
            if (keys.d) this.playerOne.x += speed;
        }

        //
        const aimRadius = 45;
        this.aimCursor.x = this.playerOne.x + Math.cos(angleToMouse) * aimRadius;
        this.aimCursor.y = this.playerOne.y + Math.sin(angleToMouse) * aimRadius;

        // 4. 180° SPIN DRIBBLE / DODGE (TASTE Q)
        if (Phaser.Input.Keyboard.JustDown(this.keyQ) && this.attachedPlayer === this.playerOne && this.canDribble && !this.isDodging) {
            this.isDodging = true;
            this.canDribble = false;
            this.dribbleAngleOffset = Math.PI;

            this.tweens.add({
                targets: this,
                dribbleAngleOffset: 0,
                duration: 400,
                ease: "Power2"
            });

            // protection
            this.time.delayedCall(600, () => {
                this.isDodging = false;
            });

            // Cooldown
            this.time.delayedCall(3000, () => {
                this.canDribble = true;
            });
        }

        // Ball Shiessen & dribbeln
        if (!this.isGoalScored) {
            const distP1 = Phaser.Math.Distance.Between(this.playerOne.x, this.playerOne.y, this.ball.x, this.ball.y);
            const distP2 = Phaser.Math.Distance.Between(this.playerTwo.x, this.playerTwo.y, this.ball.x, this.ball.y);
            const catchDistance = 45;

            if (this.canAttachBall && !this.attachedPlayer) {
                if (distP1 < catchDistance) {
                    this.attachedPlayer = this.playerOne;
                } else if (distP2 < catchDistance) {
                    this.attachedPlayer = this.playerTwo;
                }
            }

            if (this.attachedPlayer) {
                const ballOffset = 30;

                if (this.attachedPlayer === this.playerOne) {
                    const finalAngle = angleToMouse + this.dribbleAngleOffset;
                    this.ball.x = this.playerOne.x + Math.cos(finalAngle) * ballOffset;
                    this.ball.y = this.playerOne.y + Math.sin(finalAngle) * ballOffset;
                } else if (this.attachedPlayer === this.playerTwo) {
                    this.ball.x = this.playerTwo.x - ballOffset;
                    this.ball.y = this.playerTwo.y;
                }

                this.ball.setVelocity(0, 0);
                this.ball.setAngularVelocity(0);

                //
                if (this.attachedPlayer === this.playerOne && Phaser.Input.Keyboard.JustDown(this.keyF)) {
                    this.attachedPlayer = null;
                    this.canAttachBall = false;

                    const shootPower = 700;
                    this.physics.velocityFromRotation(angleToMouse, shootPower, this.ball.body.velocity);

                    this.time.delayedCall(300, () => {
                        this.canAttachBall = true;
                    });
                }
            }

        }

        // 6. SPIELER-KOLLISIONEN
        const minDistance = 50;
        const dist = Phaser.Math.Distance.Between(this.playerOne.x, this.playerOne.y, this.playerTwo.x, this.playerTwo.y);

        if (dist < minDistance && dist > 0) {
            const angle = Phaser.Math.Angle.Between(this.playerOne.x, this.playerOne.y, this.playerTwo.x, this.playerTwo.y);
            const overlap = minDistance - dist;

            this.playerOne.x -= Math.cos(angle) * (overlap / 2);
            this.playerOne.y -= Math.sin(angle) * (overlap / 2);

            this.playerTwo.x += Math.cos(angle) * (overlap / 2);
            this.playerTwo.y += Math.sin(angle) * (overlap / 2);
        }

        // 7. SPIELFELD-BARRIERE
        const radius = 25;
        const minX = (this.scale.width * 0.108) + radius;
        const maxX = (this.scale.width * (1 - 0.108)) - radius;
        const minY = (this.scale.height * 0.095) + radius;
        const maxY = (this.scale.height * (1 - 0.095)) - radius;

        this.playerOne.x = Phaser.Math.Clamp(this.playerOne.x, minX, maxX);
        this.playerOne.y = Phaser.Math.Clamp(this.playerOne.y, minY, maxY);

        this.playerTwo.x = Phaser.Math.Clamp(this.playerTwo.x, minX, maxX);
        this.playerTwo.y = Phaser.Math.Clamp(this.playerTwo.y, minY, maxY);
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

    celebrateGoal(x, y) {
        this.confettiEmitters.forEach(emitter => {
            emitter.setPosition(x, y);
            emitter.explode(20);
        });
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
            debug: false,
        },
    },
    scene: [GameScene],
};

const game = new Phaser.Game(config);

