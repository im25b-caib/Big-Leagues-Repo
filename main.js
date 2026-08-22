import * as Phaser from "https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.esm.js";

let player1Name = "Player 1";
let player2Name = "Player 2";

const keysP1 = { w: false, a: false, s: false, d: false, shift: false };
const keysP2 = {
    num1: false, num2: false, num3: false, num5: false,
    arrowLeft: false, arrowRight: false, shift: false
};

window.addEventListener("keydown", (event) => {
    const key = event.key;
    const lowerKey = key.toLowerCase();

    if (key === "Shift" && event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) keysP1.shift = true;
    if (lowerKey in keysP1) keysP1[lowerKey] = true;

    if (key === "Shift" && event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) keysP2.shift = true;
    if (key === "1" || key === "Numpad1") keysP2.num1 = true;
    if (key === "2" || key === "Numpad2") keysP2.num2 = true;
    if (key === "3" || key === "Numpad3") keysP2.num3 = true;
    if (key === "5" || key === "Numpad5") keysP2.num5 = true;
    if (key === "ArrowLeft") keysP2.arrowLeft = true;
    if (key === "ArrowRight") keysP2.arrowRight = true;
});

window.addEventListener("keyup", (event) => {
    const key = event.key;
    const lowerKey = key.toLowerCase();

    if (key === "Shift" && event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) keysP1.shift = false;
    if (lowerKey in keysP1) keysP1[lowerKey] = false;

    if (key === "Shift" && event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) keysP2.shift = false;
    if (key === "1" || key === "Numpad1") keysP2.num1 = false;
    if (key === "2" || key === "Numpad2") keysP2.num2 = false;
    if (key === "3" || key === "Numpad3") keysP2.num3 = false;
    if (key === "5" || key === "Numpad5") keysP2.num5 = false;
    if (key === "ArrowLeft") keysP2.arrowLeft = false;
    if (key === "ArrowRight") keysP2.arrowRight = false;
});

class IntroScene extends Phaser.Scene {
    constructor() { super("scene-intro"); }

    preload() {
        this.load.setPath("../assets/");
        this.load.image("logo", "logo.png");
    }

    create() {
        const scoreboard = document.getElementById("scoreboard");
        if (scoreboard) scoreboard.style.display = "none";

        const width = this.scale.width;
        const height = this.scale.height;

        if (this.textures.exists("logo")) {
            const logo = this.add.image(width / 2, height / 2 - 50, "logo");
            logo.setDisplaySize(Math.min(width * 0.5, 400), Math.min(height * 0.3, 200));
        } else {
            this.add.text(width / 2, height / 2 - 50, "FOOTBALL GAME", {
                fontSize: "48px", fontStyle: "bold", color: "#ffffff"
            }).setOrigin(0.5);
        }

        const startText = this.add.text(width / 2, height / 2 + 100, "CLICK ANYWHERE TO START", {
            fontSize: "24px", fontStyle: "bold", color: "#ffff00"
        }).setOrigin(0.5);

        this.tweens.add({ targets: startText, alpha: 0.2, duration: 800, yoyo: true, loop: -1 });
        this.input.once("pointerdown", () => this.showNameInputForm());
    }

