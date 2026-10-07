import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadTsxComponent } from "../helpers/loadTsxComponent.js";

const hookPath = fileURLToPath(new URL(
    "../../src/features/registration/useRegistrationFormState.js", import.meta.url,
));

test("registration form state keeps hook order and pairs each field with its setter", async () => {
    const initials = [];
    const setters = [];
    const refs = [];
    const states = {
        0: "Ada", 1: "Example", 2: "ada@example.com", 3: "North Ave",
        4: "555-0100", 5: "123", 6: "CS", 7: "she/her",
        8: "third", 9: "friend", 10: 2, 11: true,
        15: "image", 16: "slot", 17: true, 18: "access",
    };
    const useRegistrationFormState = await loadTsxComponent(hookPath, {
        react: {
            useState(initial) {
                const index = initials.push(initial) - 1;
                const setter = () => {};
                setters.push(setter);
                return [Object.hasOwn(states, index) ? states[index] : initial, setter];
            },
            useRef() {
                const ref = { current: `ref-${refs.length}` };
                refs.push(ref);
                return ref;
            },
        },
    });

    const state = useRegistrationFormState();
    assert.equal(initials.length, 19);
    assert.deepEqual(initials.slice(0, 10), Array(10).fill(undefined));
    assert.deepEqual(initials.slice(10), [
        0, false, null, "Uh Oh! Something Unexpected Occurred..",
        "Default Error Message...", undefined, null, false, undefined,
    ]);
    assert.equal(refs.length, 11);
    assert.deepEqual(Array.from(state.basicInfoFields, ([input, setter]) => [
        input.current, setters.indexOf(setter),
    ]), Array.from({ length: 10 }, (_, index) => [`ref-${index}`, index]));
    assert.deepEqual(Object.keys(state.inputs), [
        "firstname", "lastname", "email", "housing", "phone",
        "gtid", "major", "pronouns", "year", "exposure",
    ]);
    assert.equal(state.webcamRef, refs[10]);
    assert.deepEqual(Object.entries(state.pisForm), [
        ["firstName", "Ada"], ["lastName", "Example"],
        ["housing", "North Ave"], ["phone", "555-0100"],
        ["email", "ada@example.com"], ["gtid", "123"],
        ["major", "CS"], ["year", "third"],
        ["pronouns", "she/her"], ["exposure", "friend"],
        ["selectedSlot", "slot"], ["flexWindow", true], ["image", "image"],
    ]);
    assert.equal(state.page, 2);
    assert.equal(state.currLoading, true);
    assert.equal(state.accessCode, "access");
});
