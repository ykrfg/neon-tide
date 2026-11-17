// Neon Tide's hand-in program (Node 22, standard library only). The game itself is the
// game/ folder beside this file: plain static files a desktop browser plays offline, no
// build step and no network. This program copies game/ and screenshots/ to the output
// directory and writes dossier.json there with the vendored make.fun library, under the
// scorer's own caps, so what is handed in is exactly what the gate measures.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's: the dossier text is capped at 160 KiB, at most 4 screenshots
// of at most 256 KiB each, and game/ holds at most 993 entries and 48 MiB with no path
// over 1,000 bytes. buildDossier refuses anything past them rather than writing it.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
