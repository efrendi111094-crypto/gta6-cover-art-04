// Vice Coast Cover Studio 4 — the entry program for gta6-cover-art-01 (Node 22,
// standard library only). It hands the app in: it copies app/ and screenshots/
// from beside this file to /output (or MAKEFUN_OUTPUT_DIR outside the grader)
// and writes /output/dossier.json with the kit's vendored library. The copy is
// a plain file copy, so both runs write the same bytes.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps, so this program fails exactly where the scorer would: at most
// 4 screenshots of 256 KiB each, at most 993 entries and 48 MiB under app/,
// and no app/ path over 1,000 bytes. Only text_max_bytes shapes the bytes.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
