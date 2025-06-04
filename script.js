// Mortal Kombat JS Game - uproszczony system zdrowia i obrażeń
const ASSETS = {
    backgrounds: [
        'assets/background1.png',
        'assets/background2.png',
        'assets/background3.png',
    ],
    startScreen: 'assets/theme.png',
    theme2: 'assets/theme2.png',
    levelInscriptions: [
        'assets/level1.png',
        'assets/level2.png',
        'assets/level3.png',
    ],
    characters: [
        'assets/character1.png',
        'assets/character2.png',
        'assets/character3.png',
        'assets/character4.png',
        'assets/character5.png',
        'assets/character6.png',
    ],
    theme: 'assets/theme.mp3',
    win: 'assets/win.mp3',
    winRound: 'assets/win1.mp3',
    fight: 'assets/fight.mp3',
};

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bgMusic = document.getElementById('bg-music');
bgMusic.volume = 0.5;
const winSound = document.getElementById('win-sound');
let winRoundSound = null;
let fightSound = null;
const mobileControls = document.getElementById('mobile-controls');

let gameState = 'start';
let currentLevel = 0;
let winner = null;
let fightAnnouncementActive = false;
let isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
let roundsWon = [0, 0];
let roundsToWin = 3;
let matchWinner = null;

const leftPool = [1, 3, 5];
const rightPool = [0, 2, 4];
let playerNames = ["Player 1", "Player 2"];
let players = [];
let backgrounds = [];
let characterImgs = [];
let startScreenImg = null;
let theme2Img = null;
let levelInscriptions = [];

const controls = {
    left: { left: false, right: false, basicAttack: false, strongAttack: false },
    right: { left: false, right: false, basicAttack: false, strongAttack: false },
};

class Player {
    constructor(img, x, y, facing, controls, name) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.width = 120;
        this.height = 240;
        this.facing = facing;
        this.controls = controls;
        this.name = name;
        this.maxHp = 100;
        this.hp = 100;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.heavyAttackCooldown = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboWindow = 60; // 1 second at 60fps
    }
    update(opponent) {
        // Movement (only allowed when fight announcement is not active)
        if (!fightAnnouncementActive) {
            if (this.controls.left) this.x -= 3.5;
            if (this.controls.right) this.x += 3.5;
            this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        }
        
        // Update combo timer
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) {
                this.comboCount = 0;
            }
        }
        
        // Basic Attack (25% damage) - only allowed when fight announcement is not active
        if (!fightAnnouncementActive && this.controls.basicAttack && this.attackCooldown === 0) {
            this.isAttacking = true;
            if (rectsOverlap(this.getRect(), opponent.getRect())) {
                this.comboCount++;
                this.comboTimer = this.comboWindow;
                
                if (this.comboCount >= 3) {
                    // Combo attack (75% damage)
                    opponent.takeDamage(Math.floor(opponent.maxHp * 0.75));
                    this.comboCount = 0;
                    this.comboTimer = 0;
                } else {
                    // Basic attack (25% damage)
                    opponent.takeDamage(Math.floor(opponent.maxHp * 0.25));
                }
            }
            this.attackCooldown = 30; // 0.5 seconds
        }
        
        // Strong Attack (50% damage) - can only be used once every 2 seconds
        if (!fightAnnouncementActive && this.controls.strongAttack && this.attackCooldown === 0 && this.heavyAttackCooldown === 0) {
            this.isAttacking = true;
            if (rectsOverlap(this.getRect(), opponent.getRect())) {
                opponent.takeDamage(Math.floor(opponent.maxHp * 0.50));
            }
            this.attackCooldown = 45; // 0.75 seconds (longer cooldown for strong attack)
            this.heavyAttackCooldown = 120; // 2 seconds at 60fps
            this.comboCount = 0; // Reset combo on strong attack
            this.comboTimer = 0;
        }
        
        // Update attack cooldowns
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            if (this.attackCooldown === 0) this.isAttacking = false;
        }
        
        // Update heavy attack cooldown
        if (this.heavyAttackCooldown > 0) {
            this.heavyAttackCooldown--;
        }
    }
    takeDamage(amount) {
        this.hp = Math.max(0, this.hp - amount);
    }
    getRect() {
        return { x: this.x, y: this.y, w: this.width, h: this.height };
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        if (this.facing === 1) {
            ctx.drawImage(this.img, -this.width/2, -this.height/2, this.width, this.height);
        } else {
            ctx.scale(-1, 1);
            ctx.drawImage(this.img, -this.width/2, -this.height/2, this.width, this.height);
        }
        ctx.restore();
        // Pasek HP
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x, this.y - 20, this.width, 10);
        ctx.fillStyle = '#e00';
        ctx.fillRect(this.x, this.y - 20, this.width * (this.hp/this.maxHp), 10);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(this.x, this.y - 20, this.width, 10);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x + this.width/2, this.y - 30);
    }
}

