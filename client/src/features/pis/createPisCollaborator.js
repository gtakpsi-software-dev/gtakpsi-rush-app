import { getStableUserId } from "./stableUserId.js";

// Build a stable collaborator identity from Firebase and stored user data.
export function createPisCollaborator(firebaseUser, storedUser, stableUserId = getStableUserId) {
    const parsedStoredUser = storedUser ? JSON.parse(storedUser) : null;
    const userId = stableUserId(firebaseUser?.uid || parsedStoredUser?._id);

    // Prefer the authenticated display name, then stored profile data, then email.
    let firstName = 'Anonymous';
    let lastName = 'User';

    if (firebaseUser?.displayName) {
        const nameParts = firebaseUser.displayName.split(' ');
        firstName = nameParts[0] || 'Anonymous';
        lastName = nameParts.slice(1).join(' ') || '';
    } else if (parsedStoredUser?.firstName || parsedStoredUser?.firstname) {
        firstName = parsedStoredUser.firstName || parsedStoredUser.firstname || 'Anonymous';
        lastName = parsedStoredUser.lastName || parsedStoredUser.lastname || '';
    } else if (firebaseUser?.email) {
        firstName = firebaseUser.email.split('@')[0] || 'Anonymous';
        lastName = '';
    }

    return { id: userId, firstName, lastName };
}
