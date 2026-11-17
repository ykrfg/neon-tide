// Drawing only: the world's state and the current screen in, pixels out. The canvas is the
// fixed 1280x720 field, so everything is drawn in field coordinates. Neon shapes are plain
// canvas paths with a sparing shadowBlur on the heroes of the scene (the wisp, the Core,
// the boss); the small fry are flat strokes so a full wave stays cheap to paint.

import { BOSS, CORE, FIELD, FONT, PALETTE, PLAYER, WAVES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const TAU = Math.PI * 2;
const CARD = { width: 300, height: 190, gap: 36, top: 300 };

/** The three upgrade card rectangles, in field coordinates: main.js hit-tests clicks with these. */
export function upgradeCardRects() {
  const total = CARD.width * 3 + CARD.gap * 2;
  const left = (FIELD.width - total) / 2;
  const rects = [];
  for (let i = 0; i < 3; i += 1) {
    rects.push({ x: left + i * (CARD.width + CARD.gap), y: CARD.top, width: CARD.width, height: CARD.height });
  }
  return rects;
}

/** A fixed starfield: generated once from a seeded walk, so every frame and photo agrees. */
const STARS = (() => {
  const stars = [];
  let s = 1234567;
  const next = () => {
    s = (Math.imul(s, 1103515245) + 12345) | 0;
    return ((s >>> 9) & 0x7fff) / 0x7fff;
  };
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, r: 0.6 + next() * 1.5, tw: next() * TAU });
  }
  return stars;
})();

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');

  function text(value, x, y, size, color, align = 'center', weight = 600) {
    context.font = `${weight} ${size}px ${FONT}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(value, x, y);
  }

  function bar(x, y, width, height, fraction, color, label) {
    context.fillStyle = 'rgba(10, 20, 40, 0.8)';
    context.fillRect(x, y, width, height);
    context.fillStyle = color;
    context.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * width, height);
    context.strokeStyle = 'rgba(160, 220, 255, 0.4)';
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    if (label) text(label, x, y - 12, 12, PALETTE.muted, 'left', 700);
  }

  function polygon(x, y, radius, sides, rotation) {
    context.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = rotation + (i / sides) * TAU;
      const px = x + Math.cos(a) * radius;
      const py = y + Math.sin(a) * radius;
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
  }

  function drawArena(state) {
    context.fillStyle = PALETTE.arena;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of STARS) {
      const alpha = 0.25 + 0.2 * Math.sin(state.time * 0.8 + star.tw);
      context.fillStyle = `rgba(159, 216, 255, ${alpha.toFixed(3)})`;
      context.fillRect(star.x, star.y, star.r, star.r);
    }
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 64; x < FIELD.width; x += 64) {
      context.moveTo(x + 0.5, 0);
      context.lineTo(x + 0.5, FIELD.height);
    }
    for (let y = 64; y < FIELD.height; y += 64) {
      context.moveTo(0, y + 0.5);
      context.lineTo(FIELD.width, y + 0.5);
    }
    context.stroke();
    context.strokeStyle = PALETTE.gridEdge;
    context.lineWidth = 2;
    context.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
  }

  function drawCore(state) {
    const core = state.core;
    const pulse = 1 + Math.sin(state.time * 2.4) * 0.06;
    const r = CORE.radius * pulse;
    context.save();
    context.translate(core.x, core.y);
    context.rotate(state.time * 0.5);
    context.shadowColor = PALETTE.core;
    context.shadowBlur = 26;
    context.fillStyle = core.flash > 0 ? '#ffffff' : PALETTE.core;
    polygon(0, 0, r, 4, 0);
    context.fill();
    context.shadowBlur = 0;
    context.rotate(-state.time * 1.1);
    context.fillStyle = PALETTE.coreInner;
    polygon(0, 0, r * 0.45, 4, 0);
    context.fill();
    context.restore();
    // The Core's health as a ring: full circle at full health, draining clockwise.
    context.beginPath();
    context.arc(core.x, core.y, CORE.radius + 13, -Math.PI / 2, -Math.PI / 2 + TAU * (core.hp / core.maxHp));
    context.strokeStyle = core.hp / core.maxHp < 0.3 ? PALETTE.danger : PALETTE.core;
    context.lineWidth = 4;
    context.stroke();
  }

  function drawPlayer(state, aim) {
    const p = state.player;
    if (!p.alive) return;
    if (p.invulnerable > 0 && p.dashTime <= 0 && Math.floor(state.time * 14) % 2 === 0) return; // hit blink
    // A short fading wake behind a dash.
    if (p.dashTime > 0) {
      context.fillStyle = 'rgba(38, 226, 255, 0.25)';
      context.beginPath();
      context.arc(p.x - p.dashDirX * 22, p.y - p.dashDirY * 22, PLAYER.radius * 0.8, 0, TAU);
      context.arc(p.x - p.dashDirX * 44, p.y - p.dashDirY * 44, PLAYER.radius * 0.55, 0, TAU);
      context.fill();
    }
    context.save();
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 18;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(p.x, p.y, PLAYER.radius, 0, TAU);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = PALETTE.playerCore;
    context.beginPath();
    context.arc(p.x, p.y, PLAYER.radius * 0.45, 0, TAU);
    context.fill();
    context.restore();
    // The aim tick: a small reticle where the wisp is looking.
    context.strokeStyle = 'rgba(174, 244, 255, 0.8)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(aim.x, aim.y, 9, 0, TAU);
    context.moveTo(aim.x - 14, aim.y);
    context.lineTo(aim.x - 5, aim.y);
    context.moveTo(aim.x + 5, aim.y);
    context.lineTo(aim.x + 14, aim.y);
    context.moveTo(aim.x, aim.y - 14);
    context.lineTo(aim.x, aim.y - 5);
    context.moveTo(aim.x, aim.y + 5);
    context.lineTo(aim.x, aim.y + 14);
    context.stroke();
  }

  function drawEnemy(e, time) {
    context.save();
    context.translate(e.x, e.y);
    const spin = time * (0.6 + Math.abs(e.spin)) * Math.sign(e.spin || 1) + e.phase;
    context.rotate(spin);
    context.lineWidth = e.kind === 'boss' ? 4 : 2.5;
    context.strokeStyle = e.flash > 0 ? '#ffffff' : e.color;
    context.fillStyle = e.flash > 0 ? 'rgba(255,255,255,0.5)' : `${e.color}2e`;
    if (e.kind === 'boss') {
      context.shadowColor = e.color;
      context.shadowBlur = 30;
    }
    const sides = { drifter: 3, dart: 4, weaver: 24, brute: 6, boss: 10 }[e.kind] ?? 3;
    polygon(0, 0, e.radius, sides, 0);
    context.fill();
    context.stroke();
    if (e.kind === 'weaver') {
      polygon(0, 0, e.radius * 0.55, 24, 0);
      context.stroke();
    }
    if (e.kind === 'boss') {
      context.shadowBlur = 0;
      polygon(0, 0, e.radius * 0.55, 5, -spin * 1.6);
      context.stroke();
    }
    context.restore();
    // Brutes and the boss wear their health where the player can read it.
    if ((e.kind === 'brute' || e.kind === 'boss') && e.hp < e.maxHp) {
      const w = e.radius * 2;
      context.fillStyle = 'rgba(10, 20, 40, 0.8)';
      context.fillRect(e.x - e.radius, e.y - e.radius - 14, w, 5);
      context.fillStyle = e.color;
      context.fillRect(e.x - e.radius, e.y - e.radius - 14, w * (e.hp / e.maxHp), 5);
    }
  }

  function drawEntities(state, aim) {
    for (const s of state.enemyShots) {
      if (!s.active) continue;
      context.fillStyle = PALETTE.enemyShot;
      context.beginPath();
      context.arc(s.x, s.y, BOSS.shotRadius, 0, TAU);
      context.fill();
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, TAU);
      context.fill();
    }
    for (const e of state.enemies) if (e.active) drawEnemy(e, state.time);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
    drawPlayer(state, aim);
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life * 1.6);
      text(f.text, f.x, f.y, 17, f.color, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    text(`SCORE ${state.score}`, 22, 26, 22, PALETTE.text, 'left', 800);
    text(`WAVE ${state.wave + 1} / ${WAVES.length}`, FIELD.width / 2, 26, 22, PALETTE.text, 'center', 800);
    const remaining = state.spawnQueue.length + state.enemies.filter((e) => e.active).length;
    text(state.waveActive ? `HOSTILES ${remaining}` : 'SECTOR CLEAR', FIELD.width - 22, 26, 16, PALETTE.muted, 'right', 700);
    if (state.boss !== null && state.boss.active) {
      bar(FIELD.width / 2 - 220, 52, 440, 10, state.boss.hp / state.boss.maxHp, PALETTE.danger, '');
      text('THE HOLLOW STAR', FIELD.width / 2, 44, 12, PALETTE.danger, 'center', 800);
    }
    const p = state.player;
    bar(22, FIELD.height - 34, 230, 13, p.hp / p.maxHp, PALETTE.player, 'WISP');
    bar(FIELD.width / 2 - 115, FIELD.height - 34, 230, 13, state.core.hp / state.core.maxHp, PALETTE.core, 'CORE');
    // The dash cell: a diamond that fills as the dash recharges.
    const dx = 286;
    const dy = FIELD.height - 28;
    const ready = p.dashCooldown <= 0;
    const frac = ready ? 1 : 1 - p.dashCooldown / (PLAYER.dashCooldown * state.stats.dashMul);
    context.save();
    context.translate(dx, dy);
    context.rotate(Math.PI / 4);
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 2;
    context.strokeRect(-8, -8, 16, 16);
    if (frac > 0) {
      context.fillStyle = ready ? PALETTE.player : 'rgba(38, 226, 255, 0.45)';
      const s = 16 * Math.min(1, frac);
      context.fillRect(-s / 2, -s / 2, s, s);
    }
    context.restore();
    text('DASH', dx + 20, dy, 12, ready ? PALETTE.player : PALETTE.muted, 'left', 700);
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, width - 2, height - 2);
    return { x, y };
  }

  function drawTitle(state, best) {
    context.fillStyle = 'rgba(3, 6, 16, 0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.save();
    context.shadowColor = PALETTE.player;
    context.shadowBlur = 34;
    text('NEON TIDE', FIELD.width / 2, 218, 92, PALETTE.player, 'center', 800);
    context.restore();
    text('Eight waves of drifters are coming for the crystal Core. You are its guardian.', FIELD.width / 2, 292, 21, PALETTE.text);
    const lines = [
      'Move  WASD / Arrow keys',
      'Aim  Mouse  ·  Hold mouse or Space to shoot',
      'Dash  Shift / Right-click  ·  Pause  P  ·  Mute  M',
      'Do not let the drifters reach the Core — or break you.',
    ];
    lines.forEach((line, i) => text(line, FIELD.width / 2, 356 + i * 32, 19, PALETTE.muted));
    if (Math.floor(state.time * 1.6) % 2 === 0) {
      text('Click or press Enter to start', FIELD.width / 2, 540, 24, PALETTE.gold, 'center', 800);
    }
    if (best > 0) text(`Best score ${best}`, FIELD.width / 2, 592, 18, PALETTE.muted);
  }

  function drawUpgrade(state) {
    context.fillStyle = 'rgba(3, 6, 16, 0.66)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave + 1} HELD`, FIELD.width / 2, 168, 40, PALETTE.core, 'center', 800);
    text('The tide pauses. Choose one upgrade to carry into the next wave.', FIELD.width / 2, 214, 20, PALETTE.text);
    const rects = upgradeCardRects();
    state.choices.forEach((choice, i) => {
      const r = rects[i];
      context.fillStyle = 'rgba(10, 22, 44, 0.95)';
      context.fillRect(r.x, r.y, r.width, r.height);
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      text(`[ ${i + 1} ]`, r.x + r.width / 2, r.y + 36, 16, PALETTE.gold, 'center', 800);
      text(choice.name, r.x + r.width / 2, r.y + 82, 25, PALETTE.text, 'center', 800);
      text(choice.blurb, r.x + r.width / 2, r.y + 126, 17, PALETTE.muted);
    });
  }

  function drawEnd(state, best, victory) {
    context.fillStyle = 'rgba(3, 6, 16, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const { y } = panel(620, 380);
    if (victory) {
      context.save();
      context.shadowColor = PALETTE.core;
      context.shadowBlur = 24;
      text('THE TIDE RECEDES', FIELD.width / 2, y + 84, 44, PALETTE.core, 'center', 800);
      context.restore();
      text('The Core still burns. All eight waves held.', FIELD.width / 2, y + 138, 20, PALETTE.text);
    } else {
      context.save();
      context.shadowColor = PALETTE.danger;
      context.shadowBlur = 24;
      text('THE LIGHT GOES OUT', FIELD.width / 2, y + 84, 44, PALETTE.danger, 'center', 800);
      context.restore();
      text(state.core.hp <= 0 ? 'The Core was shattered.' : 'The guardian wisp was broken.', FIELD.width / 2, y + 138, 20, PALETTE.text);
    }
    text(`Final score  ${state.score}`, FIELD.width / 2, y + 200, 30, PALETTE.gold, 'center', 800);
    text(`Reached wave ${state.wave + 1} of ${WAVES.length}  ·  Best ${Math.max(best, state.score)}`, FIELD.width / 2, y + 244, 19, PALETTE.muted);
    if (Math.floor(state.time * 1.6) % 2 === 0) {
      text('Click or press Enter to play again', FIELD.width / 2, y + 316, 22, PALETTE.text, 'center', 700);
    }
  }

  /**
   * Paint one frame. `view` carries what the renderer cannot know from the world:
   * the aim point, the best score, and whether sound is muted.
   */
  function draw(state, screen, view) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    let ox = 0;
    let oy = 0;
    if (state.shake > 0.2) {
      ox = Math.sin(state.time * 91) * state.shake * 0.6;
      oy = Math.cos(state.time * 113) * state.shake * 0.6;
    }
    context.translate(ox, oy);
    drawArena(state);
    drawCore(state);
    drawEntities(state, view.aim);
    context.translate(-ox, -oy);
    if (screen !== SCREEN_TITLE) drawHud(state);
    if (view.muted) text('MUTED', FIELD.width - 22, FIELD.height - 24, 13, PALETTE.muted, 'right', 700);
    if (screen === SCREEN_TITLE) drawTitle(state, view.best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) {
      context.fillStyle = 'rgba(3, 6, 16, 0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 16, 46, PALETTE.text, 'center', 800);
      text('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 34, 20, PALETTE.muted);
    } else if (screen === SCREEN_OVER) drawEnd(state, view.best, false);
    else if (screen === SCREEN_VICTORY) drawEnd(state, view.best, true);
  }

  return { draw };
}