function loadImage(src) {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.src = src;
        img.onload = () => resolve(img);
    });
}

async function loadAssets() {
    backgrounds = await Promise.all(ASSETS.backgrounds.map(loadImage));
    characterImgs = await Promise.all(ASSETS.characters.map(loadImage));
    startScreenImg = await loadImage(ASSETS.startScreen);
    theme2Img = await loadImage(ASSETS.theme2);
    winRoundSound = new Audio(ASSETS.winRound);
    fightSound = new Audio(ASSETS.fight);
    for (let i = 0; i < 3; i++) {
        try {
            let img = await loadImage(`assets/level${i+1}.png`);
            levelInscriptions.push(img);
        } catch {
            levelInscriptions.push(null);
        }
    }
}

function randomFromPool(pool) {
    return pool[Math.floor(Math.random() * pool.length)];
}

function startLevel(level) {
    let leftIdx = randomFromPool(leftPool);
    let rightIdx = randomFromPool(rightPool);
    // Place players further apart and vertically centered for 1280x720
    players = [
        new Player(characterImgs[leftIdx], 180, 720 - 240 - 40, 1, controls.left, playerNames[0]),
        new Player(characterImgs[rightIdx], 1280 - 180 - 120, 720 - 240 - 40, -1, controls.right, playerNames[1]),
    ];
    players[0].hp = players[0].maxHp;
    players[1].hp = players[1].maxHp;
    if (isMobile) players[1].name = 'CPU';
}

function drawStartScreen() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(startScreenImg, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial Black';
    ctx.textAlign = 'center';
    ctx.fillText('Press Enter or Tap to Start', canvas.width/2, canvas.height - 80);
}

function drawInscription(level) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgrounds[level], 0, 0, canvas.width, canvas.height);
    if (levelInscriptions[level]) {
        ctx.drawImage(levelInscriptions[level], canvas.width/2-200, canvas.height/2-80, 400, 160);
    } else {
        ctx.fillStyle = '#fff';
        ctx.font = '64px Arial Black';
        ctx.textAlign = 'center';
        ctx.fillText(`Level ${level+1}`, canvas.width/2, canvas.height/2);
    }
}

function drawGame(level) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgIdx = level % backgrounds.length;
    ctx.drawImage(backgrounds[bgIdx], 0, 0, canvas.width, canvas.height);
    players.forEach(p => p.draw());
    ctx.fillStyle = '#fff';
    ctx.font = '28px Arial Black';
    ctx.textAlign = 'left';
    ctx.fillText(`${playerNames[0]}: ${roundsWon[0]}`, 20, 40);
    ctx.textAlign = 'right';
    ctx.fillText(`${playerNames[1]}: ${roundsWon[1]}`, canvas.width - 20, 40);
    
    // Draw fight announcement if active
    if (fightAnnouncementActive) {
        drawFightAnnouncement();
    }
}

function drawFightAnnouncement() {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Big "FIGHT!" text
    ctx.save();
    ctx.fillStyle = '#FFD700'; // Gold color
    ctx.strokeStyle = '#FF0000'; // Red outline
    ctx.lineWidth = 8;
    ctx.font = 'bold 120px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = 'FIGHT!';
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    
    // Draw text with outline
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    
    ctx.restore();
}

