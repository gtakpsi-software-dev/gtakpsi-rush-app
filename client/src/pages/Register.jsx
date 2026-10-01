import { useState, useRef } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import RegistrationStageView from "../features/registration/RegistrationStageView";
import RegistrationSuccessView from "../features/registration/RegistrationSuccessView";

import { useNavigate } from "react-router-dom";
import { verifyInfo } from "../features/registration/registrationVerification";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../js/image_processing";
import { createBasicInfoSubmit } from "../features/registration/createBasicInfoSubmit";
import { createPisSubmit } from "../features/registration/createPisSubmit";

export default function Register() {
    const api = import.meta.env.VITE_API_PREFIX;

    const [firstnameVal, setFirstnameVal] = useState();
    const [lastnameVal, setLastnameVal] = useState();
    const [emailVal, setEmailVal] = useState();
    const [housingVal, setHousingVal] = useState();
    const [phoneVal, setPhoneVal] = useState();
    const [gtidVal, setGtidVal] = useState();
    const [majorVal, setMajorVal] = useState();
    const [pronounsVal, setPronounsVal] = useState();
    const [yearVal, setYearVal] = useState();
    const [exposureVal, setExposureVal] = useState();

    const [page, setPage] = useState(0);
    const [currLoading, setCurrLoading] = useState(false);

    const [error, setError] = useState(null);
    const [errorTitle, setErrorTitle] = useState("Uh Oh! Something Unexpected Occurred..");
    const [errorDescription, setErrorDescription] = useState("Default Error Message...");

    const [image, setImage] = useState();
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [flexWindow, setFlexWindow] = useState(false);

    const [accessCode, setAccessCode] = useState();

    const firstname = useRef();
    const lastname = useRef();
    const email = useRef();
    const housing = useRef();
    const phone = useRef();
    const gtid = useRef();
    const major = useRef();
    const pronouns = useRef();
    const year = useRef();
    const exposure = useRef();

    const webcamRef = useRef();

    const navigate = useNavigate();

    const basicInfoSubmit = createBasicInfoSubmit({
        fields: [
            [firstname, setFirstnameVal],
            [lastname, setLastnameVal],
            [email, setEmailVal],
            [housing, setHousingVal],
            [phone, setPhoneVal],
            [gtid, setGtidVal],
            [major, setMajorVal],
            [pronouns, setPronounsVal],
            [year, setYearVal],
            [exposure, setExposureVal],
        ],
        gtid,
        email,
        phone,
        verifyInfo,
        setCurrLoading,
        setPage,
        toast,
        logError: (error) => console.log(error),
    });

    const handlePhotoContinue = () => {
        setPage(2);
    };

    const pisSubmit = createPisSubmit({
        api,
        form: {
            firstName: firstnameVal,
            lastName: lastnameVal,
            housing: housingVal,
            phone: phoneVal,
            email: emailVal,
            gtid: gtidVal,
            major: majorVal,
            year: yearVal,
            pronouns: pronounsVal,
            exposure: exposureVal,
            selectedSlot,
            flexWindow,
            image,
        },
        pageError: error,
        errorTitle,
        errorDescription,
        storage,
        ref,
        base64ToBlob,
        uploadBytes,
        getDownloadURL,
        post: (...args) => axios.post(...args),
        navigate,
        setCurrLoading,
        setPage,
        setErrorTitle,
        setErrorDescription,
        setAccessCode,
        setError,
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
                    basicInfoProps={{
                        firstname,
                        lastname,
                        email,
                        housing,
                        phone,
                        gtid,
                        major,
                        pronouns,
                        year,
                        exposure,
                        onContinue: basicInfoSubmit,
                    }}
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
