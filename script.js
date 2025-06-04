
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
    characters: {
        idle: [
            'assets/character1.png',
            'assets/character2.png',
            'assets/character3.png',
            'assets/character4.png',
            'assets/character5.png',
            'assets/character6.png',
        ],
        walk: [
            'assets/character1w.png',
            'assets/character2w.png',
            'assets/character3w.png',
            'assets/character4w.png',
            'assets/character5w.png',
            'assets/character6w.png',
        ],
        attack: [
            'assets/character1p.png',
            'assets/character2p.png',
            'assets/character3p.png',
            'assets/character4p.png',
            'assets/character5p.png',
            'assets/character6p.png',
        ],
        heavyAttack: [
            'assets/character1k.png',
            'assets/character2k.png',
            'assets/character3k.png',
            'assets/character4k.png',
            'assets/character5k.png',
            'assets/character6k.png',
        ]
    },
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
const mobileControlsSplit = document.getElementById('mobile-controls-split');

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
let characterImgs = {
    idle: [],
    walk: [],
    attack: [],
    heavyAttack: []
};
let startScreenImg = null;
let theme2Img = null;
let levelInscriptions = [];

const controls = {
    left: { left: false, right: false, basicAttack: false, strongAttack: false },
    right: { left: false, right: false, basicAttack: false, strongAttack: false },
};