function updateGame() {
    if (isMobile) {
        let cpu = players[1];
        let player = players[0];
        
        // CPU can only move and attack when fight announcement is not active
        if (!fightAnnouncementActive) {
            cpu.controls.left = cpu.x > player.x + 100;
            cpu.controls.right = cpu.x < player.x - 100;
            
            // CPU attack logic
            let distance = Math.abs(cpu.x - player.x);
            if (distance < 120 && cpu.attackCooldown === 0) {
                // Randomly choose between basic and strong attack
                // CPU can only use strong attack if heavy attack cooldown is ready
                if (Math.random() < 0.7 || cpu.heavyAttackCooldown > 0) {
                    cpu.controls.basicAttack = true;
                } else {
                    cpu.controls.strongAttack = true;
                }
            } else {
                cpu.controls.basicAttack = false;
                cpu.controls.strongAttack = false;
            }
        } else {
            // Stop all CPU actions during fight announcement
            cpu.controls.left = false;
            cpu.controls.right = false;
            cpu.controls.basicAttack = false;
            cpu.controls.strongAttack = false;
        }
    }
    if (players.length === 2) {
        if (players[0].x < players[1].x) {
            players[0].facing = 1;
            players[1].facing = -1;
        } else {
            players[0].facing = -1;
            players[1].facing = 1;
        }
    }
    players[0].update(players[1]);
    players[1].update(players[0]);
    let [p1, p2] = players;
    p1.hp = Math.max(0, p1.hp);
    p2.hp = Math.max(0, p2.hp);
    if (p1.hp <= 0 || p2.hp <= 0) {
        winner = p1.hp > 0 ? p1.name : p2.name;
        if (p1.hp > 0) roundsWon[0]++;
        else roundsWon[1]++;
        gameState = 'win';
        bgMusic.pause();
        if (winRoundSound) {
            winRoundSound.currentTime = 0;
            winRoundSound.play();
        }
        setTimeout(() => {
            if (roundsWon[0] >= roundsToWin) {
                matchWinner = playerNames[0];
                gameState = 'gameover';
                winSound.currentTime = 0;
                winSound.play();
            } else if (roundsWon[1] >= roundsToWin) {
                matchWinner = playerNames[1];
                gameState = 'gameover';
                winSound.currentTime = 0;
                winSound.play();
            } else {
                currentLevel++;
                gameState = 'start';
                bgMusic.currentTime = 0;
            }
        }, 2500);
    }
}

function drawWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '56px Arial Black';
    ctx.textAlign = 'center';
    ctx.fillText(`${winner} Wins!`, canvas.width/2, canvas.height/2);
}

