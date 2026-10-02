import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowAllComments, getVisibleComments, hasOwnComment, getBrotherDisplayName } from "../src/features/comments/commentVisibility.js";

const user = { firstname: 'Alex', lastname: 'Brother' };
const comments = [
    { brother_name: 'Alex Brother', comment: 'Own observation' },
    { brother_name: 'Other Brother', comment: 'Another observation' },
];

test('comment visibility retains every restriction and role combination', () => {
    for (const requireCommentToView of [false, true]) {
        for (const isAdmin of [false, true]) {
            for (const isBidcom of [false, true]) {
                const options = { requireCommentToView, isAdmin, isBidcom };
                const expected = !requireCommentToView || isAdmin || isBidcom;
                assert.equal(shouldShowAllComments(options), expected);
                assert.deepEqual(getVisibleComments(comments, user, options), expected ? comments : [comments[0]]);
            }
        }
    }
});

test('restricted visibility matches the full stored brother name exactly', () => {
    const options = { requireCommentToView: true, isAdmin: false, isBidcom: false };
    assert.deepEqual(getVisibleComments(comments, null, options), []);
    assert.deepEqual(getVisibleComments(comments, { firstname: 'alex', lastname: 'Brother' }, options), []);
    assert.deepEqual(getVisibleComments(undefined, user, options), []);
    assert.equal(hasOwnComment(comments, user), true);
    assert.equal(hasOwnComment(comments, null), false);
    assert.equal(hasOwnComment([], user), false);
    assert.equal(getBrotherDisplayName(null), '');
    assert.equal(getBrotherDisplayName(user), 'Alex Brother');
});

test('unrestricted access returns the original array even without a current user', () => {
    assert.equal(getVisibleComments(comments, null, { requireCommentToView: false }), comments);
});
