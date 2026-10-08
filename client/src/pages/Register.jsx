import axios from "axios";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import RegistrationStageView from "../features/registration/RegistrationStageView";
import RegistrationSuccessView from "../features/registration/RegistrationSuccessView";
import useRegistrationFormState from "../features/registration/useRegistrationFormState";

import { useNavigate } from "react-router-dom";
import { verifyInfo } from "../features/registration/registrationVerification";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../lib/imageProcessing";
import { createBasicInfoSubmit } from "../features/registration/createBasicInfoSubmit";
import { createPisSubmit } from "../features/registration/createPisSubmit";

// Connect registration stages to validation, photo upload, signup, and confirmation.
export default function Register() {
    const api = import.meta.env.VITE_API_PREFIX;

    const {
        inputs, basicInfoFields, pisForm,
        page, setPage, currLoading, setCurrLoading,
        error, setError, errorTitle, setErrorTitle,
        errorDescription, setErrorDescription,
        image, setImage, selectedSlot, setSelectedSlot,
        flexWindow, setFlexWindow, accessCode, setAccessCode,
        gtidVal, webcamRef,
    } = useRegistrationFormState();

    const navigate = useNavigate();

    const basicInfoSubmit = createBasicInfoSubmit({
        fields: basicInfoFields,
        gtid: inputs.gtid,
        email: inputs.email,
        phone: inputs.phone,
        verifyInfo,
        setCurrLoading,
        setPage,
        toast,
        // Log a basic-information submission error.
        logError: (error) => console.log(error),
    });

    // Advance from photo capture to PIS selection.
    const handlePhotoContinue = () => {
        setPage(2);
    };

    const pisSubmit = createPisSubmit({
        api,
        form: pisForm,
        pageError: error,
        errorTitle,
        errorDescription,
        storage,
        ref,
        base64ToBlob,
        uploadBytes,
        getDownloadURL,
        // Forward the signup request through Axios.
        post: (...args) => axios.post(...args),
        navigate,
        setCurrLoading,
        setPage,
        setErrorTitle,
        setErrorDescription,
        setAccessCode,
        setError,
        // Log a final registration submission error.
        logError: (error) => console.log(error),
    });

    // The completed page replaces the form shell so its full-screen layout stays intact.
    if (page === 3 && !currLoading) {
        return (
            <RegistrationSuccessView
                title={"Congrats! You've successfully registered for AKPsi Fall 2026 Rush."}
                description={"If you need to change your information or update your picture, please use the link below. You can close this page when you are done."}
                gtid={gtidVal}
                accessCode={accessCode}
            />
        );
    }

    return (
        <div className="w-screen h-screen bg-white flex flex-col overflow-y-auto">
            <Navbar stripped={true} />

            <div className="flex-1 flex flex-col items-center justify-center animate-fade-in">
                <RegistrationStageView
                    page={page}
                    loading={currLoading}
                    basicInfoProps={{ ...inputs, onContinue: basicInfoSubmit }}
                    photoProps={{
                        webcamRef,
                        image,
                        setImage,
                        onContinue: handlePhotoContinue,
                    }}
                    pisProps={{
                        selectedSlot,
                        setSelectedSlot,
                        flexWindow,
                        setFlexWindow,
                        onContinue: pisSubmit,
                    }}
                />
            </div>
        </div>
    );
}