function drawGameOver() {
    if (theme2Img) {
        ctx.drawImage(theme2Img, 0, 0, canvas.width, canvas.height);
    }
    if (matchWinner) {
        let winnerIdx = matchWinner === playerNames[0] ? 0 : 1;
        let winnerImg = players[winnerIdx].img;
        let srcX = 0;
        let srcY = 0;
        let srcW = winnerImg.width;
        let srcH = Math.floor(winnerImg.height * 0.6);
        let destW = canvas.width * 0.7;
        let destH = canvas.height * 0.7;
        let destX = (canvas.width - destW) / 2;
        let destY = 0;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.filter = 'blur(16px) brightness(2)';
        ctx.drawImage(winnerImg, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
        ctx.filter = 'none';
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(winnerImg, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '48px Arial Black';
    ctx.textAlign = 'center';
    if (matchWinner) {
        ctx.fillText(`${matchWinner} wins the match!`, canvas.width/2, canvas.height/2);
    } else {
        ctx.fillText(`It's a tie!`, canvas.width/2, canvas.height/2);
    }
    ctx.font = '32px Arial';
    ctx.fillText(`${playerNames[0]}: ${roundsWon[0]}  |  ${playerNames[1]}: ${roundsWon[1]}`, canvas.width/2, canvas.height/2 + 60);
    ctx.font = '24px Arial';
    ctx.fillText('Press Enter or Tap to Restart', canvas.width/2, canvas.height - 60);
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function gameLoop() {
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'level') {
        updateGame();
        drawGame(currentLevel);
    } else if (gameState === 'win') {
        drawGame(currentLevel);
        drawWin();
    } else if (gameState === 'gameover') {
        drawGameOver();
    }
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState = 'start';
    currentLevel = 0;
    roundsWon = [0, 0];
    matchWinner = null;
    bgMusic.currentTime = 0;
    bgMusic.play();
}

function playFightSequence() {
    // Activate fight announcement (prevents movement and attacks)
    fightAnnouncementActive = true;
    
    // Play fight sound first
    if (fightSound) {
        fightSound.currentTime = 0;
        fightSound.play();
        
        // Play background music after fight sound ends and allow movement
        fightSound.onended = () => {
            fightAnnouncementActive = false; // Allow movement and attacks
            bgMusic.currentTime = 0;
            bgMusic.play();
        };
    } else {
        // Fallback if fight sound isn't loaded
        fightAnnouncementActive = false;
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('name-overlay');
    const overlayVisible = overlay && overlay.style.display !== 'none';
    // Prevent game start if overlay is visible and Enter is pressed
    if (gameState === 'start' && (e.key === 'Enter' || e.key === ' ')) {
        if (overlayVisible) return;
        if (roundsWon[0] < roundsToWin && roundsWon[1] < roundsToWin) {
            startLevel(currentLevel);
            gameState = 'level';
            playFightSequence();
        } else {
            startGame();
        }
    }
    if (gameState === 'gameover' && (e.key === 'Enter' || e.key === ' ')) {
        startGame();
    }
    // Player 1: A/D movement, W basic attack, S strong attack
    // Player 2: Arrow keys movement, Up basic attack, Down strong attack
    if (!isMobile) {
        if (e.key === 'a' || e.key === 'A') controls.left.left = true;
        if (e.key === 'd' || e.key === 'D') controls.left.right = true;
        if (e.key === 'w' || e.key === 'W') controls.left.basicAttack = true;
        if (e.key === 's' || e.key === 'S') controls.left.strongAttack = true;
        if (e.code === 'ArrowLeft') controls.right.left = true;
        if (e.code === 'ArrowRight') controls.right.right = true;
        if (e.code === 'ArrowUp') controls.right.basicAttack = true;
        if (e.code === 'ArrowDown') controls.right.strongAttack = true;
    }
});
window.addEventListener('keyup', (e) => {
    if (!isMobile) {
        if (e.key === 'a' || e.key === 'A') controls.left.left = false;
        if (e.key === 'd' || e.key === 'D') controls.left.right = false;
        if (e.key === 'w' || e.key === 'W') controls.left.basicAttack = false;
        if (e.key === 's' || e.key === 'S') controls.left.strongAttack = false;
        if (e.code === 'ArrowLeft') controls.right.left = false;
        if (e.code === 'ArrowRight') controls.right.right = false;
        if (e.code === 'ArrowUp') controls.right.basicAttack = false;
        if (e.code === 'ArrowDown') controls.right.strongAttack = false;
    }
});

// Mobile controls
if (isMobile) {
    mobileControls.style.display = 'flex';
    document.getElementById('btn-left').ontouchstart = () => controls.left.left = true;
    document.getElementById('btn-left').ontouchend = () => controls.left.left = false;
    document.getElementById('btn-right').ontouchstart = () => controls.left.right = true;
    document.getElementById('btn-right').ontouchend = () => controls.left.right = false;
    
    // Mobile attack button acts as basic attack (tap) or strong attack (long press)
    let attackPressTimer = 0;
    let isLongPress = false;
    
    document.getElementById('btn-attack').ontouchstart = () => {
        attackPressTimer = setTimeout(() => {
            isLongPress = true;
            controls.left.strongAttack = true;
        }, 500); // 500ms for long press
    };
    
    document.getElementById('btn-attack').ontouchend = () => {
        clearTimeout(attackPressTimer);
        if (!isLongPress) {
            controls.left.basicAttack = true;
            setTimeout(() => controls.left.basicAttack = false, 100);
        } else {
            controls.left.strongAttack = false;
        }
        isLongPress = false;
    };
    
    canvas.addEventListener('touchstart', () => {
        if (gameState === 'start') {
            startLevel(currentLevel);
            gameState = 'level';
            playFightSequence();
        } else if (gameState === 'gameover') {
            startGame();
        }
    });
}

canvas.addEventListener('mousedown', () => {
    if (gameState === 'start') {
        startLevel(currentLevel);
        gameState = 'level';
        playFightSequence();
    } else if (gameState === 'gameover') {
        startGame();
    }
});

window.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

window.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('name-overlay');
    const leftInput = document.getElementById('name-left');
    const rightInput = document.getElementById('name-right');
    const startBtn = document.getElementById('start-names');
    startBtn.onclick = () => {
        playerNames[0] = leftInput.value.trim() || "Player 1";
        playerNames[1] = rightInput.value.trim() || (isMobile ? "CPU" : "Player 2");
        overlay.style.display = 'none';
    };
    winSound.onended = () => {
        bgMusic.currentTime = 0;
        bgMusic.play();
    };
});

loadAssets().then(() => {
    gameLoop();
});
