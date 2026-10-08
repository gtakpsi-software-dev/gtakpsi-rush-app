import { accountErrorMessage } from "./errorMessages.js";
import { createdStoredUser } from "./userSession.js";

// Create an allowed brother account, save its Firestore profile, and persist the local session.
export async function createAccountWithServices(credentials, {
    isEmailAllowed,
    auth,
    createUserWithEmailAndPassword,
    updateProfile,
    db,
    doc,
    setDoc,
    storeUser,
    toast,
    logger,
}) {
    // INVARIANT: reject unlisted addresses before creating a Firebase account.
    if (!isEmailAllowed(credentials.email)) {
        toast.error('This email is not authorized to create an account. Only GT AKPsi brothers can register.', {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark",
        });
        return false;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            credentials.email,
            credentials.pwd
        );

        const user = userCredential.user;
        const displayName = `${credentials.firstName || ''} ${credentials.lastName || ''}`.trim();
        if (displayName) {
            await updateProfile(user, { displayName });
        }

        const userDoc = {
            uid: user.uid,
            email: user.email,
            firstname: credentials.firstName || '',
            lastname: credentials.lastName || '',
            displayName: displayName,
            createdAt: new Date().toISOString(),
        };

        await setDoc(doc(db, "brothers", user.uid), userDoc);

        storeUser('user', JSON.stringify(createdStoredUser(user, credentials, displayName)));

        toast.success('Account created successfully!', {
            position: "top-center",
            autoClose: 3000,
            theme: "dark",
        });

        return true;
    } catch (error) {
        logger.error("Create account error:", error);

        toast.error(accountErrorMessage(error.code), {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "dark",
        });

        return false;
    }
}
