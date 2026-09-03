// Next resolves extensionless imports and the "@/" alias; raw node ESM does
// neither. Teach the verifier the same two rules so the source under test stays
// idiomatic — a file should not have to be written differently to be testable.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Mirrors the "@/*" -> "./src/*" mapping in tsconfig.json. */
const SRC = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = new URL(specifier.slice(2), SRC);
      for (const ext of ["", ".ts", ".tsx", ".mts", ".js"]) {
        const cand = new URL(base.href + ext);
        if (existsSync(fileURLToPath(cand))) {
          return nextResolve(cand.href, context);
        }
      }
    }

    if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
      try {
        const base = new URL(specifier, context.parentURL);
        for (const ext of [".ts", ".tsx", ".mts", ".js"]) {
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
