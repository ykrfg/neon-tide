// Neon Tide's rules and state, with no drawing and no browser in it: the guardian wisp,
// the crystal Core, pooled bullets, enemy shots, drifters, particles and floating score
// text. step() advances one fixed step against a plain control object and returns what
// happened as bit flags, so the caller (main.js) can play sounds and change screens
// without the world knowing about either. Pools are allocated once, at createWorld.

import { BOSS, CORE, ENEMY, FIELD, GUN, PLAYER, POOL, UPGRADES, WAVES } from './config.js';

export const EVENT_SHOOT = 1;
export const EVENT_HIT = 2;
export const EVENT_EXPLOSION = 4;
export const EVENT_PLAYER_HIT = 8;
export const EVENT_CORE_HIT = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_GAME_OVER = 64;
export const EVENT_VICTORY = 128;
export const EVENT_DASH = 256;
export const EVENT_BOSS_BURST = 512;

const TAU = Math.PI * 2;

function makePool(size, factory) {
  const pool = [];
  for (let i = 0; i < size; i += 1) pool.push(factory());
  return pool;
}

function freeOf(pool) {
  for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
  return null;
}

export function createWorld(random) {
  const player = {
    x: CORE.x, y: CORE.y + PLAYER.startOffset, vx: 0, vy: 0,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
    invulnerable: 0, dashTime: 0, dashCooldown: 0, dashDirX: 0, dashDirY: -1,
    fireTimer: 0, alive: true,
  };
  const core = { x: CORE.x, y: CORE.y, hp: CORE.maxHp, maxHp: CORE.maxHp, flash: 0 };
  const stats = { damage: GUN.damage, interval: GUN.interval, projectiles: 1, pierce: 0, speedMul: 1, dashMul: 1 };
  const state = {
    player, core, stats,
    bullets: makePool(POOL.bullets, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, pierce: 0 })),
    enemyShots: makePool(POOL.enemyShots, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 })),
    enemies: makePool(POOL.enemies, () => ({
      active: false, kind: 'drifter', x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 10,
      speed: 0, score: 0, coreDamage: 0, touchDamage: 0, color: '#fff', phase: 0, spin: 0,
      burstTimer: 0, spawnTimer: 0, flash: 0, age: 0,
    })),
    particles: makePool(POOL.particles, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' })),
    floaters: makePool(POOL.floaters, () => ({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' })),
    score: 0,
    wave: 0,
    waveActive: false,
    spawnQueue: [],
    spawnTimer: 0,
    choices: [],
    shake: 0,
    time: 0,
    over: false,
    victory: false,
    boss: null,
  };

  function burst(x, y, color, count, speed, size = 3) {
    for (let i = 0; i < count; i += 1) {
      const p = freeOf(state.particles);
      if (p === null) return;
      const angle = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.4;
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const f = freeOf(state.floaters);
    if (f === null) return;
    f.active = true;
    f.x = x; f.y = y;
    f.life = 0.9;
    f.text = text;
    f.color = color;
  }

  function spawnEnemy(kind, x, y) {
    const e = freeOf(state.enemies);
    if (e === null) return null;
    const spec = ENEMY[kind];
    e.active = true;
    e.kind = kind;
    if (x === undefined || y === undefined) {
      // Enter from a random point on the arena's edge.
      const side = Math.floor(random() * 4);
      if (side === 0) { e.x = random() * FIELD.width; e.y = -30; }
      else if (side === 1) { e.x = FIELD.width + 30; e.y = random() * FIELD.height; }
      else if (side === 2) { e.x = random() * FIELD.width; e.y = FIELD.height + 30; }
      else { e.x = -30; e.y = random() * FIELD.height; }
    } else {
      e.x = x; e.y = y;
    }
    e.vx = 0; e.vy = 0;
    e.hp = spec.hp;
    e.maxHp = spec.hp;
    e.radius = spec.radius;
    e.speed = spec.speed * (0.9 + random() * 0.2);
    e.score = spec.score;
    e.coreDamage = spec.coreDamage;
    e.touchDamage = spec.touchDamage;
    e.color = spec.color;
    e.phase = random() * TAU;
    e.spin = (random() - 0.5) * 2;
    e.burstTimer = BOSS.burstInterval * (0.6 + random() * 0.4);
    e.spawnTimer = BOSS.spawnInterval;
    e.flash = 0;
    e.age = 0;
    if (kind === 'boss') state.boss = e;
    return e;
  }

  function startWave(index) {
    state.wave = index;
    state.choices = [];
    state.spawnQueue = [];
    for (const [kind, count] of WAVES[index].groups) {
      for (let i = 0; i < count; i += 1) state.spawnQueue.push(kind);
    }
    // Shuffle the queue so groups interleave instead of arriving in blocks.
    for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = state.spawnQueue[i];
      state.spawnQueue[i] = state.spawnQueue[j];
      state.spawnQueue[j] = tmp;
    }
    // The boss always leads its own wave.
    const bossAt = state.spawnQueue.indexOf('boss');
    if (bossAt > 0) {
      state.spawnQueue.splice(bossAt, 1);
      state.spawnQueue.unshift('boss');
    }
    state.spawnTimer = 0.8;
    state.waveActive = true;
  }

  function reset() {
    for (const pool of [state.bullets, state.enemyShots, state.enemies, state.particles, state.floaters]) {
      for (const item of pool) item.active = false;
    }
    player.x = CORE.x;
    player.y = CORE.y + PLAYER.startOffset;
    player.vx = 0; player.vy = 0;
    player.maxHp = PLAYER.maxHp;
    player.hp = PLAYER.maxHp;
    player.invulnerable = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.fireTimer = 0;
    player.alive = true;
    core.hp = CORE.maxHp;
    core.maxHp = CORE.maxHp;
    core.flash = 0;
    stats.damage = GUN.damage;
    stats.interval = GUN.interval;
    stats.projectiles = 1;
    stats.pierce = 0;
    stats.speedMul = 1;
    stats.dashMul = 1;
    state.score = 0;
    state.shake = 0;
    state.time = 0;
    state.over = false;
    state.victory = false;
    state.boss = null;
    startWave(0);
  }

  function drawChoices() {
    const pool = UPGRADES.slice();
    state.choices = [];
    for (let i = 0; i < 3 && pool.length > 0; i += 1) {
      state.choices.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    return state.choices;
  }

  /** Apply one of the offered upgrades by its id. Returns false for an unknown id. */
  function applyUpgrade(id) {
    switch (id) {
      case 'damage': stats.damage += 1; break;
      case 'firerate': stats.interval *= 0.82; break;
      case 'spread': stats.projectiles = Math.min(7, stats.projectiles + 1); break;
      case 'pierce': stats.pierce += 1; break;
      case 'speed': stats.speedMul *= 1.12; break;
      case 'dash': stats.dashMul *= 0.7; break;
      case 'corepair': core.hp = Math.min(core.maxHp, core.hp + 35); break;
      case 'vitality':
        player.maxHp += 25;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        break;
      default: return false;
    }
    state.choices = [];
    return true;
  }

  function hurtPlayer(amount) {
    if (player.invulnerable > 0 || !player.alive) return 0;
    player.hp -= amount;
    player.invulnerable = PLAYER.hitInvulnerable;
    state.shake = Math.max(state.shake, 7);
    burst(player.x, player.y, '#26e2ff', 14, 260);
    if (player.hp <= 0) {
      player.hp = 0;
      player.alive = false;
      burst(player.x, player.y, '#26e2ff', 42, 380, 4);
      state.shake = 14;
      return EVENT_GAME_OVER;
    }
    return EVENT_PLAYER_HIT;
  }

  function hurtCore(amount) {
    core.hp -= amount;
    core.flash = 0.25;
    state.shake = Math.max(state.shake, 6);
    burst(core.x, core.y, '#3dffc8', 12, 240);
    if (core.hp <= 0) {
      core.hp = 0;
      burst(core.x, core.y, '#3dffc8', 60, 430, 4);
      state.shake = 16;
      return EVENT_GAME_OVER;
    }
    return EVENT_CORE_HIT;
  }

  function killEnemy(e) {
    e.active = false;
    state.score += e.score;
    floatText(e.x, e.y - e.radius, `+${e.score}`, '#ffd94d');
    burst(e.x, e.y, e.color, e.kind === 'boss' ? 70 : 16, e.kind === 'boss' ? 420 : 300, e.kind === 'boss' ? 4 : 3);
    if (e.kind === 'boss') {
      state.boss = null;
      state.shake = 16;
    } else if (e.kind === 'brute') {
      state.shake = Math.max(state.shake, 8);
    }
  }

  function fireBullet(angle) {
    const b = freeOf(state.bullets);
    if (b === null) return;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (PLAYER.radius + 4);
    b.y = player.y + Math.sin(angle) * (PLAYER.radius + 4);
    b.vx = Math.cos(angle) * GUN.bulletSpeed;
    b.vy = Math.sin(angle) * GUN.bulletSpeed;
    b.life = GUN.bulletLife;
    b.pierce = stats.pierce;
  }

  function bossBurst(e) {
    const offset = random() * TAU;
    for (let i = 0; i < BOSS.burstCount; i += 1) {
      const s = freeOf(state.enemyShots);
      if (s === null) return;
      const angle = offset + (i / BOSS.burstCount) * TAU;
      s.active = true;
      s.x = e.x + Math.cos(angle) * (e.radius + 6);
      s.y = e.y + Math.sin(angle) * (e.radius + 6);
      s.vx = Math.cos(angle) * BOSS.burstSpeed;
      s.vy = Math.sin(angle) * BOSS.burstSpeed;
      s.life = BOSS.shotLife;
    }
  }

  /**
   * One fixed step. `control` is {moveX, moveY, aimX, aimY, firing, dash} in field
   * coordinates; dash is an edge (true only on the step the press lands).
   */
  function step(dt, control) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (core.flash > 0) core.flash -= dt;

    // --- the wisp ---
    if (player.alive) {
      if (player.invulnerable > 0) player.invulnerable -= dt;
      if (player.dashCooldown > 0) player.dashCooldown -= dt;
      let speed = PLAYER.speed * stats.speedMul;
      if (control.dash && player.dashCooldown <= 0) {
        const len = Math.hypot(control.moveX, control.moveY);
        if (len > 0) { player.dashDirX = control.moveX / len; player.dashDirY = control.moveY / len; }
        else {
          const a = Math.atan2(control.aimY - player.y, control.aimX - player.x);
          player.dashDirX = Math.cos(a);
          player.dashDirY = Math.sin(a);
        }
        player.dashTime = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown * stats.dashMul;
        events |= EVENT_DASH;
      }
      if (player.dashTime > 0) {
        player.dashTime -= dt;
        player.vx = player.dashDirX * PLAYER.dashSpeed;
        player.vy = player.dashDirY * PLAYER.dashSpeed;
        if (player.invulnerable < PLAYER.dashTime) player.invulnerable = PLAYER.dashTime;
      } else {
        player.vx = control.moveX * speed;
        player.vy = control.moveY * speed;
      }
      player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
      player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
      // A faint wake streams off the wisp while it moves: pure decoration, from the pool.
      if ((player.vx !== 0 || player.vy !== 0) && random() < 0.55) {
        const p = freeOf(state.particles);
        if (p !== null) {
          p.active = true;
          p.x = player.x - player.vx * 0.03 + (random() - 0.5) * 8;
          p.y = player.y - player.vy * 0.03 + (random() - 0.5) * 8;
          p.vx = -player.vx * 0.12;
          p.vy = -player.vy * 0.12;
          p.maxLife = 0.32;
          p.life = p.maxLife;
          p.size = 2.4;
          p.color = '#26e2ff';
        }
      }

      player.fireTimer -= dt;
      if (control.firing && player.fireTimer <= 0) {
        player.fireTimer = stats.interval;
        const base = Math.atan2(control.aimY - player.y, control.aimX - player.x);
        const n = stats.projectiles;
        for (let i = 0; i < n; i += 1) fireBullet(base + (i - (n - 1) / 2) * GUN.spreadStep);
        events |= EVENT_SHOOT;
      }
    }

    // --- spawning ---
    if (state.waveActive && state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemy(state.spawnQueue.shift());
        state.spawnTimer = Math.max(0.35, 1.1 - state.wave * 0.08);
      }
    }

    // --- bullets ---
    for (const b of state.bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of state.enemies) {
        if (!e.active) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        const rr = e.radius + GUN.bulletRadius;
        if (dx * dx + dy * dy > rr * rr) continue;
        e.hp -= stats.damage;
        e.flash = 0.08;
        burst(b.x, b.y, e.color, 3, 160, 2);
        events |= EVENT_HIT;
        if (e.hp <= 0) {
          killEnemy(e);
          events |= EVENT_EXPLOSION;
        }
        if (b.pierce > 0) b.pierce -= 1;
        else { b.active = false; break; }
      }
    }

    // --- enemies ---
    for (const e of state.enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      e.age += dt;
      e.phase += dt * 3;
      let tx = core.x;
      let ty = core.y;
      if (e.kind === 'dart') { tx = player.x; ty = player.y; }
      const dx = tx - e.x;
      const dy = ty - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      let mx = (dx / dist) * e.speed;
      let my = (dy / dist) * e.speed;
      if (e.kind === 'weaver') {
        const px = -dy / dist;
        const py = dx / dist;
        const wobble = Math.sin(e.phase) * 70;
        mx += px * wobble;
        my += py * wobble;
      }
      if (e.kind === 'boss') {
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = BOSS.burstInterval;
          bossBurst(e);
          events |= EVENT_BOSS_BURST;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          e.spawnTimer = BOSS.spawnInterval;
          spawnEnemy('drifter', e.x + e.radius + 20, e.y);
        }
        // The boss holds a ring around the Core and besieges it from there.
        if (dist < 190) { mx = 0; my = 0; }
      }
      e.x += mx * dt;
      e.y += my * dt;

      // Reaching the Core: the drifter slams into it and is spent.
      const cdx = core.x - e.x;
      const cdy = core.y - e.y;
      const crr = e.radius + CORE.radius;
      if (e.kind !== 'boss' && cdx * cdx + cdy * cdy < crr * crr) {
        e.active = false;
        burst(e.x, e.y, e.color, 18, 300);
        events |= hurtCore(e.coreDamage);
        events |= EVENT_EXPLOSION;
        continue;
      }
      // Touching the wisp hurts, unless it is dashing or still flashing from a hit.
      if (player.alive && player.dashTime <= 0) {
        const pdx = player.x - e.x;
        const pdy = player.y - e.y;
        const prr = e.radius + PLAYER.radius;
        if (pdx * pdx + pdy * pdy < prr * prr) {
          const hurt = hurtPlayer(e.touchDamage);
          if (hurt !== 0) {
            events |= hurt;
            if (e.kind !== 'boss' && e.kind !== 'brute') {
              e.active = false;
              burst(e.x, e.y, e.color, 12, 260);
            }
          }
        }
      }
    }

    // Drifters keep a little air between them, so a wave reads as a tide of shapes
    // and not one stacked blob: overlapping pairs are eased apart, the boss unmoved.
    for (let i = 0; i < state.enemies.length; i += 1) {
      const a = state.enemies[i];
      if (!a.active || a.kind === 'boss') continue;
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const b = state.enemies[j];
        if (!b.active || b.kind === 'boss') continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = (a.radius + b.radius) * 0.82;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0 || d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        const push = ((rr - d) / d) * 0.5 * 0.6;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }

    // --- enemy shots ---
    for (const s of state.enemyShots) {
      if (!s.active) continue;
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < -20 || s.x > FIELD.width + 20 || s.y < -20 || s.y > FIELD.height + 20) {
        s.active = false;
        continue;
      }
      if (player.alive && player.dashTime <= 0) {
        const dx = player.x - s.x;
        const dy = player.y - s.y;
        const rr = PLAYER.radius + BOSS.shotRadius;
        if (dx * dx + dy * dy < rr * rr) {
          s.active = false;
          events |= hurtPlayer(BOSS.shotDamage);
          continue;
        }
      }
      const cdx = core.x - s.x;
      const cdy = core.y - s.y;
      const crr = CORE.radius + BOSS.shotRadius;
      if (cdx * cdx + cdy * cdy < crr * crr) {
        s.active = false;
        events |= hurtCore(4);
      }
    }

    // --- particles and floaters ---
    for (const p of state.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    for (const f of state.floaters) {
      if (!f.active) continue;
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) f.active = false;
    }

    // --- wave end ---
    if (state.waveActive && state.spawnQueue.length === 0 && !state.enemies.some((e) => e.active)) {
      state.waveActive = false;
      if (state.wave === WAVES.length - 1) {
        state.victory = true;
        events |= EVENT_VICTORY;
      } else {
        drawChoices();
        events |= EVENT_WAVE_CLEAR;
      }
    }
    if ((player.hp <= 0 || core.hp <= 0) && !state.over) {
      state.over = true;
      events |= EVENT_GAME_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step, startWave, applyUpgrade };
}
