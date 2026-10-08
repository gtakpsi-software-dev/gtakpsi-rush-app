import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { resetPassword } from "../features/auth/account";
import ForgotPasswordView from "../features/auth/ForgotPasswordView";

// Manage password-reset submission and the email-sent confirmation.
export default function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const email = useRef<HTMLInputElement>(null);

    // Send a reset email for the entered address and update loading and confirmation state.
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

    // Submit the password-reset form when Enter is pressed.
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
            onTryAgain={/* Return from the confirmation to the password-reset form. */ () => setEmailSent(false)}
        />
    );
}
