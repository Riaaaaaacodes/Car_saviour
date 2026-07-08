const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameOverReason = document.getElementById('game-over-reason');
const scoreVal = document.getElementById('score-val');
const levelVal = document.getElementById('level-val');
const speedVal = document.getElementById('speed-val');
const finalScore = document.getElementById('final-score');
const fuelBarInner = document.getElementById('fuel-bar-inner');

// Game Parameters
let gameActive = false;
let score = 0;
let currentLevel = 1;
let speed = 5;
let baseSpeed = 5;
let maxSpeed = 18;
let fuel = 100;

// Timing Trackers
let lastLevelUpTime = 0;

// Player Properties (Neon Pink Car)
const player = {
    x: 180,
    y: 500,
    width: 40,
    height: 70,
    speed: 8
};

let keys = { ArrowLeft: false, ArrowRight: false };
const lanes = [65, 145, 225, 305]; 
let entities = []; // Holds obstacles and fuel tanks
let roadStripesY = 0;

// Web Audio API Synthesizer Engine (Fixed to prevent freezing)
let audioCtx = null;
let musicInterval = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playRetroMusic() {
    initAudio();
    let noteIndex = 0;
    // Classic driving bass loop progression
    const bassline = [110, 110, 130, 130, 146, 146, 98, 98, 110, 110, 165, 165, 146, 130, 110, 82];
    
    // Clear any existing interval before starting a new one
    if (musicInterval) clearInterval(musicInterval);

    musicInterval = setInterval(() => {
        if (!gameActive || !audioCtx) return;
        
        try {
            let osc = audioCtx.createOscillator();
            let gain = audioCtx.createGain();
            
            osc.type = 'sawtooth'; 
            osc.frequency.setValueAtTime(bassline[noteIndex % bassline.length], audioCtx.currentTime);
            
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 0.22);
            
            noteIndex++;
        } catch (e) {
            console.log("Audio node allocation bypassed to prevent crash.");
        }
    }, 250);
}

function playSFX(type) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    try {
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'fuel') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'crash' || type === 'empty') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(30, audioCtx.currentTime + 0.5);
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        } else if (type === 'levelup') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.1);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.35);
        }
    } catch (e) {
        // Fallback catch silently to prevent core loop execution breakages
    }
}

// Procedural Dynamic Favicon Generation
function generateFavicon() {
    const favCanvas = document.createElement('canvas');
    favCanvas.width = 16;
    favCanvas.height = 16;
    const favCtx = favCanvas.getContext('2d');
    
    favCtx.fillStyle = '#ff00aa';
    favCtx.fillRect(3, 2, 10, 12);
    favCtx.fillStyle = '#00ffff';
    favCtx.fillRect(4, 5, 8, 3);
    favCtx.fillStyle = '#000000';
    favCtx.fillRect(1, 3, 2, 3);
    favCtx.fillRect(13, 3, 2, 3);
    favCtx.fillRect(1, 10, 2, 3);
    favCtx.fillRect(13, 10, 2, 3);
    
    document.getElementById('favicon').href = favCanvas.toDataURL();
}

