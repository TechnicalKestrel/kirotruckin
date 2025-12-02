// Game Configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Game State
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let frame = 0;
let totalMiles = 0;

// Player/Truck
const truck = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    width: 80,
    height: 60,
    speed: 0,
    maxSpeed: 10, // Max speed for visual movement (represents 100 mph)
    acceleration: 0.2,
    deceleration: 0.15,
    lane: 1, // 0=top, 1=middle, 2=bottom, 3=pit stop
    targetY: canvas.height / 2,
    atPitStop: false,
    pitStopTimer: 0,
    currentStopType: null
};

// Resources (deplete based on miles traveled)
const resources = {
    hunger: 100,
    sleep: 100,
    gas: 100
};

// Stats tracking
let playTime = 0; // in seconds
let money = 0;
let deliveryMilesRemaining = 100;
let currentDeliveryDistance = 100; // Track the full delivery distance
let milesSinceLastStop = { gas: 0, food: 0, rest: 0 };
let nextStopDistance = { gas: 50, food: 70, rest: 60 };

// Lanes (horizontal now - top, middle, bottom)
const lanes = [
    canvas.height / 2 - 100,
    canvas.height / 2,
    canvas.height / 2 + 100
];

// Pit stop lane (above the road)
const pitStopLane = 120;

// Game Objects
let obstacles = [];
let roadMarkers = [];
let stops = []; // gas stations, food, rest stops

// Input
const keys = {};

// Load Kiro Logo
const kiroLogo = new Image();
kiroLogo.src = 'kiro-logo.png';

// Initialize road markers (vertical lines moving left)
function initRoadMarkers() {
    for (let i = 0; i < 20; i++) {
        roadMarkers.push({
            x: i * 60,
            width: 40
        });
    }
}



// Spawn obstacle (traffic going same direction at variable speeds)
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const types = ['car', 'truck'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Variable speeds - some slower, some faster than max truck speed
    const vehicleSpeed = 3 + Math.random() * 8; // 3-11 speed range
    
    // Always spawn from behind (left side only)
    obstacles.push({
        x: -100,
        y: lanes[lane],
        width: type === 'truck' ? 90 : 60,
        height: type === 'truck' ? 60 : 50,
        type: type,
        speed: vehicleSpeed,
        color: type === 'truck' ? '#4a4a4a' : '#' + Math.floor(Math.random()*16777215).toString(16)
    });
}

// Spawn stop (gas, food, rest) - appears from right side at pit stop lane
function spawnStop(type) {
    stops.push({
        x: canvas.width + 100,
        y: pitStopLane,
        width: 80,
        height: 60,
        type: type,
        collected: false
    });
}

