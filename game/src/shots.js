// The screenshot scenes behind #shot=title|action|upgrade|boss. Each one stages a real
// world (created by main.js from a fixed seed) and plays the real rules forward with a
// simple autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame. Nothing here is drawn or faked: main.js paints the
// staged world with the ordinary renderer and sets window.__shotReady.

import { CORE, STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE } from './render.js';

const IDLE = { moveX: 0, moveY: 0, aimX: CORE.x, aimY: 0, firing: false, dash: false };

/** The nearest active enemy to a point, or null when the field is clear. */
function nearestEnemy(state, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

/**
 * Play the world forward with an autopilot: circle the Core at a fighting distance and
 * aim at the nearest drifter. It holds its fire for all but the last `fireTail` seconds,
 * so the wave has time to close in and fill the arena before the shooting starts — the
 * frame then catches the moment the fight turns, bullets in flight and the tide at the
 * door. Fully deterministic: the world's seed fixes every spawn and wobble.
 */
function autopilotStep(world, seconds, fireTail = seconds) {
  const steps = Math.round(seconds / STEP);
  const fireSteps = Math.round(fireTail / STEP);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    const p = state.player;
    const angle = state.time * 0.55;
    const tx = CORE.x + Math.cos(angle) * 210;
    const ty = CORE.y + Math.sin(angle) * 210;
    let moveX = tx - p.x;
    let moveY = ty - p.y;
    const len = Math.hypot(moveX, moveY);
    if (len > 12) {
      moveX /= len;
      moveY /= len;
    } else {
      moveX = 0;
      moveY = 0;
    }
    const target = nearestEnemy(state, p.x, p.y);
    world.step(STEP, {
      moveX,
      moveY,
      aimX: target === null ? CORE.x : target.x,
      aimY: target === null ? 0 : target.y,
      firing: target !== null && i >= steps - fireSteps,
      dash: false,
    });
    if (state.over || state.victory) break;
  }
}

function idleSteps(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, IDLE);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any name but action, upgrade or boss is the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'action') {
    world.startWave(5);
    state.score = 4200;
    autopilotStep(world, 13, 1.6);
    // The HUD tells the run's story, not the staging's: set the bars after the fight.
    state.player.hp = 72;
    state.core.hp = 80;
    return SCREEN_PLAY;
  }
  if (name === 'boss') {
    world.startWave(7);
    state.score = 8600;
    state.player.hp = 64;
    state.core.hp = 57;
    autopilotStep(world, 6.5);
    return SCREEN_PLAY;
  }
  if (name === 'upgrade') {
    state.score = 450;
    state.spawnQueue.length = 0;
    world.step(STEP, IDLE); // the wave-clear step: the world itself draws the three choices
    return SCREEN_UPGRADE;
  }
  // 2.8 s lands inside the title prompt's lit half of its blink cycle.
  idleSteps(world, 2.8);
  return SCREEN_TITLE;
}
