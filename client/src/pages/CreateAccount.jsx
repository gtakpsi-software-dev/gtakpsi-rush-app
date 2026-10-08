import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { createAccount } from "../features/auth/account";
import { createAccountFormActions } from "../features/auth/createAccountFormActions";
import CreateAccountView from "../features/auth/CreateAccountView";

// Connect account-form refs and submission actions to the account-creation view.
export default function CreateAccount() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const firstName = useRef();
    const lastName = useRef();
    const email = useRef();
    const password = useRef();
    const confirmPassword = useRef();

    const { handleCreateAccount, handleKeyPress } = createAccountFormActions({
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        toast,
        setLoading,
        createAccount,
        navigate,
    });

    return (
        <CreateAccountView
            firstName={firstName}
            lastName={lastName}
            email={email}
            password={password}
            confirmPassword={confirmPassword}
            loading={loading}
            handleCreateAccount={handleCreateAccount}
            handleKeyPress={handleKeyPress}
        />
    );
}
