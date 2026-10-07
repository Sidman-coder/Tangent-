// Loader hooks for scripts/eval-pipeline.ts, so the app's server modules run
// under plain Node (which strips TypeScript types itself):
//   - "server-only" resolves to an empty module;
//   - "@/x" resolves to <project root>/x, as tsconfig "paths" does;
//   - extensionless relative imports get ".ts" (or "/index.ts");
//   - a package subpath without an "exports" map ("next/server") gets ".js";
//   - Next's CommonJS entry points re-export their names to ESM;
//   - a JSON import without `with { type: "json" }` loads as a default export.
// Used with --import; see the eval:pipeline script in package.json.

import { createRequire, registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTS = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.js"];

const NEXT_ENTRY = /\/node_modules\/next\/[^/]+\.js$/;
const requireHere = createRequire(import.meta.url);

const isFile = (p) => existsSync(p) && statSync(p).isFile();

/** The first existing file for an extensionless path, or null. */
function withExtension(absPath) {
  if (isFile(absPath)) return absPath;
  for (const ext of EXTS) if (isFile(absPath + ext)) return absPath + ext;
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    // "server-only" throws outside a React Server build; this is a server process.
    if (specifier === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    // Only the app's own ESM imports; packages and require() resolve as usual.
    if (context.conditions?.includes("require") || context.parentURL?.includes("/node_modules/")) {
      return next(specifier, context);
    }
    if (specifier.startsWith("@/")) {
      const found = withExtension(path.join(ROOT, specifier.slice(2)));
      if (found) return next(pathToFileURL(found).href, context);
    } else if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      if (!/\.[cm]?[jt]sx?$|\.json$/.test(specifier)) {
        const found = withExtension(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
        if (found) return next(pathToFileURL(found).href, context);
      }
    } else if (/^(@[^/]+\/)?[^./@][^/]*\/[^.]+$/.test(specifier)) {
      // A package subpath without "exports" (e.g. "next/server") needs ".js" under ESM.
      try {
        return next(specifier, context);
      } catch {
        return next(`${specifier}.js`, context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    // Next's entry points ("next/server", "next/headers") are CommonJS that
    // re-export through a getter object, so ESM can't see their named exports.
    // Load them with require and re-export every key by name.
    if (NEXT_ENTRY.test(url) && !context.conditions?.includes("require")) {
      const file = fileURLToPath(url);
      const keys = Object.keys(requireHere(file)).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== "default");
      const source = [
        `import { createRequire } from "node:module";`,
        `const m = createRequire(import.meta.url)(${JSON.stringify(file)});`,
        `export default m;`,
        ...keys.map((k) => `export const ${k} = m[${JSON.stringify(k)}];`),
      ].join("\n");
      return { format: "module", source, shortCircuit: true };
    }
    if (url.startsWith("file:") && url.endsWith(".json") && context.importAttributes?.type !== "json") {
      const source = `export default ${readFileSync(fileURLToPath(url), "utf8")};`;
      return { format: "module", source, shortCircuit: true };
    }
    return next(url, context);
  },
});
