import { toast } from "react-toastify";
import { auth, signOut } from "../../firebase";

const api = import.meta.env.VITE_API_PREFIX;

// Verify the Firebase session, check app access, and synchronize the locally stored user.
export async function verifyUser() {
    return new Promise((resolve) => {
        // Wait for the first authentication result to resolve session verification.
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            // Check the current user once, clear denied sessions, and refresh stored identity fields.
            unsubscribe();

            if (user) {
                try {
                    const tokenResult = await user.getIdTokenResult(true);
                    const isAdmin = tokenResult.claims?.admin === true;
                    const isBidcom = tokenResult.claims?.bidcom === true;
                    const apiKey = import.meta.env.VITE_API_KEY;
                    const headers = {
                        "Content-Type": "application/json",
                    };
                    if (apiKey) {
                        headers["X-API-Key"] = apiKey;
                    }

                    const accessResponse = await fetch(`${api}/brother/rush-app/check-access`, {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            uid: user.uid,
                            is_admin: isAdmin,
                            is_bidcom: isBidcom,
                        }),
                    });
                    const accessData = await accessResponse.json();
                    if (accessData.status === "success" && accessData.allowed === false) {
                        await signOut(auth);
                        localStorage.removeItem("user");
                        toast.error(accessData.reason || "The Rush App has been temporarily disabled.", {
                            position: "top-center",
                            autoClose: 6000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            theme: "dark",
                        });
                        resolve(false);
                        return;
                    }
                } catch (accessError) {
                    // Access-check failures retain the existing fail-open behavior.
                    console.warn("Could not check Rush App access status:", accessError);
                }

                const nameParts = user.displayName?.split(" ") || ["", ""];
                const firstName = nameParts[0] || "";
                const lastName = nameParts.slice(1).join(" ") || "";

                // Voting still reads lowercase names and _id; other screens use camelCase.
                localStorage.setItem("user", JSON.stringify({
                    _id: user.uid,
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    firstname: firstName,
                    lastname: lastName,
                    firstName: firstName,
                    lastName: lastName,
                }));
                resolve(true);
            } else {
                localStorage.removeItem("user");
                resolve(false);
            }
        });
    });
}
