import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { base64ToBlob } from "../../src/lib/imageProcessing.js";

test("base64 image conversion keeps the decoded bytes and default JPEG type", async () => {
    // Verify base64 image conversion keeps the decoded bytes and default JPEG type.
    const bytes = Uint8Array.from([0, 1, 127, 255]);
    const encoded = Buffer.from(bytes).toString("base64");
    const blob = base64ToBlob(`data:image/png;base64,${encoded}`);

    assert.equal(blob.type, "image/jpeg");
    assert.equal(blob.size, bytes.length);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});

test("base64 image conversion keeps custom MIME type across 512-byte chunks", async () => {
    // Verify base64 image conversion keeps custom MIME type across 512-byte chunks.
    const bytes = Uint8Array.from({ length: 1025 }, /* Generate a repeating byte sequence for the image fixture. */ (_, index) => index % 256);
    const encoded = Buffer.from(bytes).toString("base64");
    const blob = base64ToBlob(`data:image/webp;base64,${encoded}`, "image/webp");

    assert.equal(blob.type, "image/webp");
    assert.equal(blob.size, bytes.length);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
});