// Check collision
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// Update game
function update() {
    if (gameState !== 'playing') return;
    
    frame++;
    
    // Handle acceleration/braking
    if (keys['ArrowRight']) {
        truck.speed = Math.min(truck.speed + truck.acceleration, truck.maxSpeed);
    } else if (keys['ArrowLeft']) {
        truck.speed = Math.max(truck.speed - truck.deceleration * 2, 0);
    } else {
        // Natural deceleration
        truck.speed = Math.max(truck.speed - truck.deceleration * 0.5, 0);
    }
    
    // Check if there's an upcoming pit stop to allow lane access
    let canAccessPitStop = false;
    stops.forEach(stop => {
        // Allow access if stop is within 300 pixels ahead
        if (!stop.collected && stop.x > truck.x && stop.x < truck.x + 300) {
            canAccessPitStop = true;
        }
    });
    
    // Lane switching (now up/down for vertical lanes)
    if (truck.lane !== 3) {
        // Normal lane switching on the road
        if (keys['ArrowUp'] && truck.lane > 0 && !truck.atPitStop) {
            truck.lane--;
            keys['ArrowUp'] = false;
        }
        if (keys['ArrowDown'] && truck.lane < 2 && !truck.atPitStop) {
            truck.lane++;
            keys['ArrowDown'] = false;
        }
        
        // Allow going to pit stop lane only when stop is nearby and from top lane
        if (keys['ArrowUp'] && truck.lane === 0 && canAccessPitStop && !truck.atPitStop) {
            truck.lane = 3; // pit stop lane
            keys['ArrowUp'] = false;
        }
    } else {
        // In pit stop lane - only allow going down to top lane
        if (keys['ArrowDown'] && !truck.atPitStop) {
            truck.lane = 0;
            keys['ArrowDown'] = false;
        }
        
        // Block up arrow in pit stop lane
        if (keys['ArrowUp']) {
            keys['ArrowUp'] = false;
        }
        
        // Auto-return from pit stop lane after leaving stop area
        if (!canAccessPitStop && !truck.atPitStop) {
            truck.lane = 0;
        }
    }
    
    // Smooth lane movement
    if (truck.lane === 3) {
        truck.targetY = pitStopLane;
    } else {
        truck.targetY = lanes[truck.lane];
    }
    truck.y += (truck.targetY - truck.y) * 0.15;
    
    // Update stats (much slower mile accumulation)
    const milesThisFrame = truck.speed * 0.02; // Slower mile accumulation
    totalMiles += milesThisFrame;
    deliveryMilesRemaining -= milesThisFrame;
    
    // Track miles for stop spawning
    milesSinceLastStop.gas += milesThisFrame;
    milesSinceLastStop.food += milesThisFrame;
    milesSinceLastStop.rest += milesThisFrame;
    
    // Debug log every 60 frames
    if (frame % 60 === 0) {
        console.log('Miles:', totalMiles.toFixed(2), 'Since last stop:', milesSinceLastStop, 'Stops count:', stops.length);
    }
    
    // Update resources based on miles traveled
    resources.gas -= (milesThisFrame / 1000) * 100; // Depletes fully every 1000 miles
    resources.hunger -= (milesThisFrame / 1500) * 100; // Depletes fully every 1500 miles
    resources.sleep -= (milesThisFrame / 1250) * 100; // Depletes fully every 1250 miles
    
    // Check resource depletion
    if (resources.hunger <= 0 || resources.sleep <= 0 || resources.gas <= 0) {
        gameState = 'gameOver';
        return;
    }
    
    // Complete delivery and start new one
    if (deliveryMilesRemaining <= 0) {
        money += currentDeliveryDistance; // $1 per mile of the full delivery
        currentDeliveryDistance = generateDeliveryDistance();
        deliveryMilesRemaining = currentDeliveryDistance;
    }
    
    // Update play time (every 60 frames = 1 second)
    if (frame % 60 === 0) {
        playTime++;
    }
    
    // Update road markers (move left)
    roadMarkers.forEach(marker => {
        marker.x -= truck.speed;
        if (marker.x < -60) {
            marker.x = canvas.width;
        }
    });
    
    // Spawn obstacles (more frequently)
    if (frame % 80 === 0) {
        spawnObstacle();
    }
    
    // Spawn stops based on miles traveled (much more frequent for testing)
    // Gas stations: spawn every 5-10 miles
    if (milesSinceLastStop.gas > nextStopDistance.gas) {
        spawnStop('gas');
        milesSinceLastStop.gas = 0;
        nextStopDistance.gas = 5 + Math.random() * 5;
        console.log('Gas stop spawned at', totalMiles, 'miles');
    }
    
    // Food stops: spawn every 7-12 miles
    if (milesSinceLastStop.food > nextStopDistance.food) {
        spawnStop('food');
        milesSinceLastStop.food = 0;
        nextStopDistance.food = 7 + Math.random() * 5;
        console.log('Food stop spawned at', totalMiles, 'miles');
    }
    
    // Rest stops: spawn every 6-11 miles
    if (milesSinceLastStop.rest > nextStopDistance.rest) {
        spawnStop('rest');
        milesSinceLastStop.rest = 0;
        nextStopDistance.rest = 6 + Math.random() * 5;
        console.log('Rest stop spawned at', totalMiles, 'miles');
    }
    
    // Update obstacles (traffic moving at their own speeds)
    obstacles.forEach((obs, index) => {
        // Move obstacle at its speed relative to road
        // Subtract truck speed to simulate relative motion
        obs.x += (obs.speed - truck.speed);
        
        // Check collision
        if (checkCollision(truck, obs)) {
            gameState = 'gameOver';
        }
        
        // Remove if far off-screen (either direction)
        if (obs.x < -200 || obs.x > canvas.width + 200) {
            obstacles.splice(index, 1);
        }
    });
    
    // Handle pit stop pause and replenishment
    if (truck.atPitStop) {
        truck.pitStopTimer++;
        
        // Replenish resources gradually over 5 seconds (300 frames)
        const replenishRate = 100 / 300; // Full replenish in 5 seconds
        
        if (truck.currentStopType === 'gas') {
            resources.gas = Math.min(100, resources.gas + replenishRate);
        } else if (truck.currentStopType === 'food') {
            resources.hunger = Math.min(100, resources.hunger + replenishRate);
        } else if (truck.currentStopType === 'rest') {
            resources.sleep = Math.min(100, resources.sleep + replenishRate);
        }
        
        // Release after 5 seconds or when fully replenished
        const targetResource = truck.currentStopType === 'gas' ? resources.gas : 
                              truck.currentStopType === 'food' ? resources.hunger : resources.sleep;
        
        if (truck.pitStopTimer >= 300 || targetResource >= 100) {
            truck.atPitStop = false;
            truck.pitStopTimer = 0;
            truck.currentStopType = null;
        }
    }
    
    // Update stops (stationary - don't move)
    stops.forEach((stop, index) => {
        // Stops don't move - they stay in place
        
        // Check collection when truck overlaps with stop
        if (!stop.collected && checkCollision(truck, stop)) {
            stop.collected = true;
            truck.atPitStop = true;
            truck.pitStopTimer = 0;
            truck.currentStopType = stop.type;
        }
        
        // Remove if truck passed it far behind
        if (truck.x > stop.x + 200) {
            stops.splice(index, 1);
        }
    });
}

