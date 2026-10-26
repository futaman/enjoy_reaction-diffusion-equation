// Node から core のスクリプトを読み込むためのヘルパー（DOM なし）。
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// files: src/core からの相対パス（例: ['sim.js']）
export function loadCore(files = ['patterns.js', 'sim.js']) {
  const ctx = { console, Math, Float32Array, Uint8ClampedArray };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) {
    const p = join(ROOT, 'src', 'core', f);
    if (!existsSync(p)) continue;
    vm.runInContext(readFileSync(p, 'utf8'), ctx, { filename: f });
  }
  return ctx.RD;
}
