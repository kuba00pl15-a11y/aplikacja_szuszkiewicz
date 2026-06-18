const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameWrap = document.getElementById('gameWrap');
const endScreen = document.getElementById('endScreen');
const upgradeOverlay = document.getElementById('upgradeOverlay');
const centerMessage = document.getElementById('centerMessage');

const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const upgradeChoices = document.getElementById('upgradeChoices');

const hpValue = document.getElementById('hpValue');
const shieldValue = document.getElementById('shieldValue');
const scoreValue = document.getElementById('scoreValue');
const stageValue = document.getElementById('stageValue');
const goalValue = document.getElementById('goalValue');
const highScoreValue = document.getElementById('highScoreValue');

const endTitle = document.getElementById('endTitle');
const endSummary = document.getElementById('endSummary');

const state = {
  running: false,
  paused: false,
  gameOver: false,
  inUpgrade: false,
  mouseDown: false,
  score: 0,
  stage: 1,
  killsInStage: 0,
  killsTarget: 8,
  highScore: Number(localStorage.getItem('neonSiegeHighScore') || 0),
  lastTime: 0,
  keys: new Set(),
  mouse: { x: canvas.width / 2, y: canvas.height / 2 },
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 16,
  speed: 240,
  hp: 100,
  maxHp: 100,
  shield: 0,
  maxShield: 40,
  fireRate: 0.22,
  fireTimer: 0,
  bulletDamage: 24,
  bulletSpeed: 600,
  multishot: 1,
  dashCooldown: 0,
  dashMax: 2.2,
  invuln: 0,
};

let bullets = [];
let enemies = [];
let particles = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function showCenterMessage(text, duration = 1400) {
  centerMessage.textContent = text;
  centerMessage.classList.remove('hidden');
  setTimeout(() => centerMessage.classList.add('hidden'), duration);
}

function resetGame() {
  bullets = [];
  enemies = [];
  particles = [];

  Object.assign(player, {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 16,
    speed: 240,
    hp: 100,
    maxHp: 100,
    shield: 0,
    maxShield: 40,
    fireRate: 0.22,
    fireTimer: 0,
    bulletDamage: 24,
    bulletSpeed: 600,
    multishot: 1,
    dashCooldown: 0,
    dashMax: 2.2,
    invuln: 0,
  });

  Object.assign(state, {
    running: true,
    paused: false,
    gameOver: false,
    inUpgrade: false,
    mouseDown: false,
    score: 0,
    stage: 1,
    killsInStage: 0,
    killsTarget: 8,
    lastTime: performance.now(),
    keys: new Set(),
    mouse: { x: canvas.width / 2, y: canvas.height / 2 },
  });

  spawnWave();
  updateHud();
}

function updateHud() {
  hpValue.textContent = Math.max(0, Math.round(player.hp));
  shieldValue.textContent = `${Math.round(player.shield)} / ${player.maxShield}`;
  scoreValue.textContent = Math.floor(state.score);
  stageValue.textContent = state.stage;
  goalValue.textContent = `${state.killsInStage} / ${state.killsTarget}`;
  highScoreValue.textContent = Math.floor(state.highScore);
}

function spawnEnemy(type = 'normal') {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = rand(0, canvas.width);
    y = -30;
  } else if (side === 1) {
    x = canvas.width + 30;
    y = rand(0, canvas.height);
  } else if (side === 2) {
    x = rand(0, canvas.width);
    y = canvas.height + 30;
  } else {
    x = -30;
    y = rand(0, canvas.height);
  }

  const base = {
    x,
    y,
    vx: 0,
    vy: 0,
    hitFlash: 0,
  };

  if (type === 'tank') {
    enemies.push({ ...base, type, hp: 130, speed: 70, radius: 22, damage: 18, color: '#ffbe55', worth: 35 });
    return;
  }

  if (type === 'runner') {
    enemies.push({ ...base, type, hp: 45, speed: 155, radius: 12, damage: 10, color: '#ff5c8a', worth: 20 });
    return;
  }

  if (type === 'boss') {
    enemies.push({ ...base, type, hp: 380, speed: 60, radius: 36, damage: 30, color: '#a36cff', worth: 240 });
    return;
  }

  enemies.push({ ...base, type, hp: 70, speed: 105, radius: 16, damage: 13, color: '#09d1ff', worth: 25 });
}

