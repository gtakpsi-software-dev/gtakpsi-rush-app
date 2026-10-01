import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import React from "react";
import { transformWithEsbuild } from "vite";

const shaderPath = fileURLToPath(new URL("../src/features/notFound/LiquidShader.jsx", import.meta.url));

async function loadShader() {
    const source = await readFile(shaderPath, "utf8");
    const { code } = await transformWithEsbuild(source, shaderPath, {
        loader: "jsx", format: "cjs", jsx: "automatic",
    });
    const module = { exports: {} };
    const calls = [];
    const windowStub = {
        innerWidth: 1200,
        innerHeight: 600,
        addEventListener(name, callback) {
            calls.push(["listen", name]);
            this.resize = callback;
        },
        removeEventListener(name, callback) {
            calls.push(["remove", name, callback === this.resize]);
        },
    };
    const meshRef = { current: {
        scale: { set: (...args) => calls.push(["scale", ...args]) },
        material: { uniforms: {
            uTime: { value: 0 },
            uResolution: { value: { set: (...args) => calls.push(["resolution", ...args]) } },
        } },
    } };
    let frame;
    let cleanup;
    const dependencies = {
        react: {
            ...React,
            useRef: () => meshRef,
            useEffect(effect, dependencies) {
                assert.deepEqual(Array.from(dependencies), []);
                cleanup = effect();
            },
        },
        "@react-three/fiber": { useFrame: (callback) => { frame = callback; } },
        three: {
            Clock: class { getElapsedTime() { return 7.5; } },
            Vector2: class { constructor(x, y) { this.x = x; this.y = y; } },
            Color: class { constructor(hex) { this.hex = hex; } },
            DoubleSide: "double-sided",
        },
    };
    const requireFromShader = createRequire(shaderPath);
    runInNewContext(code, {
        module,
        exports: module.exports,
        window: windowStub,
        require(specifier) {
            if (Object.hasOwn(dependencies, specifier)) return dependencies[specifier];
            return requireFromShader(specifier);
        },
    }, { filename: shaderPath });

    return { Shader: module.exports.default, calls, windowStub, meshRef, frame: () => frame(), cleanup: () => cleanup() };
}

test("404 liquid shader keeps its mesh, uniforms, colors, and GLSL source", async () => {
    const { Shader } = await loadShader();
    const mesh = Shader();
    const [plane, material] = React.Children.toArray(mesh.props.children);

    assert.equal(mesh.type, "mesh");
    assert.equal(plane.type, "planeGeometry");
    assert.deepEqual(Array.from(plane.props.args), [1, 1, 64, 64]);
    assert.equal(material.type, "shaderMaterial");
    assert.equal(material.props.side, "double-sided");
    assert.equal(material.props.transparent, true);
    assert.equal(material.props.uniforms.uTime.value, 0);
    assert.deepEqual({
        x: material.props.uniforms.uResolution.value.x,
        y: material.props.uniforms.uResolution.value.y,
    }, { x: 1200, y: 600 });
    assert.deepEqual(Array.from(material.props.uniforms.uColors.value, (color) => color.hex), [
        "#0033A0", "#FFD700", "#FFD700", "#0033A0",
    ]);
    assert.equal(createHash("sha256").update(material.props.vertexShader).digest("hex"),
        "ca763bfd72e49c3bc907e2bd42afe13d66d7402d2cb9508c77d575ea2605a57c");
    assert.equal(createHash("sha256").update(material.props.fragmentShader).digest("hex"),
        "8501a5df174086a2ab2780267efd82910b23fa74c029ee6e061c1b2f79509fb6");
});

test("404 liquid shader keeps frame timing, resize scaling, and listener cleanup", async () => {
    const shader = await loadShader();
    shader.Shader();
    assert.deepEqual(shader.calls, [
        ["scale", 6, 3, 1], ["resolution", 1200, 600], ["listen", "resize"],
    ]);

    shader.frame();
    assert.equal(shader.meshRef.current.material.uniforms.uTime.value, 7.5);
    shader.windowStub.innerWidth = 600;
    shader.windowStub.innerHeight = 1200;
    shader.windowStub.resize();
    shader.cleanup();
    assert.deepEqual(shader.calls.slice(3), [
        ["scale", 3, 6, 1], ["resolution", 600, 1200], ["remove", "resize", true],
    ]);
});
