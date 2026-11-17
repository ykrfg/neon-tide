// Keyboard and mouse input. Held keys and the pointer are read as continuous state every
// frame; one-shot presses (confirm, pause, mute, dash, upgrade picks) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost or doubled.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_DASH = 8;
export const ACTION_PICK_1 = 16;
export const ACTION_PICK_2 = 32;
export const ACTION_PICK_3 = 64;

const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PICKS = new Map([['Digit1', ACTION_PICK_1], ['Digit2', ACTION_PICK_2], ['Digit3', ACTION_PICK_3]]);
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space']);

export function createInput(canvas) {
  const held = new Set();
  const mouse = { x: 640, y: 300, down: false, rightDown: false };
  let actions = 0;
  let clicked = null;

  /** Pointer position in the canvas's own 1280x720 coordinates, whatever size it is shown at. */
  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') actions |= ACTION_DASH;
    else if (PICKS.has(event.code)) actions |= PICKS.get(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
    mouse.rightDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toField(event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event);
    mouse.x = point.x;
    mouse.y = point.y;
    if (event.button === 2) {
      mouse.rightDown = true;
      actions |= ACTION_DASH;
    } else {
      mouse.down = true;
      clicked = point;
      actions |= ACTION_CONFIRM;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 2) mouse.rightDown = false;
    else mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement vector from the held keys, normalised: {x, y} each in -1..1. */
    moveVector() {
      const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      if (x === 0 || y === 0) return { x, y };
      const inv = Math.SQRT1_2;
      return { x: x * inv, y: y * inv };
    },
    /** True while Space is held: the keyboard way to keep firing. */
    spaceHeld() {
      return held.has('Space');
    },
    mouse,
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last left-click point in field coordinates, or null; taken once. */
    takeClick() {
      const point = clicked;
      clicked = null;
      return point;
    },
  };
}