function spawnWave() {
  const count = Math.min(6 + state.stage * 2, 24);

  for (let i = 0; i < count; i += 1) {
    const roll = Math.random();
    let type = 'normal';
    if (roll < 0.18 + state.stage * 0.008) type = 'runner';
    if (roll > 0.86 + Math.min(0.08, state.stage * 0.005)) type = 'tank';
    spawnEnemy(type);
  }

  if (state.stage % 4 === 0) {
    spawnEnemy('boss');
    showCenterMessage(`BOSS WAVE - STAGE ${state.stage}`, 2000);
  } else {
    showCenterMessage(`Stage ${state.stage}`);
  }
}

function createBullet(angleOffset = 0) {
  const angle = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x) + angleOffset;
  bullets.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * player.bulletSpeed,
    vy: Math.sin(angle) * player.bulletSpeed,
    radius: 4,
    damage: player.bulletDamage,
    life: 1.2,
  });
}

function shoot() {
  if (player.fireTimer > 0) return;

  if (player.multishot === 1) {
    createBullet(0);
  } else if (player.multishot === 2) {
    createBullet(-0.08);
    createBullet(0.08);
  } else {
    createBullet(-0.16);
    createBullet(0);
    createBullet(0.16);
  }

  player.fireTimer = player.fireRate;
}

function applyDamage(dmg) {
  if (player.invuln > 0) return;

  let remaining = dmg;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, remaining);
    player.shield -= absorbed;
    remaining -= absorbed;
  }

  player.hp -= remaining;
  player.invuln = 0.45;

  if (player.hp <= 0) {
    player.hp = 0;
    finishGame(false);
  }
}

function makeParticles(x, y, color, amount = 8) {
  for (let i = 0; i < amount; i += 1) {
    const a = rand(0, Math.PI * 2);
    const s = rand(70, 240);
    const maxLife = rand(0.2, 0.65);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: maxLife,
      maxLife,
      color,
      r: rand(1.5, 3.5),
    });
  }
}

function nextStage() {
  state.inUpgrade = true;
  state.stage += 1;
  state.killsInStage = 0;
  state.killsTarget = 8 + state.stage * 3;

  if (state.stage > 10) {
    finishGame(true);
    return;
  }

  openUpgradeSelection();
}

const upgrades = [
  {
    id: 'hp',
    name: 'Reaktor HP',
    desc: '+25 max HP i pelne leczenie do nowego limitu',
    apply: () => {
      player.maxHp += 25;
      player.hp = player.maxHp;
    },
  },
  {
    id: 'shield',
    name: 'Powloka Tarczy',
    desc: '+20 max tarczy i natychmiastowe doladowanie',
    apply: () => {
      player.maxShield += 20;
      player.shield = player.maxShield;
    },
  },
  {
    id: 'speed',
    name: 'Silniki Sprint',
    desc: '+18% predkosci ruchu i krotszy cooldown dasha',
    apply: () => {
      player.speed *= 1.18;
      player.dashMax = Math.max(0.9, player.dashMax - 0.2);
    },
  },
  {
    id: 'firerate',
    name: 'Stabilizator Broni',
    desc: 'Szybszy ogien: -0.03 s do czasu miedzy strzalami',
    apply: () => {
      player.fireRate = Math.max(0.09, player.fireRate - 0.03);
    },
  },
  {
    id: 'damage',
    name: 'Rdzen Obrazen',
    desc: '+10 obrazen na pocisk',
    apply: () => {
      player.bulletDamage += 10;
    },
  },
  {
    id: 'multishot',
    name: 'Tryb Rozproszenia',
    desc: 'Zwielokrotnienie strzalu do max x3',
    apply: () => {
      player.multishot = Math.min(3, player.multishot + 1);
    },
  },
];

