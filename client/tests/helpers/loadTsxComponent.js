import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

export async function loadTsxComponent(componentPath, dependencies = {}) {
    const source = await readFile(componentPath, "utf8");
    const compiled = await transformWithEsbuild(source, componentPath, {
        loader: "tsx",
        format: "cjs",
        jsx: "automatic",
    });
    const module = { exports: {} };
    const requireFromComponent = createRequire(componentPath);

    runInNewContext(compiled.code, {
        module,
        exports: module.exports,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromComponent(specifier);
        },
    }, { filename: componentPath });

    return module.exports.default;
}
