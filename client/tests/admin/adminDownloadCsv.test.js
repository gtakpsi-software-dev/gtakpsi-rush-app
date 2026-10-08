import assert from "node:assert/strict";
import test from "node:test";

import { downloadCsv } from "../../src/features/admin/data/downloadCsv.js";

// Run assertions with browser download fakes, then restore the original globals.
function withBrowserFakes(supportsDownload, run) {
    const originalDocument = globalThis.document;
    const originalBlob = globalThis.Blob;
    const originalUrl = globalThis.URL;
    const calls = [];
    const blob = { content: null, options: null };
    const link = {
        download: supportsDownload ? "" : undefined,
        style: {},
        // Record set attribute calls for assertions.
        setAttribute: (name, value) => calls.push(["attribute", name, value]),
        // Record click calls for assertions.
        click: () => calls.push(["click"]),
    };

    try {
        globalThis.Blob = class {
            // Capture the blob contents and options for download assertions.
            constructor(content, options) {
                calls.push(["blob"]);
                blob.content = content;
                blob.options = options;
            }
        };
        globalThis.URL = { createObjectURL: () => {
            // Record object URL creation and return a fixed blob URL.
            calls.push(["url"]);
            return "blob:test-download";
        } };
        globalThis.document = {
            // Record element creation and return the fake download link.
            createElement: (tag) => {
                calls.push(["element", tag]);
                return link;
            },
            body: {
                // Verify that the download link is attached to the document.
                appendChild: (element) => {
                    assert.equal(element, link);
                    calls.push(["append"]);
                },
                // Verify that the download link is removed from the document.
                removeChild: (element) => {
                    assert.equal(element, link);
                    calls.push(["remove"]);
                },
            },
        };
        run({ calls, blob, link });
    } finally {
        globalThis.document = originalDocument;
        globalThis.Blob = originalBlob;
        globalThis.URL = originalUrl;
    }
}

test("CSV download preserves blob type, filename, and browser call order", () => {
    // Verify CSV download preserves blob type, filename, and browser call order.
    withBrowserFakes(true, ({ calls, blob, link }) => {
        // Verify CSV contents, filename, and the browser download sequence.
        downloadCsv("heading\nvalue", "Rushee_Numbers");

        assert.deepEqual(blob.content, ["heading\nvalue"]);
        assert.deepEqual(blob.options, { type: "text/csv;charset=utf-8;" });
        assert.deepEqual(calls.map(/* Extract the recorded operation name. */ (call) => call[0]), [
            "blob", "element", "url", "attribute", "attribute", "append", "click", "remove",
        ]);
        assert.deepEqual(calls[3], ["attribute", "href", "blob:test-download"]);
        assert.equal(calls[4][1], "download");
        assert.match(calls[4][2], /^Rushee_Numbers_\d{4}-\d{2}-\d{2}\.csv$/);
        assert.equal(link.style.visibility, "hidden");
    });
});

test("unsupported download still creates a CSV blob and link without triggering a click", () => {
    // Verify unsupported download still creates a CSV blob and link without triggering a click.
    withBrowserFakes(false, ({ calls, blob }) => {
        // Verify that unsupported download attributes stop link-based downloading.
        downloadCsv("empty", "PIS_Schedule");
        assert.deepEqual(blob.content, ["empty"]);
        assert.deepEqual(calls, [["blob"], ["element", "a"]]);
    });
});