function pickThreeUnique() {
  const pool = [...upgrades];
  const picked = [];
  while (picked.length < 3 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

function openUpgradeSelection() {
  upgradeChoices.innerHTML = '';
  const options = pickThreeUnique();

  options.forEach((upg) => {
    const btn = document.createElement('button');
    btn.className = 'upgrade-card';
    btn.innerHTML = `<h3>${upg.name}</h3><p>${upg.desc}</p>`;
    btn.addEventListener('click', () => {
      upg.apply();
      closeUpgradeSelection();
    });
    upgradeChoices.appendChild(btn);
  });

  upgradeOverlay.classList.remove('hidden');
  showCenterMessage(`Stage ${state.stage - 1} ukonczony`, 1100);
}

function closeUpgradeSelection() {
  upgradeOverlay.classList.add('hidden');
  state.inUpgrade = false;
  spawnWave();
}

function finishGame(victory) {
  state.running = false;
  state.gameOver = true;

  if (state.score > state.highScore) {
    state.highScore = Math.floor(state.score);
    localStorage.setItem('neonSiegeHighScore', String(state.highScore));
  }

  endTitle.textContent = victory ? 'Wygrana! 10 stage ukonczone' : 'Koniec gry';
  endSummary.textContent = `Wynik: ${Math.floor(state.score)} | Osiagniety stage: ${state.stage}`;

  endScreen.classList.remove('hidden');
  gameWrap.style.display = 'none';
  updateHud();
}

function update(dt) {
  if (!state.running || state.paused || state.inUpgrade) return;

  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  let moveX = 0;
  let moveY = 0;

  if (state.keys.has('w') || state.keys.has('arrowup')) moveY -= 1;
  if (state.keys.has('s') || state.keys.has('arrowdown')) moveY += 1;
  if (state.keys.has('a') || state.keys.has('arrowleft')) moveX -= 1;
  if (state.keys.has('d') || state.keys.has('arrowright')) moveX += 1;

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    moveX /= len;
    moveY /= len;
  }

  player.x += moveX * player.speed * dt;
  player.y += moveY * player.speed * dt;

  player.x = clamp(player.x, player.radius, canvas.width - player.radius);
  player.y = clamp(player.y, player.radius, canvas.height - player.radius);

  if (state.mouseDown) {
    shoot();
  }

  bullets.forEach((b) => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  });

  bullets = bullets.filter(
    (b) => b.life > 0 && b.x > -20 && b.y > -20 && b.x < canvas.width + 20 && b.y < canvas.height + 20,
  );

  enemies.forEach((e) => {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    e.vx = (dx / dist) * e.speed;
    e.vy = (dy / dist) * e.speed;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 4);

    if (dist < e.radius + player.radius) {
      applyDamage(e.damage);
      const push = 26;
      e.x -= (dx / dist) * push;
      e.y -= (dy / dist) * push;
    }
  });

  bullets.forEach((b) => {
    enemies.forEach((e) => {
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.radius + b.radius) {
        e.hp -= b.damage;
        e.hitFlash = 1;
        b.life = 0;
        makeParticles(b.x, b.y, '#09d1ff', 4);
      }
    });
  });

  const alive = [];
  enemies.forEach((e) => {
    if (e.hp <= 0) {
      state.score += e.worth;
      state.killsInStage += 1;
      makeParticles(e.x, e.y, e.color, e.type === 'boss' ? 35 : 12);
      return;
    }
    alive.push(e);
  });
  enemies = alive;

  particles.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  });
  particles = particles.filter((p) => p.life > 0);

  if (player.shield < player.maxShield) {
    player.shield = Math.min(player.maxShield, player.shield + dt * 5.5);
  }

  if (enemies.length < Math.max(2, Math.floor(state.stage * 0.7))) {
    spawnEnemy(Math.random() < 0.24 ? 'runner' : 'normal');
  }

  if (state.killsInStage >= state.killsTarget) {
    nextStage();
  }

  updateHud();
}