// Draw game
function draw() {
    // Clear canvas
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'playing') {
        drawGame();
    } else if (gameState === 'gameOver') {
        drawGameOver();
    }
}

function drawStartScreen() {
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('KIRO TRUCKIN\'', canvas.width / 2, canvas.height / 2 - 80);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Courier New';
    ctx.fillText('Press SPACE or Click to Start!', canvas.width / 2, canvas.height / 2);
    
    ctx.fillStyle = '#cccccc';
    ctx.font = '16px Courier New';
    ctx.fillText('Right/Left: Accelerate/Brake | Up/Down: Change Lanes', canvas.width / 2, canvas.height / 2 + 60);
    ctx.fillText('Drive through pit stops at top to refuel!', canvas.width / 2, canvas.height / 2 + 90);
    ctx.fillText('Survive as long as possible!', canvas.width / 2, canvas.height / 2 + 120);
}

function drawGame() {
    // Draw road (horizontal)
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, canvas.height / 2 - 150, canvas.width, 300);
    
    // Draw lane markers (horizontal dashes)
    ctx.fillStyle = '#ffff00';
    roadMarkers.forEach(marker => {
        ctx.fillRect(marker.x, canvas.height / 2 - 50, marker.width, 4);
        ctx.fillRect(marker.x, canvas.height / 2 + 46, marker.width, 4);
    });
    
    // Draw pit stop area background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2 - 150);
    
    // Draw pit stop lane indicator when stop is nearby
    let canAccessPitStop = false;
    stops.forEach(stop => {
        if (!stop.collected && stop.x > truck.x && stop.x < truck.x + 300) {
            canAccessPitStop = true;
        }
    });
    
    if (canAccessPitStop && truck.lane === 0) {
        // Draw flashing arrow indicator
        if (Math.floor(frame / 15) % 2 === 0) {
            ctx.fillStyle = '#790ECB';
            ctx.font = 'bold 30px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('↑ PIT STOP', canvas.width / 2, 180);
        }
    }
    
    // Draw stops at pit stop lane
    stops.forEach(stop => {
        if (!stop.collected) {
            if (stop.type === 'gas') {
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(stop.x - stop.width / 2, stop.y - stop.height / 2, stop.width, stop.height);
                ctx.fillStyle = '#000000';
                ctx.font = '14px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('⛽', stop.x, stop.y + 5);
            } else if (stop.type === 'food') {
                ctx.fillStyle = '#ff9900';
                ctx.fillRect(stop.x - stop.width / 2, stop.y - stop.height / 2, stop.width, stop.height);
                ctx.fillStyle = '#000000';
                ctx.font = '14px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('🍔', stop.x, stop.y + 5);
            } else if (stop.type === 'rest') {
                ctx.fillStyle = '#0099ff';
                ctx.fillRect(stop.x - stop.width / 2, stop.y - stop.height / 2, stop.width, stop.height);
                ctx.fillStyle = '#000000';
                ctx.font = '14px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('🛏️', stop.x, stop.y + 5);
            }
        }
    });
    
    // Draw obstacles
    obstacles.forEach(obs => {
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height);
    });
    
    // Draw truck (Kiro logo)
    if (kiroLogo.complete) {
        ctx.drawImage(kiroLogo, truck.x - truck.width / 2, truck.y - truck.height / 2, truck.width, truck.height);
    } else {
        ctx.fillStyle = '#790ECB';
        ctx.fillRect(truck.x - truck.width / 2, truck.y - truck.height / 2, truck.width, truck.height);
    }
    
    // Draw HUD
    drawHUD();
}

