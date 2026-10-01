import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { loadTsxModule } from "./helpers/loadTsxComponent.js";

const contextPath = fileURLToPath(new URL("../src/contexts/MidtermModeContext.tsx", import.meta.url));
const providerPath = fileURLToPath(new URL("../src/contexts/MidtermModeProvider.tsx", import.meta.url));

async function loadContext(get) {
    const updates = [];
    const requests = [];
    let initialValue;
    let refreshEffect;
    function ProviderStub({ children }) {
        return children;
    }

    const react = {
        ...React,
        createContext(value) {
            initialValue = value;
            return { Provider: ProviderStub, value };
        },
        useContext(context) {
            return context.value;
        },
        useState: (value) => [value, (next) => updates.push(next)],
        useCallback: (callback) => callback,
        useEffect: (effect) => { refreshEffect = effect; },
    };
    const context = await loadTsxModule(contextPath, { react });
    const provider = await loadTsxModule(providerPath, {
        react,
        "./MidtermModeContext": { MidtermModeContext: context.MidtermModeContext },
        "../api/client": {
            get(path) {
                requests.push(path);
                return get();
            },
        },
    });

    return { ...context, ...provider, updates, requests, initialValue, runEffect: () => refreshEffect() };
}

test("midterm provider retains its initial value, child, and manual refresh", async () => {
    const context = await loadContext(async () => ({ data: { midterm_mode: true } }));
    const element = context.MidtermModeProvider({ children: "rush app" });

    assert.equal(element.props.value.isMidtermMode, false);
    assert.equal(element.props.children, "rush app");
    assert.equal(context.useMidtermMode(), context.initialValue);
    assert.equal(context.initialValue.isMidtermMode, false);

    await element.props.value.refetchMidtermMode();
    assert.deepEqual(context.requests, ["/brother/rush-app/midterm-status"]);
    assert.deepEqual(context.updates, [true]);
});

test("mount refresh retains the false fallback for missing status and request failures", async () => {
    for (const get of [
        async () => ({ data: {} }),
        async () => { throw new Error("offline"); },
    ]) {
        const context = await loadContext(get);
        context.MidtermModeProvider({ children: null });
        context.runEffect();
        await setImmediate();

        assert.deepEqual(context.requests, ["/brother/rush-app/midterm-status"]);
        assert.deepEqual(context.updates, [false]);
    }
});