function drawGrid() {
  const cell = 48;
  ctx.strokeStyle = 'rgba(27, 119, 168, 0.2)';
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }

  for (let y = 0; y < canvas.height; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const ang = Math.atan2(state.mouse.y - player.y, state.mouse.x - player.x);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(ang);

  ctx.shadowColor = '#19ff9e';
  ctx.shadowBlur = 18;

  ctx.fillStyle = player.invuln > 0 ? '#8ef7d5' : '#19ff9e';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0b2d33';
  ctx.fillRect(4, -4, 16, 8);

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach((e) => {
    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;

    const hitMix = e.hitFlash > 0 ? 180 : 0;
    ctx.fillStyle = e.hitFlash > 0 ? `rgb(255, ${hitMix}, ${hitMix})` : e.color;

    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const w = e.radius * 2;
    const ratio = clamp(
      e.hp / (e.type === 'boss' ? 380 : e.type === 'tank' ? 130 : e.type === 'runner' ? 45 : 70),
      0,
      1,
    );
    ctx.fillStyle = 'rgba(5, 14, 24, 0.7)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 11, w, 5);
    ctx.fillStyle = '#19ff9e';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 11, w * ratio, 5);
  });
}

function drawBullets() {
  bullets.forEach((b) => {
    ctx.save();
    ctx.shadowColor = '#09d1ff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#09d1ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawParticles() {
  particles.forEach((p) => {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = `${p.color}${Math.floor(alpha * 255)
      .toString(16)
      .padStart(2, '0')}`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBars() {
  const hpRatio = clamp(player.hp / player.maxHp, 0, 1);
  const shRatio = clamp(player.shield / player.maxShield, 0, 1);

  ctx.fillStyle = 'rgba(1, 8, 16, 0.75)';
  ctx.fillRect(20, canvas.height - 40, 300, 12);
  ctx.fillRect(20, canvas.height - 20, 300, 10);

  ctx.fillStyle = '#ff5c8a';
  ctx.fillRect(20, canvas.height - 40, 300 * hpRatio, 12);

  ctx.fillStyle = '#09d1ff';
  ctx.fillRect(20, canvas.height - 20, 300 * shRatio, 10);
}

function drawPauseLayer() {
  if (!state.paused) return;
  ctx.fillStyle = 'rgba(2, 7, 16, 0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#e9fbff';
  ctx.font = '700 42px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText('PAUZA', canvas.width / 2, canvas.height / 2 - 8);
  ctx.font = '600 18px Rajdhani';
  ctx.fillStyle = '#9ccad9';
  ctx.fillText('Wcisnij ESC aby wznowic', canvas.width / 2, canvas.height / 2 + 24);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawParticles();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawBars();
  drawPauseLayer();
}

function gameLoop(now) {
  const dt = clamp((now - state.lastTime) / 1000, 0, 0.033);
  state.lastTime = now;

  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

  if (k === 'escape' && state.running && !state.inUpgrade) {
    state.paused = !state.paused;
    return;
  }

  if ((k === 'shift' || k === 'shiftleft' || k === 'shiftright') && state.running && !state.paused) {
    if (player.dashCooldown <= 0) {
      const dx = state.mouse.x - player.x;
      const dy = state.mouse.y - player.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      player.x += (dx / dist) * 140;
      player.y += (dy / dist) * 140;
      player.x = clamp(player.x, player.radius, canvas.width - player.radius);
      player.y = clamp(player.y, player.radius, canvas.height - player.radius);
      player.dashCooldown = player.dashMax;
      player.invuln = Math.max(player.invuln, 0.22);
      makeParticles(player.x, player.y, '#19ff9e', 12);
    }
  }

  state.keys.add(k);
});

window.addEventListener('keyup', (e) => {
  state.keys.delete(e.key.toLowerCase());
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  state.mouse.x = ((e.clientX - rect.left) / rect.width) * canvas.width;
  state.mouse.y = ((e.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) state.mouseDown = true;
});

window.addEventListener('mouseup', () => {
  state.mouseDown = false;
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  gameWrap.style.display = 'block';
  resetGame();
});

restartBtn.addEventListener('click', () => {
  endScreen.classList.add('hidden');
  gameWrap.style.display = 'block';
  resetGame();
});

updateHud();
requestAnimationFrame((t) => {
  state.lastTime = t;
  gameLoop(t);
});