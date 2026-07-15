/**
 * Comment visibility helpers.
 * When restriction is enabled, regular brothers only see their own comments.
 * Admins, bid committee, and unrestricted mode see all comments.
 */

export function shouldShowAllComments({ requireCommentToView, isAdmin, isBidcom }) {
    return !requireCommentToView || isAdmin || isBidcom;
}

export function getBrotherDisplayName(user) {
    if (!user) return "";
    return `${user.firstname} ${user.lastname}`;
}

export function hasOwnComment(comments, user) {
    if (!comments?.length || !user) return false;
    const name = getBrotherDisplayName(user);
    return comments.some((c) => c.brother_name === name);
}

export function getVisibleComments(comments, user, { requireCommentToView, isAdmin, isBidcom }) {
    if (!comments?.length) return [];
    if (shouldShowAllComments({ requireCommentToView, isAdmin, isBidcom })) {
        return comments;
    }
    if (!user) return [];
    const name = getBrotherDisplayName(user);
    return comments.filter((c) => c.brother_name === name);
}
