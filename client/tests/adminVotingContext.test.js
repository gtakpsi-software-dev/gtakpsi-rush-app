import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import React from "react";
import { loadTsxModule } from "./helpers/loadTsxComponent.js";

const contextPath = fileURLToPath(new URL("../src/features/voting/admin/AdminVotingContext.tsx", import.meta.url));
const providerPath = fileURLToPath(new URL("../src/features/voting/admin/AdminVotingContextProvider.tsx", import.meta.url));

test("admin voting provider retains its initial context and fetch transition", async () => {
    const initialStates = [];
    const updates = [];
    const requests = [];
    let effect;
    let currentContext;

    const react = {
        ...React,
        createContext: () => ({ Provider: function Provider({ children }) { return children; } }),
        useContext: () => currentContext,
        useState(initial) {
            const index = initialStates.push(initial) - 1;
            return [initial, (value) => updates.push([index, value])];
        },
        useEffect: (callback) => { effect = callback; },
    };
    const context = await loadTsxModule(contextPath, { react });
    const provider = await loadTsxModule(providerPath, {
        react,
        "./AdminVotingContext": { AdminVotingContext: context.AdminVotingContext },
        "../../brothers/getAllBrothers": {
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
    const context = await loadTsxModule(contextPath, {
        react: { ...React, useContext: () => null },
        "../../brothers/getAllBrothers": { getAllBrothers: async () => [] },
    });

    assert.throws(() => context.useAdminVotingContext(), /MUST use context within some provider/);
});
