/**
 * 让 node 能直接 import 源码里的 `.ts`（补扩展名解析）。
 *
 * 背景：src/ 里两种写法并存 —— 一部分文件写 `import { x } from './db'`（无扩展名），
 * 另一部分写 `'./db.ts'`。Worker 打包（wrangler/esbuild）两种都认，
 * 但原生 ESM 不认无扩展名的写法，所以直接 import 会报 ERR_MODULE_NOT_FOUND。
 *
 * 有了这个钩子，`node --experimental-strip-types --import ./test/ts-import-hook.mjs xxx.mjs`
 * 就能把 src/ 当普通 ESM 用，测试不必为此改动源码的 import 风格。
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      // 只处理相对路径；裸包名（node: / 依赖）照原样抛
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
      const base = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd();
      const abs = resolve(base, specifier);
      for (const cand of [`${abs}.ts`, `${abs}.mts`, resolve(abs, 'index.ts')]) {
        if (existsSync(cand)) return { url: pathToFileURL(cand).href, shortCircuit: true };
      }
      throw err;
    }
  },
});
