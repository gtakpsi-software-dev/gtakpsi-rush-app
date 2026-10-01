export async function resetPasswordWithServices(email, {
    auth,
    sendPasswordResetEmail,
    toast,
    resetErrorMessage,
    logger,
}) {
    try {
        await sendPasswordResetEmail(auth, email);

        toast.success("Password reset email sent! Check your inbox.", {
            position: "top-center",
            autoClose: 5000,
            theme: "dark",
        });

        return true;
    } catch (error) {
        logger.error("Password reset error:", error);

        toast.error(resetErrorMessage(error.code), {
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
