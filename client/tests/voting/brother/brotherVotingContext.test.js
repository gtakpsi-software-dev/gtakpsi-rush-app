import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { loadTsxModule } from "../../helpers/loadTsxComponent.js";

const contextPath = fileURLToPath(new URL(
    "../../../src/features/voting/brother/BrotherVotingContext.tsx", import.meta.url,
));
const providerPath = fileURLToPath(new URL(
    "../../../src/features/voting/brother/BrotherVotingContextProvider.tsx", import.meta.url,
));

test("voter context retains its initial values and provider contract", async () => {
    const initialValues = [];
    let currentContext;
    const react = {
        ...React,
        createContext: () => ({ Provider: ({ children }) => children }),
        useContext: () => currentContext,
        useState(value) {
            initialValues.push(value);
            return [value, () => {}];
        },
    };
    const context = await loadTsxModule(contextPath, { react });
    const provider = await loadTsxModule(providerPath, {
        react,
        "./BrotherVotingContext": { BrotherVotingContext: context.BrotherVotingContext },
    });

    const element = provider.BrotherVotingContextProvider({ children: "voter" });
    currentContext = element.props.value;

    assert.equal(element.props.children, "voter");
    assert.deepEqual(initialValues, [null, null]);
    assert.deepEqual(Object.keys(currentContext), [
        "rushee", "question", "setRushee", "setQuestion",
    ]);
    assert.equal(context.useBrotherVotingContext(), currentContext);
});

test("voter context rejects use without its provider", async () => {
    const context = await loadTsxModule(contextPath, {
        react: { ...React, useContext: () => null },
    });
    assert.throws(() => context.useBrotherVotingContext(),
        /MUST use context within some provider/);
});
