import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { transformWithEsbuild } from "vite";

const sourcePath = fileURLToPath(new URL("../../src/features/registration/registrationVerification.js", import.meta.url));
const requireFromSource = createRequire(sourcePath);

// Load verifications with injected dependencies for isolated tests.
async function loadVerifications(get = /* Return the fixture for this scenario. */ async () => ({ data: { status: "success" } })) {
    const source = (await readFile(sourcePath, "utf8"))
        .replace("const api = import.meta.env.VITE_API_PREFIX;", 'const api = "/api";');
    const compiled = await transformWithEsbuild(source, sourcePath, { format: "cjs" });
    const module = { exports: {} };
    const calls = [];
    const logs = [];
    const errors = [];

    runInNewContext(compiled.code, {
        module,
        exports: module.exports,
        console: {
            // Record log calls for assertions.
            log: (value) => logs.push(value),
            // Record error calls for assertions.
            error: (error) => errors.push(error),
        },
        // Resolve injected test dependencies before falling back to real modules.
        require(specifier) {
            if (specifier === "axios") return { get: (...args) => {
                // Record verification arguments and delegate to the configured GET stub.
                 calls.push(args); return get(...args); } };
            return requireFromSource(specifier);
        },
    }, { filename: sourcePath });

    return { ...module.exports, calls, logs, errors };
}

// Invoke JSON.parse with the test inputs.
function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test("GTID verification accepts exactly nine ASCII digits", async () => {
    // Verify GTID verification accepts exactly nine ASCII digits.
    const { verifyGTID } = await loadVerifications();
    assert.equal(verifyGTID("123456789"), true);
    assert.equal(verifyGTID("12345678"), false);
    assert.equal(verifyGTID("12345678a"), false);
    assert.equal(verifyGTID("１２３４５６７８９"), false);
});

test("registration validation preserves the existing error order and network bypass", async () => {
    // Verify registration validation preserves the existing error order and network bypass.
    const verification = await loadVerifications();
    const { verifyInfo } = verification;

    assert.deepEqual(plain(await verifyInfo("short", "bad", "short", true)), {
        status: "error", message: "GTID Must be 9 digits long",
    });
    assert.deepEqual(plain(await verifyInfo("123456789", "bad", "short", true)), {
        status: "error", message: "Phone Number must be 10 digits long",
    });
    assert.deepEqual(plain(await verifyInfo("abcdefghi", "bad", "(404) 555-0100", true)), {
        status: "error", message: "GTID must be comprised of all digits",
    });
    assert.deepEqual(plain(await verifyInfo("123456789", "bad", "(404) 555-0100", true)), {
        status: "error", message: "Email must be a valid Georgia Tech Email Address",
    });
    assert.deepEqual(plain(await verifyInfo("123456789", "user@gatech.edu", "(404) 555-0100", false)), {
        status: "success",
    });
    assert.deepEqual(verification.calls, []);
    assert.deepEqual(verification.logs, [5, 9, 9, 9, 9]);
});

test("registration lookup preserves success, duplicate, unexpected, and network responses", async () => {
    // Verify registration lookup preserves success, duplicate, unexpected, and network responses.
    for (const [data, expected] of [
        [{ status: "success" }, { status: "success" }],
        [{ message: "exists" }, { status: "error", message: "Rushee with GTID 123456789 already exists in our system" }],
        [{ status: "error" }, { status: "error", message: "Some server-based network error occurred" }],
    ]) {
        const verification = await loadVerifications(/* Return the fixture for this scenario. */ async () => ({ data }));
        assert.deepEqual(plain(await verification.verifyInfo("123456789", "user@gatech.edu", "(404) 555-0100", true)), expected);
        assert.deepEqual(plain(verification.calls), [["/api/rushee/does-rushee-exist/123456789"]]);
    }

    const failure = new Error("offline");
    const verification = await loadVerifications(async () => {
        // Simulate a dependency failure for this scenario.
         throw failure; });
    assert.deepEqual(plain(await verification.verifyInfo("123456789", "user@gatech.edu", "(404) 555-0100", true)), {
        status: "error", message: "Some network error occurred",
    });
    assert.equal(verification.errors[0], failure);
});
