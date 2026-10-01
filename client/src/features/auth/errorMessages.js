export function loginErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/invalid-credential':
            return 'Invalid email or password';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later';
        default:
            return 'Some error occurred. Try again later';
    }
}

export function accountErrorMessage(code) {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'An account with this email already exists';
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/operation-not-allowed':
            return 'Email/password accounts are not enabled';
        case 'auth/weak-password':
            return 'Password is too weak. Use at least 6 characters';
        default:
            return 'Some error occurred. Try again later';
    }
}

export function resetErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-not-found':
            return 'No account found with this email';
        default:
            return 'Some error occurred. Try again later';
    }
}