function drawHUD() {
    ctx.textAlign = 'left';
    
    // Resources
    const barWidth = 150;
    const barHeight = 20;
    const barX = 20;
    let barY = 20;
    
    // Hunger
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Courier New';
    ctx.fillText('Hunger', barX, barY);
    ctx.fillStyle = '#444444';
    ctx.fillRect(barX, barY + 5, barWidth, barHeight);
    ctx.fillStyle = resources.hunger > 30 ? '#ff9900' : '#ff0000';
    ctx.fillRect(barX, barY + 5, (resources.hunger / 100) * barWidth, barHeight);
    
    barY += 35;
    
    // Sleep
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Sleep', barX, barY);
    ctx.fillStyle = '#444444';
    ctx.fillRect(barX, barY + 5, barWidth, barHeight);
    ctx.fillStyle = resources.sleep > 30 ? '#0099ff' : '#ff0000';
    ctx.fillRect(barX, barY + 5, (resources.sleep / 100) * barWidth, barHeight);
    
    barY += 35;
    
    // Gas
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Gas', barX, barY);
    ctx.fillStyle = '#444444';
    ctx.fillRect(barX, barY + 5, barWidth, barHeight);
    ctx.fillStyle = resources.gas > 30 ? '#00ff00' : '#ff0000';
    ctx.fillRect(barX, barY + 5, (resources.gas / 100) * barWidth, barHeight);
    
    // Speed (display as 0-100 mph)
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Courier New';
    const displaySpeed = Math.floor((truck.speed / truck.maxSpeed) * 100);
    ctx.fillText('Speed: ' + displaySpeed + ' mph', barX, barY + 50);
    
    // Stats on right side
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px Courier New';
    
    // Play time
    const minutes = Math.floor(playTime / 60);
    const seconds = playTime % 60;
    ctx.fillText('Time: ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds, canvas.width - 20, 30);
    
    // Money
    ctx.fillStyle = '#790ECB';
    ctx.font = 'bold 20px Courier New';
    ctx.fillText('$' + money, canvas.width - 20, 60);
    
    // Delivery countdown
    ctx.fillStyle = '#00ff00';
    ctx.font = '16px Courier New';
    ctx.fillText('Delivery: ' + Math.ceil(deliveryMilesRemaining) + ' mi', canvas.width - 20, 90);
}

function drawGameOver() {
    drawGame();
    
    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ff0000';
    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Courier New';
    const minutes = Math.floor(playTime / 60);
    const seconds = playTime % 60;
    ctx.fillText('Time: ' + minutes + ':' + (seconds < 10 ? '0' : '') + seconds, canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText('Money: $' + money, canvas.width / 2, canvas.height / 2);
    ctx.fillText('Miles: ' + Math.floor(totalMiles), canvas.width / 2, canvas.height / 2 + 30);
    
    ctx.fillStyle = '#790ECB';
    ctx.font = '20px Courier New';
    ctx.fillText('Press SPACE or Click to Restart', canvas.width / 2, canvas.height / 2 + 60);
}

// Game loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Input handlers
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === ' ') {
        e.preventDefault();
        if (gameState === 'start' || gameState === 'gameOver') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('click', () => {
    if (gameState === 'start' || gameState === 'gameOver') {
        startGame();
    }
});

// Generate delivery distance based on distribution
function generateDeliveryDistance() {
    const rand = Math.random();
    if (rand < 0.6) {
        // 60% chance: 100-800 miles
        return 100 + Math.floor(Math.random() * 700);
    } else if (rand < 0.9) {
        // 30% chance: 800-1500 miles
        return 800 + Math.floor(Math.random() * 700);
    } else {
        // 10% chance: 1500-2800 miles
        return 1500 + Math.floor(Math.random() * 1300);
    }
}

function startGame() {
    gameState = 'playing';
    frame = 0;
    playTime = 0;
    totalMiles = 0;
    money = 0;
    currentDeliveryDistance = generateDeliveryDistance();
    deliveryMilesRemaining = currentDeliveryDistance;
    milesSinceLastStop = { gas: 0, food: 0, rest: 0 };
    nextStopDistance = { 
        gas: 2, 
        food: 3, 
        rest: 4 
    };
    truck.speed = 0;
    truck.lane = 1;
    truck.x = canvas.width / 2;
    truck.y = canvas.height / 2;
    truck.atPitStop = false;
    truck.pitStopTimer = 0;
    truck.currentStopType = null;
    resources.hunger = 100;
    resources.sleep = 100;
    resources.gas = 100;
    obstacles = [];
    stops = [];
    
    // Test: spawn a stop immediately to verify drawing works
    spawnStop('gas');
    console.log('Game started, stops array:', stops);
}

// Initialize and start
initRoadMarkers();
gameLoop();
