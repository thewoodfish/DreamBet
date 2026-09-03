// Next resolves extensionless relative imports; raw node ESM does not. Teach the
// verifier the same rule so the source under test stays idiomatic.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      try {
        const base = new URL(specifier, context.parentURL);
        for (const ext of [".ts", ".mts", ".js"]) {
          const cand = new URL(base.href + ext);
          if (existsSync(fileURLToPath(cand))) {
            return nextResolve(specifier + ext, context);
          }
        }
      } catch {}
    }
    return nextResolve(specifier, context);
  },
});