    showNameInputForm() {
        const formHtml = `
            <div id="nameFormContainer" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.9); padding: 30px; border-radius: 12px; color: white; font-family: Arial; text-align: center; z-index: 1000; min-width: 280px;">
                <h2 style="margin-top: 0; color: #ffff00;">ENTER PLAYER NAMES</h2>
                <div style="margin-bottom: 15px;"><label>Player 1 Name (Red):</label><br><input type="text" id="p1Input" value="Player 1" style="padding: 8px; width: 80%; text-align: center;"></div>
                <div style="margin-bottom: 20px;"><label>Player 2 Name (Blue):</label><br><input type="text" id="p2Input" value="Player 2" style="padding: 8px; width: 80%; text-align: center;"></div>
                <button id="submitNamesBtn" style="padding: 10px 25px; background: #28a745; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">SUBMIT & START</button>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", formHtml);
        document.getElementById("submitNamesBtn").addEventListener("click", () => {
            const val1 = document.getElementById("p1Input").value.trim();
            const val2 = document.getElementById("p2Input").value.trim();
            if (val1) player1Name = val1;
            if (val2) player2Name = val2;
            document.getElementById("nameFormContainer")?.remove();
            this.scene.start("scene-game");
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super("scene-game");
        this.scoreA = 0;
        this.scoreB = 0;
        this.timeLeft = 180;
        this.isGoalScored = false;
        this.isGameOver = false;
        this.isGameStarted = false;
        this.attachedPlayer = null;
        this.canAttachBall = true;
        this.lastShooter = null;

        this.p1IsSliding = false;
        this.p1CanSlide = true;
        this.p1SlideVector = { x: 0, y: 0 };
        this.p1IsDodging = false;
        this.p1CanDribble = true;
        this.p1DribbleAngleOffset = 0;

        this.p2FacingAngle = Math.PI;
        this.p2IsSliding = false;
        this.p2CanSlide = true;
        this.p2SlideVector = { x: 0, y: 0 };
        this.p2IsDodging = false;
        this.p2CanDribble = true;
        this.p2DribbleAngleOffset = 0;

        this.slowDownTimer = null;
        this.lastMissTime = 0; // Cooldown für Textanzeige
    }

    preload() {
        this.load.setPath("../assets/");
        this.load.image("bg", "Only_Field.webp");
        this.load.image("ball", "football.png");
        this.load.image("playerOne", "redcircle.png");
        this.load.image("playerTwo", "bluecircle.png");
    }

    create() {
        const scoreboard = document.getElementById("scoreboard");
        if (scoreboard) scoreboard.style.display = "flex";

        const width = this.scale.width;
        const height = this.scale.height;

        this.add.image(0, 0, "bg").setOrigin(0, 0).setDisplaySize(width, height);
        this.walls = this.physics.add.staticGroup();

        const marginX = width * 0.108;
        const marginTop = height * 0.095;
        const marginBottom = height * 0.095;
        const goalTop = height * 0.38;
        const goalBottom = height * 0.62;

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

        this.ball = this.physics.add.image(width / 2, height / 2, "ball");
        this.ball.setDisplaySize(30, 30);
        this.ball.setCircle(this.ball.width / 2);
        this.ball.setBounce(0.8, 0.8);
        this.ball.setDamping(true);
        this.ball.setDrag(1);

        this.playerOne = this.physics.add.sprite(width * 0.25, height / 2, "playerOne");
        this.playerOne.name = player1Name;
        this.playerOne.setDisplaySize(50, 50);
        this.playerOne.setCircle(this.playerOne.width / 2);

        this.playerTwo = this.physics.add.sprite(width * 0.75, height / 2, "playerTwo");
        this.playerTwo.name = player2Name;
        this.playerTwo.setDisplaySize(50, 50);
        this.playerTwo.setCircle(this.playerTwo.width / 2);

        this.aimCursorP1 = this.add.circle(0, 0, 6, 0xffff00);
        this.aimCursorP2 = this.add.circle(0, 0, 6, 0x00ffff);

        // Player 1 Keys
        this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
        this.keyE = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
        this.keyQ = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        // Player 2 Keys (K = Schießen, P = Dribbling, L = Slide)
        this.keyK = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
        this.keyP = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.keyL = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);

        this.physics.add.collider(this.ball, this.walls);
        this.physics.add.collider(this.playerOne, this.playerTwo, this.hitPlayers, null, this);
        this.physics.add.overlap(this.ball, this.goalLeft, this.checkGoal, null, this);
        this.physics.add.overlap(this.ball, this.goalRight, this.checkGoal, null, this);

        this.elScoreA = document.getElementById("score-a");
        this.elScoreB = document.getElementById("score-b");
        this.elTimer = document.getElementById("timer");

        const elNameA = document.getElementById("username-a");
        const elNameB = document.getElementById("username-b");
        if (elNameA) elNameA.innerText = player1Name;
        if (elNameB) elNameB.innerText = player2Name;

        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        colors.forEach((color, i) => {
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(color, 1);
            g.fillCircle(4, 4, 4);
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

        this.startCountdown();
    }

    showMissText(x, y) {
        const missText = this.add.text(x, y - 30, "MISS!", {
            fontSize: "28px",
            fontStyle: "bold",
            color: "#ff0000",
            stroke: "#ffffff",
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: missText,
            y: y - 70,
            alpha: 0,
            duration: 800,
            ease: "Power1",
            onComplete: () => missText.destroy()
        });
    }

    startCountdown() {
        const width = this.scale.width;
        const height = this.scale.height;

        const countdownText = this.add.text(width / 2, height / 2, "3", {
            fontSize: "96px", fontStyle: "bold", color: "#ffffff"
        }).setOrigin(0.5).setDepth(200);

        let count = 3;
        this.time.addEvent({
            delay: 1000,
            repeat: 3,
            callback: () => {
                count--;
                if (count > 0) {
                    countdownText.setText(count.toString());
                } else if (count === 0) {
                    countdownText.setText("GO!");
                    countdownText.setColor("#00ff00");
                } else {
                    countdownText.destroy();
                    this.isGameStarted = true;
                    this.timerEvent = this.time.addEvent({
                        delay: 1000, callback: this.updateTimer, callbackScope: this, loop: true
                    });
                }
            }
        });
    }

    createWall(x, y, w, h) {
        const wall = this.add.rectangle(x, y, w, h, 0x000000, 0);
        this.physics.add.existing(wall, true);
        this.walls.add(wall);
    }

    checkGoal(ball, goalZone) {
        if (this.isGoalScored || this.isGameOver || !this.isGameStarted) return;
        this.isGoalScored = true;
        this.attachedPlayer = null;

        if (this.slowDownTimer) this.slowDownTimer.remove();
        this.ball.setVelocity(0, 0);
        this.ball.body.enable = false;
        this.ball.setTint(0x00ffff);

        if (goalZone.teamWinner === "A") this.scoreA++;
        else if (goalZone.teamWinner === "B") this.scoreB++;

        this.updateScore(this.scoreA, this.scoreB);
        this.celebrateGoal(this.ball.x, this.ball.y);
        this.time.delayedCall(1500, this.resetPositions, [], this);
    }

    resetPositions() {
        if (this.isGameOver) return;
        const width = this.scale.width;
        const height = this.scale.height;

        if (this.slowDownTimer) this.slowDownTimer.remove();

        this.ball.clearTint();
        this.ball.body.enable = true;
        this.ball.setPosition(width / 2, height / 2);
        this.ball.setVelocity(0, 0);

        this.playerOne.setPosition(width * 0.25, height / 2);
        this.playerTwo.setPosition(width * 0.75, height / 2);
        this.p2FacingAngle = Math.PI;

        this.isGoalScored = false;
        this.attachedPlayer = null;
        this.canAttachBall = true;
        this.lastShooter = null;
    }

    hitPlayers(p1, p2) {
        const now = this.time.now;
        // P1 slided gegen P2 (der am Dribbeln ist)
        if (this.p1IsSliding && this.attachedPlayer === p2) {
            if (now - this.lastMissTime > 600) {
                this.showMissText(p2.x, p2.y);
                this.lastMissTime = now;
            }
        }
        // P2 slided gegen P1 (der am Dribbeln ist)
        else if (this.p2IsSliding && this.attachedPlayer === p1) {
            if (now - this.lastMissTime > 600) {
                this.showMissText(p1.x, p1.y);
                this.lastMissTime = now;
            }
        }

        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        const pushDistance = 15;
        p1.x -= Math.cos(angle) * pushDistance;
        p1.y -= Math.sin(angle) * pushDistance;
        p2.x += Math.cos(angle) * pushDistance;
        p2.y += Math.sin(angle) * pushDistance;
    }

    update() {
        if (this.paused || this.isGameOver || !this.isGameStarted) return;

        const pointer = this.input.activePointer;
        const angleP1 = Phaser.Math.Angle.Between(this.playerOne.x, this.playerOne.y, pointer.x, pointer.y);

        // PLAYER 2 BEWEGUNG & SLIDE (L)
        const turnSpeed = 0.07;
        if (keysP2.arrowLeft) this.p2FacingAngle -= turnSpeed;
        if (keysP2.arrowRight) this.p2FacingAngle += turnSpeed;

        if (Phaser.Input.Keyboard.JustDown(this.keyL) && this.p2CanSlide && !this.p2IsSliding) {
            this.p2IsSliding = true;
            this.p2CanSlide = false;
            let mX = 0, mY = 0;
            if (keysP2.num5) mY -= 1;
            if (keysP2.num2) mY += 1;
            if (keysP2.num1) mX -= 1;
            if (keysP2.num3) mX += 1;

            const len = Math.hypot(mX, mY);
            this.p2SlideVector = (len > 0)
                ? { x: (mX / len) * 14, y: (mY / len) * 14 }
                : { x: Math.cos(this.p2FacingAngle) * 14, y: Math.sin(this.p2FacingAngle) * 14 };

            this.time.delayedCall(400, () => this.p2IsSliding = false);
            this.time.delayedCall(3000, () => this.p2CanSlide = true);
        }

        if (this.p2IsSliding) {
            this.playerTwo.x += this.p2SlideVector.x;
            this.playerTwo.y += this.p2SlideVector.y;
            this.p2SlideVector.x *= 0.95;
            this.p2SlideVector.y *= 0.95;
        } else {
            const speed = keysP2.shift ? 6.5 : 5;
            if (keysP2.num5) this.playerTwo.y -= speed;
            if (keysP2.num2) this.playerTwo.y += speed;
            if (keysP2.num1) this.playerTwo.x -= speed;
            if (keysP2.num3) this.playerTwo.x += speed;
        }
        this.playerTwo.setRotation(this.p2FacingAngle);

        // PLAYER 2 DRIBBLE / DODGE (P)
        if (Phaser.Input.Keyboard.JustDown(this.keyP) && this.attachedPlayer === this.playerTwo && this.p2CanDribble && !this.p2IsDodging) {
            this.p2IsDodging = true;
            this.p2CanDribble = false;
            this.p2DribbleAngleOffset = Math.PI;
            this.tweens.add({ targets: this, p2DribbleAngleOffset: 0, duration: 400, ease: "Power2" });
            this.time.delayedCall(600, () => this.p2IsDodging = false);
            this.time.delayedCall(3000, () => this.p2CanDribble = true);
        }

        // PLAYER 1 BEWEGUNG & SLIDE (E)
        if (Phaser.Input.Keyboard.JustDown(this.keyE) && this.p1CanSlide && !this.p1IsSliding) {
            this.p1IsSliding = true;
            this.p1CanSlide = false;
            let mX = 0, mY = 0;
            if (keysP1.w) mY -= 1;
            if (keysP1.s) mY += 1;
            if (keysP1.a) mX -= 1;
            if (keysP1.d) mX += 1;

            const len = Math.hypot(mX, mY);
            this.p1SlideVector = (len > 0)
                ? { x: (mX / len) * 14, y: (mY / len) * 14 }
                : { x: Math.cos(angleP1) * 14, y: Math.sin(angleP1) * 14 };

            this.time.delayedCall(400, () => this.p1IsSliding = false);
            this.time.delayedCall(3000, () => this.p1CanSlide = true);
        }

        if (this.p1IsSliding) {
            this.playerOne.x += this.p1SlideVector.x;
            this.playerOne.y += this.p1SlideVector.y;
            this.p1SlideVector.x *= 0.95;
            this.p1SlideVector.y *= 0.95;
        } else {
            const speed = keysP1.shift ? 6.5 : 5;
            if (keysP1.w) this.playerOne.y -= speed;
            if (keysP1.s) this.playerOne.y += speed;
            if (keysP1.a) this.playerOne.x -= speed;
            if (keysP1.d) this.playerOne.x += speed;
        }

        // PLAYER 1 DRIBBLE / DODGE (Q)
        if (Phaser.Input.Keyboard.JustDown(this.keyQ) && this.attachedPlayer === this.playerOne && this.p1CanDribble && !this.p1IsDodging) {
            this.p1IsDodging = true;
            this.p1CanDribble = false;
            this.p1DribbleAngleOffset = Math.PI;
            this.tweens.add({ targets: this, p1DribbleAngleOffset: 0, duration: 400, ease: "Power2" });
            this.time.delayedCall(600, () => this.p1IsDodging = false);
            this.time.delayedCall(3000, () => this.p1CanDribble = true);
        }

        const aimRadius = 45;
        this.aimCursorP1.x = this.playerOne.x + Math.cos(angleP1) * aimRadius;
        this.aimCursorP1.y = this.playerOne.y + Math.sin(angleP1) * aimRadius;
        this.aimCursorP2.x = this.playerTwo.x + Math.cos(this.p2FacingAngle) * aimRadius;
        this.aimCursorP2.y = this.playerTwo.y + Math.sin(this.p2FacingAngle) * aimRadius;

        // MAGNET-PHYSIK & BALL-KLINCH
        if (!this.isGoalScored) {
            const distP1 = Phaser.Math.Distance.Between(this.playerOne.x, this.playerOne.y, this.ball.x, this.ball.y);
            const distP2 = Phaser.Math.Distance.Between(this.playerTwo.x, this.playerTwo.y, this.ball.x, this.ball.y);

            const catchP1 = this.p1IsSliding ? 60 : 45;
            const catchP2 = this.p2IsSliding ? 60 : 45;

            if (this.canAttachBall || this.lastShooter !== this.playerOne) {
                if (distP1 < catchP1 && this.attachedPlayer !== this.playerOne) {
                    this.attachedPlayer = this.playerOne;
                    this.lastShooter = null;
                    if (this.slowDownTimer) this.slowDownTimer.remove();
                }
            }

            if (this.canAttachBall || this.lastShooter !== this.playerTwo) {
                if (distP2 < catchP2 && this.attachedPlayer !== this.playerTwo) {
                    this.attachedPlayer = this.playerTwo;
                    this.lastShooter = null;
                    if (this.slowDownTimer) this.slowDownTimer.remove();
                }
            }

            if (this.attachedPlayer) {
                const ballOffset = 30;
                if (this.attachedPlayer === this.playerOne) {
                    const finalAngle = angleP1 + this.p1DribbleAngleOffset;
                    this.ball.x = this.playerOne.x + Math.cos(finalAngle) * ballOffset;
                    this.ball.y = this.playerOne.y + Math.sin(finalAngle) * ballOffset;
                } else if (this.attachedPlayer === this.playerTwo) {
                    const finalAngle = this.p2FacingAngle + this.p2DribbleAngleOffset;
                    this.ball.x = this.playerTwo.x + Math.cos(finalAngle) * ballOffset;
                    this.ball.y = this.playerTwo.y + Math.sin(finalAngle) * ballOffset;
                }

                this.ball.setVelocity(0, 0);

                // PLAYER 1 SCHIESSEN (F)
                if (this.attachedPlayer === this.playerOne && Phaser.Input.Keyboard.JustDown(this.keyF)) {
                    this.shootBall(angleP1, this.playerOne);
                }
                // PLAYER 2 SCHIESSEN (K)
                if (this.attachedPlayer === this.playerTwo && Phaser.Input.Keyboard.JustDown(this.keyK)) {
                    this.shootBall(this.p2FacingAngle, this.playerTwo);
                }
            }
        }

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

    shootBall(angle, shooter) {
        this.lastShooter = shooter;
        this.attachedPlayer = null;
        this.canAttachBall = false;

        const shootPower = 700;
        this.physics.velocityFromRotation(angle, shootPower, this.ball.body.velocity);
        this.ball.setDrag(1);

        if (this.slowDownTimer) this.slowDownTimer.remove();
        this.slowDownTimer = this.time.delayedCall(2000, () => {
            this.ball.setDrag(0.93);
        });

        this.time.delayedCall(300, () => {
            this.canAttachBall = true;
        });
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
        if (this.isGameOver) return;
        if (this.timeLeft > 0) {
            this.timeLeft--;
            const minutes = Math.floor(this.timeLeft / 60).toString().padStart(2, "0");
            const seconds = (this.timeLeft % 60).toString().padStart(2, "0");
            if (this.elTimer) this.elTimer.innerText = `${minutes}:${seconds}`;
            if (this.timeLeft === 0) this.endGame();
        }
    }

    endGame() {
        this.isGameOver = true;
        this.ball.setVelocity(0, 0);
        this.ball.body.enable = false;

        const width = this.scale.width;
        const height = this.scale.height;
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5);
        overlay.setDepth(100);

        let winnerName = "";
        if (this.scoreA > this.scoreB) winnerName = this.playerOne.name;
        else if (this.scoreB > this.scoreA) winnerName = this.playerTwo.name;

        const winMessage = winnerName ? `${winnerName} has won the game!` : "It's a draw!";
        this.add.text(width / 2, height / 2 - 30, winMessage, { fontSize: "48px", fontStyle: "bold", color: "#ffffff" }).setOrigin(0.5).setDepth(101);
        this.add.text(width / 2, height / 2 + 35, "🤡 🤡 🤡", { fontSize: "32px" }).setOrigin(0.5).setDepth(101);
    }

    celebrateGoal(x, y) {
        this.confettiEmitters.forEach(emitter => {
            emitter.setPosition(x, y);
            emitter.explode(20);
        });
    }
}

const config = {
    type: Phaser.WEBGL,
    canvas: document.getElementById("gameCanvas"),
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH, width: "100%", height: "100%" },
    physics: { default: "arcade", arcade: { gravity: { y: 0 }, debug: false } },
    scene: [IntroScene, GameScene],
};

const game = new Phaser.Game(config);