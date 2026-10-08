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
    // Verify voter context retains its initial values and provider contract.
    const initialValues = [];
    let currentContext;
    const react = {
        ...React,
        // Return the create context fixture for this scenario.
        createContext: () => ({ Provider: /* Return children to the caller. */ ({ children }) => children }),
        // Return current context to the caller.
        useContext: () => currentContext,
        // Expose controlled hook state and capture updates for assertions.
        useState(value) {
            initialValues.push(value);
            return [value, /* Leave this mocked callback inert. */ () => {}];
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
    // Verify voter context rejects use without its provider.
    const context = await loadTsxModule(contextPath, {
        react: { ...React, useContext: /* Return no value from this dependency stub. */ () => null },
    });
    assert.throws(/* Invoke the operation whose failure is being asserted. */ () => context.useBrotherVotingContext(),
        /MUST use context within some provider/);
});
