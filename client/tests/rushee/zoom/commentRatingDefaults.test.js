import assert from "node:assert/strict";
import test from "node:test";

import {
    RATING_FIELDS,
    createDefaultRatings,
    createDefaultNotSeen,
} from "../../../src/features/rushee/zoom/commentRatingDefaults.js";

test("new comment ratings retain their original fields, values, and independent state", () => {
    // Verify new comment ratings retain their original fields, values, and independent state.
    assert.deepEqual(RATING_FIELDS, [
        "Why AKPsi",
        "1:1 Interactions",
        "Group Interactions",
        "Professionalism",
    ]);

    const ratings = createDefaultRatings();
    const notSeen = createDefaultNotSeen();
    assert.deepEqual(ratings, Object.fromEntries(RATING_FIELDS.map(/* Return the fixture for this scenario. */ (field) => [field, 3])));
    assert.deepEqual(notSeen, Object.fromEntries(RATING_FIELDS.map(/* Return the fixture for this scenario. */ (field) => [field, true])));

    ratings["Why AKPsi"] = 1;
    notSeen["Why AKPsi"] = false;
    assert.equal(createDefaultRatings()["Why AKPsi"], 3);
    assert.equal(createDefaultNotSeen()["Why AKPsi"], true);
});
