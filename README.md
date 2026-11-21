# Fast CSV reader — a faster drop-in for csv-reader 1.0.0

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/cervus-snoopy/sage-ruby-ember-pxxw/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/cervus-snoopy/sage-ruby-ember-pxxw/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

## What it does

`solve.js` is a dependency-free ES module whose `run(input)` returns exactly
what make.fun's csv-reader 1.0.0 returns for a CSV input `{text, header}`:
`{columns, rows, errors}` — the header (or null), every record as an array of
strings at the first record's width, and an error record for every broken
thing it met (stray CR, unterminated quote, quote junk, short row, long row).

It is a faster drop-in for csv-reader: instead of reading one character at a
time and building each field up a character at a time, it scans with
`indexOf` — an unquoted field is sliced between the next comma or line break,
a quoted field locates its closing quote with `indexOf` (skipping `""`
escapes) and takes its content as one slice. Stray CRs, `""` and CRs inside
quotes, and characters after a closing quote take a slow path that only runs
on the rare broken rows. On the kit's practice set (6 cases, ~10.2 MB of CSV)
it runs in ~0.28 s of CPU against csv-reader's ~0.80 s on this machine, and
its answers are identical to csv-reader's on every case (verified against the
practice reference, plus 3,000 randomised broken-CSV inputs).

## Files

- `solve.js` — the reader. `run(input)` returns `{columns, rows, errors}`.
- `main.ts` — the program the harness runs. It reads every case from
  `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`), answers each one alone with
  `run`, and writes `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`).
- `LICENSE` — MIT.

## Run it

```bash
mkdir -p out && MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/answers.json`. Node 22, standard library only, no network,
no WebAssembly, no native addon, no prebuilt binary.

## Bounty

[Read broken CSV files faster — make.fun](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
