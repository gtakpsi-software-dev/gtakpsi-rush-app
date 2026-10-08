import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { loadTsxModule } from "../helpers/loadTsxComponent.js";

const contextPath = fileURLToPath(new URL("../../src/contexts/MidtermModeContext.tsx", import.meta.url));
const providerPath = fileURLToPath(new URL("../../src/contexts/MidtermModeProvider.tsx", import.meta.url));

// Load context with injected dependencies for isolated tests.
async function loadContext(get) {
    const updates = [];
    const requests = [];
    let initialValue;
    let refreshEffect;
    // Return children to the caller.
    function ProviderStub({ children }) {
        return children;
    }

    const react = {
        ...React,
        // Capture the initial context value and provide a fake provider.
        createContext(value) {
            initialValue = value;
            return { Provider: ProviderStub, value };
        },
        // Read the value from the fake context.
        useContext(context) {
            return context.value;
        },
        // Supply controlled state and a setter without mounting React.
        useState: (value) => [value, /* Record callback arguments for assertions. */ (next) => updates.push(next)],
        // Keep the callback callable without a React render cycle.
        useCallback: (callback) => callback,
        // Update refreshEffect in the test harness.
        useEffect: (effect) => { refreshEffect = effect; },
    };
    const context = await loadTsxModule(contextPath, { react });
    const provider = await loadTsxModule(providerPath, {
        react,
        "./MidtermModeContext": { MidtermModeContext: context.MidtermModeContext },
        "../api/client": {
            // Record the request path and delegate to the configured GET stub.
            get(path) {
                requests.push(path);
                return get();
            },
        },
    });

    return { ...context, ...provider, updates, requests, initialValue, runEffect:
        /* Invoke refreshEffect with the test inputs. */
        () => refreshEffect() };
}

test("midterm provider retains its initial value, child, and manual refresh", async () => {
    // Verify midterm provider retains its initial value, child, and manual refresh.
    const context = await loadContext(/* Return the fixture for this scenario. */ async () => ({ data: { midterm_mode: true } }));
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
    // Verify mount refresh retains the false fallback for missing status and request failures.
    for (const get of [
        /* Return the fixture for this scenario. */ async () => ({ data: {} }),
        async () => {
            // Simulate a dependency failure for this scenario.
             throw new Error("offline"); },
    ]) {
        const context = await loadContext(get);
        context.MidtermModeProvider({ children: null });
        context.runEffect();
        await setImmediate();

        assert.deepEqual(context.requests, ["/brother/rush-app/midterm-status"]);
        assert.deepEqual(context.updates, [false]);
    }
});
