import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { login } from "../features/auth/account";
import LoginView from "../features/auth/LoginView";
import { verifyUser } from "../features/auth/verifyUser";

export default function Login() {
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetch() {
            setLoading(true);
            await verifyUser()
                .then((response) => {
                    console.log(response);
                    if (response == true) {
                        navigate("/dashboard");
                    } else {
                        setLoading(false);
                    }
                })
                .catch((error) => {
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

    const handleLogin = async () => {
        const success = await login({
            email: email.current?.value,
            pwd: password.current?.value,
        });
        if (success) {
            navigate("/dashboard");
        }
    };

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
