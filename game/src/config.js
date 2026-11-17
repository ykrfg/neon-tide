// Neon Tide: every tuning number, colour and table in one place. The arena is a fixed
// 1280x720 logical field; index.html's canvas is exactly that size and CSS scales it to
// the window, so no rule below ever depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const CORE = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 26,
  maxHp: 100,
};

export const PLAYER = {
  radius: 13,
  speed: 300,
  maxHp: 100,
  /** Seconds of invulnerability after taking a hit. */
  hitInvulnerable: 0.8,
  /** Seconds of invulnerability while dashing. */
  dashTime: 0.18,
  dashSpeed: 980,
  dashCooldown: 2.2,
  startOffset: 120,
};

export const GUN = {
  damage: 1,
  interval: 0.16,
  bulletSpeed: 760,
  bulletRadius: 4,
  bulletLife: 0.9,
  spreadStep: 0.11,
};

export const ENEMY = {
  drifter: { radius: 15, hp: 2, speed: 62, score: 50, coreDamage: 8, touchDamage: 10, color: '#ff5470' },
  dart: { radius: 10, hp: 1, speed: 148, score: 75, coreDamage: 5, touchDamage: 8, color: '#ffb84d' },
  weaver: { radius: 14, hp: 3, speed: 74, score: 90, coreDamage: 8, touchDamage: 10, color: '#c792ff' },
  brute: { radius: 26, hp: 12, speed: 34, score: 200, coreDamage: 20, touchDamage: 18, color: '#ff3860' },
  boss: { radius: 52, hp: 130, speed: 20, score: 2000, coreDamage: 40, touchDamage: 25, color: '#ff2e88' },
};

/**
 * The eight waves. Each entry lists spawn groups as [kind, count]; groups trickle in over
 * the wave rather than appearing at once. Wave 8 is the boss and its escort.
 */
export const WAVES = [
  { groups: [['drifter', 6]] },
  { groups: [['drifter', 8], ['dart', 3]] },
  { groups: [['drifter', 8], ['weaver', 4], ['dart', 4]] },
  { groups: [['drifter', 10], ['brute', 1], ['dart', 6]] },
  { groups: [['weaver', 7], ['drifter', 8], ['brute', 2]] },
  { groups: [['dart', 12], ['weaver', 6], ['brute', 2]] },
  { groups: [['drifter', 12], ['weaver', 8], ['brute', 3], ['dart', 8]] },
  { groups: [['boss', 1], ['drifter', 6], ['dart', 6]] },
];

export const BOSS = {
  /** Seconds between radial bursts once the boss is on the field. */
  burstInterval: 2.6,
  burstCount: 14,
  burstSpeed: 165,
  /** Seconds between spitting out two escort drifters. */
  spawnInterval: 5.5,
  /** Enemy bullets live this long, in seconds. */
  shotLife: 4.5,
  shotRadius: 5,
  shotDamage: 12,
};

/** The upgrade pool the between-wave choice draws three from. Ids are keys into world.js's applier. */
export const UPGRADES = [
  { id: 'damage', name: 'Heavy Rounds', blurb: '+1 bullet damage' },
  { id: 'firerate', name: 'Rapid Cycler', blurb: 'Fire 18% faster' },
  { id: 'spread', name: 'Split Prism', blurb: '+1 bullet per shot' },
  { id: 'pierce', name: 'Lance Rounds', blurb: 'Bullets pierce +1 enemy' },
  { id: 'speed', name: 'Swift Wake', blurb: 'Move 12% faster' },
  { id: 'dash', name: 'Phase Cell', blurb: 'Dash recharges 30% faster' },
  { id: 'corepair', name: 'Core Suture', blurb: 'Repair the Core by 35' },
  { id: 'vitality', name: 'Bright Heart', blurb: '+25 max HP and heal 25' },
];

export const POOL = { bullets: 240, enemyShots: 160, enemies: 96, particles: 420, floaters: 48 };

export const PALETTE = {
  backdrop: '#04060f',
  arena: '#050914',
  grid: 'rgba(56, 130, 246, 0.10)',
  gridEdge: 'rgba(38, 226, 255, 0.35)',
  star: '#9fd8ff',
  player: '#26e2ff',
  playerCore: '#e8fbff',
  bullet: '#aef4ff',
  enemyShot: '#ff7ab0',
  core: '#3dffc8',
  coreInner: '#eafff8',
  text: '#eaf6ff',
  muted: '#8fb4d8',
  danger: '#ff5470',
  gold: '#ffd94d',
  panel: 'rgba(8, 16, 34, 0.88)',
  panelEdge: 'rgba(38, 226, 255, 0.55)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-tide.best';

/** A small seeded random number generator (mulberry32): the same seed gives the same run. */
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
