import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { resetPassword } from "../features/auth/account";
import ForgotPasswordView from "../features/auth/ForgotPasswordView";

/**
 * Password Reset Summary:
 * - Keep request state in the route so the form and confirmation share one email ref.
 * - The view receives actions without changing reset or retry timing.
 */
export default function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const email = useRef<HTMLInputElement>(null);

    const handleResetPassword = async () => {
        if (!email.current?.value) {
            return;
        }

        setLoading(true);

        const success = await resetPassword(email.current?.value);

        setLoading(false);

        if (success) {
            setEmailSent(true);
        }
    };

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleResetPassword();
        }
    };

    return (
        <ForgotPasswordView
            loading={loading}
            emailSent={emailSent}
            email={email}
            handleResetPassword={handleResetPassword}
            handleKeyPress={handleKeyPress}
            onTryAgain={() => setEmailSent(false)}
        />
    );
}
