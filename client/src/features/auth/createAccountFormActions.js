// Create account-form validation, submission, and Enter-key handlers.
export function createAccountFormActions({
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    toast,
    setLoading,
    createAccount,
    navigate,
}) {
    // Show an account-form validation error toast.
    const showValidationError = (message) => {
        toast.error(message, {
            position: "top-center",
            autoClose: 5000,
            theme: "dark",
        });
    };

    // Validate account fields, create the account, and navigate after success.
    const handleCreateAccount = async () => {
        // Check in this order so the first validation error stops account creation.
        if (!firstName.current?.value || !lastName.current?.value) {
            showValidationError("Please enter your first and last name");
            return;
        }

        if (!email.current?.value) {
            showValidationError("Please enter your email");
            return;
        }

        if (!password.current?.value) {
            showValidationError("Please enter a password");
            return;
        }

        if (password.current?.value !== confirmPassword.current?.value) {
            showValidationError("Passwords do not match");
            return;
        }

        if (password.current?.value.length < 6) {
            showValidationError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);

        const success = await createAccount({
            firstName: firstName.current?.value,
            lastName: lastName.current?.value,
            email: email.current?.value,
            pwd: password.current?.value,
        });

        setLoading(false);

        if (success) {
            navigate("/dashboard");
        }
    };

    // Submit the account form when Enter is pressed.
    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            handleCreateAccount();
        }
    };

    return { handleCreateAccount, handleKeyPress };
}
