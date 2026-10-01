function storedUser(uid, email, displayName, firstName, lastName) {
    // Keep both name conventions because the voting UI and newer screens read different keys.
    return {
        _id: uid,
        uid,
        email,
        displayName,
        firstname: firstName,
        lastname: lastName,
        firstName,
        lastName,
    };
}

export function loginStoredUser(user) {
    const nameParts = user.displayName?.split(' ') || ['', ''];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return storedUser(user.uid, user.email, user.displayName, firstName, lastName);
}

export function createdStoredUser(user, credentials, displayName) {
    return storedUser(
        user.uid,
        user.email,
        displayName,
        credentials.firstName || '',
        credentials.lastName || ''
    );
}
