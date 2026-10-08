import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../features/auth/account";
import LoginView from "../features/auth/LoginView";
import { verifyUser } from "../features/auth/verifyUser";

// Verify an existing session and connect the login form to authentication actions.
export default function Login() {
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        // Check the current session while the login page is loading.
        // Verify the session and update navigation or loading state from the result.
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then((response) => {
                    // Open the dashboard for a verified user or reveal the login form.
                    console.log(response);
                    if (response == true) {
                        navigate("/dashboard");
                    } else {
                        setLoading(false);
                    }
                })
                .catch((error) => {
                    // Log verification failure and reveal the login form.
                    console.log(error);
                    setLoading(false);
                });
        }

        if (loading == true) {
            fetch();
        }
    });

    const email = useRef<HTMLInputElement>(null);
    const password = useRef<HTMLInputElement>(null);

    // Submit the entered credentials and navigate to the dashboard after success.
    const handleLogin = async () => {
        const success = await login({
            email: email.current?.value,
            pwd: password.current?.value,
        });
        if (success) {
            navigate("/dashboard");
        }
    };

    // Submit the login form when Enter is pressed.
    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleLogin();
        }
    };

    return (
        <LoginView
            loading={loading}
            email={email}
            password={password}
            handleLogin={handleLogin}
            handleKeyPress={handleKeyPress}
        />
    );
}