class Player {
    constructor(characterIndex, x, y, facing, controls, name) {
        this.characterIndex = characterIndex;
        this.x = x;
        this.y = y;
        // Make characters bigger on mobile
        if (isMobile) {
            this.width = characterIndex === 1 ? 200 : 150;
            this.height = 300;
        } else {
            this.width = characterIndex === 1 ? 160 : 120;
            this.height = 240;
        }
        this.facing = facing;
        this.controls = controls;
        this.name = name;
        this.maxHp = 100;
        this.hp = 100;
        this.isAttacking = false;
        this.isHeavyAttacking = false;
        this.attackCooldown = 0;
        this.heavyAttackCooldown = 0;
        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboWindow = 60;
        this.isMoving = false;
    }
    update(opponent) {
        this.isMoving = false;

        if (!fightAnnouncementActive) {
            if (this.controls.left) {
                this.x -= 3;
                this.isMoving = true;
            }
            if (this.controls.right) {
                this.x += 3;
                this.isMoving = true;
            }
            this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        }
        
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) {
                this.comboCount = 0;
            }
        }
        
        if (!fightAnnouncementActive && this.controls.basicAttack && this.attackCooldown === 0) {
            this.isAttacking = true;
            this.isHeavyAttacking = false;
            if (rectsOverlap(this.getRect(), opponent.getRect())) {
                this.comboCount++;
                this.comboTimer = this.comboWindow;
                
                if (this.comboCount >= 3) {
                    opponent.takeDamage(Math.floor(opponent.maxHp * 0.75));
                    this.comboCount = 0;
                    this.comboTimer = 0;
                } else {
                    opponent.takeDamage(Math.floor(opponent.maxHp * 0.25));
                }
            }
            this.attackCooldown = 30;
        }
        

        if (!fightAnnouncementActive && this.controls.strongAttack && this.attackCooldown === 0 && this.heavyAttackCooldown === 0) {
            this.isAttacking = true;
            this.isHeavyAttacking = true;
            if (rectsOverlap(this.getRect(), opponent.getRect())) {
                opponent.takeDamage(Math.floor(opponent.maxHp * 0.50));
            }
            this.attackCooldown = 45;
            this.heavyAttackCooldown = 120;
            this.comboCount = 0;
            this.comboTimer = 0;
        }
        

        if (this.attackCooldown > 0) {
            this.attackCooldown--;
            if (this.attackCooldown === 0) {
                this.isAttacking = false;
                this.isHeavyAttacking = false;
            }
        }
        
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
        let currentImg;
        if (this.isAttacking && this.isHeavyAttacking) {
            currentImg = characterImgs.heavyAttack[this.characterIndex];
        } else if (this.isAttacking) {
            currentImg = characterImgs.attack[this.characterIndex];
        } else if (this.isMoving) {
            currentImg = characterImgs.walk[this.characterIndex];
        } else {
            currentImg = characterImgs.idle[this.characterIndex];
        }

        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        if (this.facing === 1) {
            ctx.drawImage(currentImg, -this.width/2, -this.height/2, this.width, this.height);
        } else {
            ctx.scale(-1, 1);
            ctx.drawImage(currentImg, -this.width/2, -this.height/2, this.width, this.height);
        }
        ctx.restore();
        
        // Draw player name above character
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = isMobile ? 3 : 2;
        ctx.font = isMobile ? '24px Arial Black' : '16px Arial Black';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const nameX = this.x + this.width/2;
        const nameY = this.y - (isMobile ? 15 : 10);
        ctx.strokeText(this.name, nameX, nameY);
        ctx.fillText(this.name, nameX, nameY);
        ctx.restore();
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
    characterImgs.idle = await Promise.all(ASSETS.characters.idle.map(loadImage));
    characterImgs.walk = await Promise.all(ASSETS.characters.walk.map(loadImage));
    characterImgs.attack = await Promise.all(ASSETS.characters.attack.map(loadImage));
    characterImgs.heavyAttack = await Promise.all(ASSETS.characters.heavyAttack.map(loadImage));
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
    players = [
        new Player(leftIdx, 180, 720 - 240 - 40, 1, controls.left, playerNames[0]),
        new Player(rightIdx, 1280 - 180 - 120, 720 - 240 - 40, -1, controls.right, playerNames[1]),
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

function drawHealthBars() {
    if (players.length < 2) return;
    // Make health bars bigger on mobile
    const barWidth = isMobile ? 400 : 300;
    const barHeight = isMobile ? 30 : 20;
    const barY = isMobile ? 30 : 20;
    const leftBarX = isMobile ? 30 : 20;
    const rightBarX = canvas.width - barWidth - (isMobile ? 30 : 20);
    
    // Left player health bar
    ctx.fillStyle = '#222';
    ctx.fillRect(leftBarX, barY, barWidth, barHeight);
    ctx.fillStyle = '#e00';
    ctx.fillRect(leftBarX, barY, barWidth * (players[0].hp / players[0].maxHp), barHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.strokeRect(leftBarX, barY, barWidth, barHeight);
    ctx.fillStyle = '#fff';
    ctx.font = isMobile ? '24px Arial Black' : '18px Arial Black';
    ctx.textAlign = 'left';
    ctx.fillText(players[0].name, leftBarX, barY - (isMobile ? 8 : 5));
    ctx.font = isMobile ? '18px Arial' : '14px Arial';
    ctx.fillText(`${Math.ceil(players[0].hp)}/${players[0].maxHp}`, leftBarX + 5, barY + (isMobile ? 22 : 15));
    
    // Right player health bar
    ctx.fillStyle = '#222';
    ctx.fillRect(rightBarX, barY, barWidth, barHeight);
    ctx.fillStyle = '#e00';
    ctx.fillRect(rightBarX, barY, barWidth * (players[1].hp / players[1].maxHp), barHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = isMobile ? 3 : 2;
    ctx.strokeRect(rightBarX, barY, barWidth, barHeight);
    ctx.fillStyle = '#fff';
    ctx.font = isMobile ? '24px Arial Black' : '18px Arial Black';
    ctx.textAlign = 'right';
    ctx.fillText(players[1].name, rightBarX + barWidth, barY - (isMobile ? 8 : 5));
    ctx.font = isMobile ? '18px Arial' : '14px Arial';
    ctx.fillText(`${Math.ceil(players[1].hp)}/${players[1].maxHp}`, rightBarX + barWidth - 5, barY + (isMobile ? 22 : 15));
}

function drawGame(level) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bgIdx = level % backgrounds.length;
    ctx.drawImage(backgrounds[bgIdx], 0, 0, canvas.width, canvas.height);
    players.forEach(p => p.draw());
    drawHealthBars();
    ctx.fillStyle = '#fff';
    ctx.font = '28px Arial Black';
    ctx.textAlign = 'left';
    ctx.fillText(`${playerNames[0]}: ${roundsWon[0]}`, 20, 80);
    ctx.textAlign = 'right';
    ctx.fillText(`${playerNames[1]}: ${roundsWon[1]}`, canvas.width - 20, 80);
    if (fightAnnouncementActive) {
        drawFightAnnouncement();
    }
}

function drawFightAnnouncement() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 8;
    ctx.font = 'bold 120px Arial Black';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'FIGHT!';
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.restore();
}

function updateGame() {
    if (isMobile) {
        let cpu = players[1];
        let player = players[0];
        if (!fightAnnouncementActive) {
            cpu.controls.left = cpu.x > player.x + 100;
            cpu.controls.right = cpu.x < player.x - 100;
            let distance = Math.abs(cpu.x - player.x);
            if (distance < 120 && cpu.attackCooldown === 0) {
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
        let winnerImg = characterImgs.idle[players[winnerIdx].characterIndex];
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
    fightAnnouncementActive = true;
    if (fightSound) {
        fightSound.currentTime = 0;
        fightSound.play();
        fightSound.onended = () => {
            fightAnnouncementActive = false;
            bgMusic.currentTime = 0;
            bgMusic.play();
        };
    } else {
        fightAnnouncementActive = false;
        bgMusic.currentTime = 0;
        bgMusic.play();
    }
}

window.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('name-overlay');
    const overlayVisible = overlay && overlay.style.display !== 'none';
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

function updateMobileControlsVisibility() {
    if (!isMobile) return;
    
    const isLandscape = window.innerWidth > window.innerHeight;
    
    if (isLandscape) {
        mobileControls.style.display = 'none';
        mobileControlsSplit.style.display = 'flex';
    } else {
        mobileControls.style.display = 'flex';
        mobileControlsSplit.style.display = 'none';
    }
}

function setupMobileControls() {
    // Regular mobile controls (portrait)
    document.getElementById('btn-left').ontouchstart = () => controls.left.left = true;
    document.getElementById('btn-left').ontouchend = () => controls.left.left = false;
    document.getElementById('btn-right').ontouchstart = () => controls.left.right = true;
    document.getElementById('btn-right').ontouchend = () => controls.left.right = false;
    
    let attackPressTimer = 0;
    let isLongPress = false;
    document.getElementById('btn-attack').ontouchstart = () => {
        attackPressTimer = setTimeout(() => {
            isLongPress = true;
            controls.left.strongAttack = true;
        }, 500);
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
    
    const btnHeavy = document.getElementById('btn-heavy');
    if (btnHeavy) {
        btnHeavy.ontouchstart = () => {
            controls.left.strongAttack = true;
        };
        btnHeavy.ontouchend = () => {
            controls.left.strongAttack = false;
        };
    }
    
    // Split mobile controls (landscape)
    document.getElementById('btn-left-split').ontouchstart = () => controls.left.left = true;
    document.getElementById('btn-left-split').ontouchend = () => controls.left.left = false;
    document.getElementById('btn-right-split').ontouchstart = () => controls.left.right = true;
    document.getElementById('btn-right-split').ontouchend = () => controls.left.right = false;
    
    let attackPressTimerSplit = 0;
    let isLongPressSplit = false;
    document.getElementById('btn-attack-split').ontouchstart = () => {
        attackPressTimerSplit = setTimeout(() => {
            isLongPressSplit = true;
            controls.left.strongAttack = true;
        }, 500);
    };
    document.getElementById('btn-attack-split').ontouchend = () => {
        clearTimeout(attackPressTimerSplit);
        if (!isLongPressSplit) {
            controls.left.basicAttack = true;
            setTimeout(() => controls.left.basicAttack = false, 100);
        } else {
            controls.left.strongAttack = false;
        }
        isLongPressSplit = false;
    };
    
    const btnHeavySplit = document.getElementById('btn-heavy-split');
    if (btnHeavySplit) {
        btnHeavySplit.ontouchstart = () => {
            controls.left.strongAttack = true;
        };
        btnHeavySplit.ontouchend = () => {
            controls.left.strongAttack = false;
        };
    }
}

if (isMobile) {
    setupMobileControls();
    updateMobileControlsVisibility();
    
    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
        setTimeout(updateMobileControlsVisibility, 100);
    });
    window.addEventListener('resize', updateMobileControlsVisibility);
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
