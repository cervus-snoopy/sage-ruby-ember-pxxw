// Driver for the csv-reader-speed entry: the harness runs `node main.ts`.
// It loads the cases, answers each one alone with run() from solve.js, and
// writes the answers out, one per case and in the cases' order.
//
// The cases live in /input/cases.json (or $MAKEFUN_INPUT_DIR when run outside
// the container) as a JSON array of {"id", "input"}; the answers go to
// /output/answers.json (or $MAKEFUN_OUTPUT_DIR) as a JSON array.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// Turn V8's incremental marking off before solve.js loads, so the whole run
// (and its timing) happens with marking off, as the house baseline does.
setFlagsFromString('--no-incremental-marking');

const mod = await import(new URL('./solve.js', import.meta.url).href);
const run = mod.run as (input: unknown) => unknown;

const inDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inDir, 'cases.json'), 'utf8')) as Array<{ id: string; input: unknown }>;
const answers = cases.map((c) => run(c.input));
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'answers.json'), JSON.stringify(answers));
