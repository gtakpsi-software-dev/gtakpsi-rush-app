import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { loadTsxModule } from "../helpers/loadTsxComponent.js";

const contextPath = fileURLToPath(new URL("../../src/features/voting/admin/AdminVotingContext.tsx", import.meta.url));
const providerPath = fileURLToPath(new URL("../../src/features/voting/admin/AdminVotingContextProvider.tsx", import.meta.url));

test("admin voting provider retains its initial context and fetch transition", async () => {
    // Verify admin voting provider retains its initial context and fetch transition.
    const initialStates = [];
    const updates = [];
    const requests = [];
    let effect;
    let currentContext;

    const react = {
        ...React,
        // Return the create context fixture for this scenario.
        createContext: () => ({ Provider: function Provider({ children }) {
            // Return children to the caller.
             return children; } }),
        // Return current context to the caller.
        useContext: () => currentContext,
        // Supply controlled state and a setter without mounting React.
        useState(initial) {
            const index = initialStates.push(initial) - 1;
            return [initial, /* Record callback arguments for assertions. */ (value) => updates.push([index, value])];
        },
        // Update effect in the test harness.
        useEffect: (callback) => { effect = callback; },
    };
    const context = await loadTsxModule(contextPath, { react });
    const provider = await loadTsxModule(providerPath, {
        react,
        "./AdminVotingContext": { AdminVotingContext: context.AdminVotingContext },
        "../../brothers/getAllBrothers": {
            // Record brother loading and return the brother fixture.
            getAllBrothers: async () => {
                requests.push("brothers");
                return [{ _id: "brother-1" }];
            },
        },
    });

    const element = provider.AdminVotingContextProvider({ children: "dashboard" });
    const value = element.props.value;

    assert.equal(element.props.children, "dashboard");
    assert.deepEqual(JSON.parse(JSON.stringify(initialStates)), [[], null, null, [], true]);
    assert.deepEqual(JSON.parse(JSON.stringify([value.votes, value.rushee, value.question, value.brothers])), [[], null, null, []]);
    assert.deepEqual(Object.keys(value), [
        "votes", "rushee", "question", "brothers", "setVotes", "setRushee", "setQuestion",
    ]);

    currentContext = value;
    assert.equal(context.useAdminVotingContext(), value);
    effect();
    await setImmediate();

    assert.deepEqual(requests, ["brothers"]);
    assert.deepEqual(updates, [[3, [{ _id: "brother-1" }]], [4, false]]);
});

test("admin voting context rejects use outside its provider", async () => {
    // Verify admin voting context rejects use outside its provider.
    const context = await loadTsxModule(contextPath, {
        react: { ...React, useContext: /* Return null from this dependency stub. */ () => null },
        "../../brothers/getAllBrothers": { getAllBrothers: /* Return the all brothers fixture for this scenario. */ async () => [] },
    });

    assert.throws(
        /* Invoke the operation whose failure is being asserted. */
        () => context.useAdminVotingContext(), /MUST use context within some provider/);
});
