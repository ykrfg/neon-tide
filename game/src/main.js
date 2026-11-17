// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory. World events come back as bit flags and are turned into sound here.
//
// #shot=title|action|upgrade|boss (or ?shot=…) stages a deterministic scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.

import { BEST_KEY, createRandom, STEP } from './config.js';
import {
  createWorld, EVENT_BOSS_BURST, EVENT_CORE_HIT, EVENT_DASH, EVENT_EXPLOSION,
  EVENT_GAME_OVER, EVENT_HIT, EVENT_PLAYER_HIT, EVENT_SHOOT, EVENT_VICTORY, EVENT_WAVE_CLEAR,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2,
  ACTION_PICK_3, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE,
  SCREEN_VICTORY, upgradeCardRects,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const queryParams = new URLSearchParams(window.location.search);
const shot = hashParams.get('shot') ?? queryParams.get('shot');
const seedParam = Number.parseInt(hashParams.get('seed') ?? queryParams.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();

function fitCanvas() {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
  canvas.style.width = `${Math.floor(canvas.width * scale)}px`;
  canvas.style.height = `${Math.floor(canvas.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const world = createWorld(createRandom(seed));
  const renderer = createRenderer(canvas);
  const screen = stageShot(name, world);
  const view = { aim: { x: world.state.player.x + 120, y: world.state.player.y - 80 }, best: world.state.score, muted: false };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const world = createWorld(createRandom((Math.random() * 4294967296) | 0));
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dashQueued = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.waveStart();
    announce('Wave 1. Defend the Core.');
  }

  function finishRun(won) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = won ? SCREEN_VICTORY : SCREEN_OVER;
    if (won) audio.victory();
    else audio.gameOver();
    announce(won ? `Victory. Final score ${world.state.score}.` : `Game over. Score ${world.state.score}.`);
  }

  function pickUpgrade(index) {
    const choice = world.state.choices[index];
    if (!choice) return;
    world.applyUpgrade(choice.id);
    audio.upgrade();
    world.startWave(world.state.wave + 1);
    screen = SCREEN_PLAY;
    audio.waveStart();
    announce(`Upgrade: ${choice.name}. Wave ${world.state.wave + 1}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions !== 0) audio.unlock();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_DASH) dashQueued = true;
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickUpgrade(0);
      else if (actions & ACTION_PICK_2) pickUpgrade(1);
      else if (actions & ACTION_PICK_3) pickUpgrade(2);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleClick() {
    const point = input.takeClick();
    if (point === null) return;
    audio.unlock();
    if (screen !== SCREEN_UPGRADE) return;
    const rects = upgradeCardRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      if (point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + r.height) {
        pickUpgrade(i);
        return;
      }
    }
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_EXPLOSION) audio.explosion(false);
    if (events & EVENT_BOSS_BURST) audio.explosion(true);
    if (events & EVENT_PLAYER_HIT) audio.playerHit();
    if (events & EVENT_CORE_HIT) audio.coreHit();
    if (events & EVENT_DASH) audio.dash();
  }

  function step() {
    const move = input.moveVector();
    const control = {
      moveX: move.x,
      moveY: move.y,
      aimX: input.mouse.x,
      aimY: input.mouse.y,
      firing: input.mouse.down || input.spaceHeld(),
      dash: dashQueued,
    };
    dashQueued = false;
    const events = world.step(STEP, control);
    playEvents(events);
    if (events & EVENT_VICTORY) finishRun(true);
    else if (events & EVENT_GAME_OVER) finishRun(false);
    else if (events & EVENT_WAVE_CLEAR) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave + 1} held. Choose an upgrade.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick();
    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      // The title's backdrop is the real simulation idling: drifters close on the Core,
      // and when a demo run finally falls, a fresh one takes its place.
      accumulator += dt;
      while (accumulator >= STEP) {
        const events = world.step(STEP, { moveX: 0, moveY: 0, aimX: input.mouse.x, aimY: input.mouse.y, firing: false, dash: false });
        accumulator -= STEP;
        if (events & EVENT_GAME_OVER) {
          world.reset();
          break;
        }
      }
    } else {
      // Frozen screens still breathe: the clock drives the panels' blink and pulse.
      world.state.time += dt;
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { aim: input.mouse, best, muted: audio.muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Tide. Click or press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
