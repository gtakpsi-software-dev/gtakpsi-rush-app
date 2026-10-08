import assert from "node:assert/strict";
import test from "node:test";

import { getRusheeNumber, isBidCommitteeMode } from "../../../src/features/rushee/zoom/routeContext.js";

test("rushee number retains URL decoding, raw value, and the missing-number fallback", () => {
    // Verify rushee number retains URL decoding, raw value, and the missing-number fallback.
    assert.equal(getRusheeNumber("?rushee_num=007"), "007");
    assert.equal(getRusheeNumber("?rushee_num=A%20B"), "A B");
    assert.equal(getRusheeNumber("?other=7"), "---");
    assert.equal(getRusheeNumber("?rushee_num="), "---");
});

test("bid committee mode checks path, literal query text, then referrer lazily", () => {
    // Verify bid committee mode checks path, literal query text, then referrer lazily.
    const referrers = [];
    // Record referrer lookup and return the bid-committee route.
    const getReferrer = () => { referrers.push("read"); return "/bid-committee/board"; };

    assert.equal(isBidCommitteeMode({ pathname: "/bid-committee/rushee", search: "" }, getReferrer), true);
    assert.equal(isBidCommitteeMode({ pathname: "/brother/rushee", search: "?bid_committee=true" }, getReferrer), true);
    assert.deepEqual(referrers, []);
    assert.equal(isBidCommitteeMode({ pathname: "/brother/rushee", search: "?bid_committee=false" }, getReferrer), true);
    assert.deepEqual(referrers, ["read"]);
    assert.equal(isBidCommitteeMode({ pathname: "/brother/rushee", search: "" }, /* Return the fixed string fixture. */ () => ""), false);
});
