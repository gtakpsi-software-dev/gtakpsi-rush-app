/**
 * Comment visibility helpers.
 * When restriction is enabled, regular brothers only see their own comments.
 * Admins, bid committee, and unrestricted mode see all comments.
 *
 * Rushee ratings ride the same switch: whenever comments are hidden, the
 * aggregate rating numbers are hidden too (see the
 * useCommentVisibility hook).
 */

// Allow all comments when restrictions are off or the user has a privileged role.
export function shouldShowAllComments({ requireCommentToView, isAdmin, isBidcom }) {
    return !requireCommentToView || isAdmin || isBidcom;
}

// Build the brother name used to match comment authors, or return an empty string.
export function getBrotherDisplayName(user) {
    if (!user) return "";
    return `${user.firstname} ${user.lastname}`;
}

// Check whether any comment’s author name matches the current brother.
export function hasOwnComment(comments, user) {
    if (!comments?.length || !user) return false;
    const name = getBrotherDisplayName(user);
    return comments.some(/* Match the comment author to the brother’s display name. */ (c) => c.brother_name === name);
}

// Return all comments for unrestricted viewers, or only the current brother’s comments.
export function getVisibleComments(comments, user, { requireCommentToView, isAdmin, isBidcom }) {
    if (!comments?.length) return [];
    if (shouldShowAllComments({ requireCommentToView, isAdmin, isBidcom })) {
        return comments;
    }
    if (!user) return [];
    const name = getBrotherDisplayName(user);
    return comments.filter(/* Keep comments authored under the brother’s display name. */ (c) => c.brother_name === name);
}
