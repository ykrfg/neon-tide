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
 * One autopilot step: circle the Core at a fighting distance, aim at the nearest drifter
 * and keep firing. Good enough to look like a player mid-wave, and fully deterministic.
 */
function autopilotStep(world, seconds) {
  const steps = Math.round(seconds / STEP);
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
      firing: target !== null,
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
    world.startWave(2);
    state.score = 1350;
    state.player.hp = 76;
    state.core.hp = 84;
    autopilotStep(world, 7);
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
  idleSteps(world, 2.5);
  return SCREEN_TITLE;
}