// Listeners
window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.key === 'Enter' && !gameActive) {
        initGame();
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

function initGame() {
    score = 0;
    currentLevel = 1;
    speed = baseSpeed;
    fuel = 100;
    entities = [];
    player.x = 180;
    lastLevelUpTime = Date.now();
    gameActive = true;
    
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    playRetroMusic();
    animate();
}

function spawnEntities() {
    if (Math.random() < 0.03 && entities.length < 5) {
        const laneIdx = Math.floor(Math.random() * lanes.length);
        if (entities.some(e => e.lane === laneIdx && e.y < 160)) return;

        const rand = Math.random();
        
        if (rand < 0.18) { 
            // Spawn Fuel Tank Item
            entities.push({
                lane: laneIdx,
                x: lanes[laneIdx] + 10,
                y: -50,
                width: 20,
                height: 30,
                type: 'fuel',
                color: '#00ff00'
            });
        } else {
            // Spawn Enemy Obstacle
            const isBike = rand > 0.6; 
            entities.push({
                lane: laneIdx,
                x: lanes[laneIdx] + (isBike ? 12 : 0),
                y: -80,
                width: isBike ? 16 : 40,
                height: isBike ? 50 : 70,
                type: isBike ? 'bike' : 'car',
                color: isBike ? '#33fff3' : '#ffcc00' 
            });
        }
    }
}

function drawPlayer() {
    ctx.fillStyle = '#ff00aa';
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(player.x + 5, player.y + 20, player.width - 10, 15);
    
    ctx.fillStyle = '#000';
    ctx.fillRect(player.x - 4, player.y + 8, 4, 14);
    ctx.fillRect(player.x + player.width, player.y + 8, 4, 14);
    ctx.fillRect(player.x - 4, player.y + 48, 4, 14);
    ctx.fillRect(player.x + player.width, player.y + 48, 4, 14);

    ctx.fillStyle = '#fff700';
    ctx.fillRect(player.x + (player.width/2) - 2, player.y, 4, player.height);
}

function drawEntities() {
    entities.forEach(ent => {
        ctx.fillStyle = ent.color;
        ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
        
        if (ent.type === 'car') {
            ctx.fillStyle = '#222';
            ctx.fillRect(ent.x + 5, ent.y + 35, ent.width - 10, 12);
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(ent.x + 4, ent.y + ent.height - 6, 6, 6);
            ctx.fillRect(ent.x + ent.width - 10, ent.y + ent.height - 6, 6, 6);
        } else if (ent.type === 'bike') {
            ctx.fillStyle = '#000';
            ctx.fillRect(ent.x + 2, ent.y + 15, ent.width - 4, 20);
            ctx.fillStyle = '#fff'; 
            ctx.fillRect(ent.x + 4, ent.y + 10, ent.width - 8, 8);
        } else if (ent.type === 'fuel') {
            ctx.fillStyle = '#fff';
            ctx.fillRect(ent.x + 6, ent.y - 4, 8, 4);
            ctx.fillStyle = '#000';
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText('F', ent.x + 6, ent.y + 18);
        }
    });
}

function drawBackground() {
    ctx.fillStyle = '#333';
    ctx.fillRect(50, 0, 300, canvas.height);
    
    ctx.fillStyle = '#008800';
    ctx.fillRect(0, 0, 50, canvas.height);
    ctx.fillRect(350, 0, 50, canvas.height);

    ctx.fillStyle = (Math.floor(roadStripesY / 20) % 2 === 0) ? '#ff0000' : '#ffffff';
    ctx.fillRect(44, 0, 6, canvas.height);
    ctx.fillRect(350, 0, 6, canvas.height);

    roadStripesY += speed;
    if (roadStripesY >= 40) roadStripesY = 0;

    ctx.fillStyle = '#ffffff';
    for (let i = -40; i < canvas.height; i += 40) {
        ctx.fillRect(130, i + roadStripesY, 4, 20);
        ctx.fillRect(210, i + roadStripesY, 4, 20);
        ctx.fillRect(290, i + roadStripesY, 4, 20);
    }
}

function updateLogic() {
    if (keys.ArrowLeft && player.x > 55) player.x -= player.speed;
    if (keys.ArrowRight && player.x < 345 - player.width) player.x += player.speed;

    // Fuel Consumption
    fuel -= 0.05 + (currentLevel * 0.01);
    if (fuel <= 0) {
        fuel = 0;
        endGame('OUT OF FUEL!');
        return;
    }
    
    fuelBarInner.style.width = fuel + '%';
    if (fuel > 50) fuelBarInner.style.backgroundColor = '#00ff00';
    else if (fuel > 20) fuelBarInner.style.backgroundColor = '#ffcc00';
    else fuelBarInner.style.backgroundColor = '#ff0000';

    // 1-Minute Level Up System
    if (Date.now() - lastLevelUpTime >= 60000) {
        currentLevel++;
        lastLevelUpTime = Date.now();
        speed = Math.min(baseSpeed + (currentLevel - 1) * 3, maxSpeed);
        playSFX('levelup');
    }

    spawnEntities();

    for (let i = entities.length - 1; i >= 0; i--) {
        entities[i].y += speed - 0.5;

        // Collision Check (AABB)
        if (
            player.x < entities[i].x + entities[i].width &&
            player.x + player.width > entities[i].x &&
            player.y < entities[i].y + entities[i].height &&
            player.y + player.height > entities[i].y
        ) {
            if (entities[i].type === 'fuel') {
                fuel = Math.min(fuel + 35, 100); 
                playSFX('fuel');
                entities.splice(i, 1);
            } else {
                endGame('YOU CRASHED!');
                return;
            }
            continue;
        }

        // Cleanup out of bounds
        if (entities[i].y > canvas.height) {
            if (entities[i].type !== 'fuel') {
                score += entities[i].type === 'bike' ? 150 : 100;
            }
            entities.splice(i, 1);
        }
    }

    scoreVal.innerText = String(score).padStart(5, '0');
    levelVal.innerText = currentLevel;
    speedVal.innerText = Math.floor(speed * 12);
}

function endGame(reason) {
    gameActive = false;
    clearInterval(musicInterval); // Stop music loop immediately on game over
    finalScore.innerText = score;
    gameOverReason.innerText = reason;
    gameOverScreen.classList.remove('hidden');
    
    if (reason.includes('FUEL')) playSFX('empty');
    else playSFX('crash');
}

function animate() {
    if (!gameActive) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawBackground();
    updateLogic();
    drawEntities();
    drawPlayer();
    
    requestAnimationFrame(animate);
}

generateFavicon();
