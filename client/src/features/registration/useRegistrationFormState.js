import { useRef, useState } from "react";

// Create registration field refs, captured values, and stage and submission state.
export default function useRegistrationFormState() {
    // INVARIANT: keep state hooks before input refs so registration stages retain their hook order.
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

    const inputs = {
        firstname, lastname, email, housing, phone,
        gtid, major, pronouns, year, exposure,
    };
    const basicInfoFields = [
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
    ];
    const pisForm = {
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
    };

    return {
        inputs,
        basicInfoFields,
        pisForm,
        page,
        setPage,
        currLoading,
        setCurrLoading,
        error,
        setError,
        errorTitle,
        setErrorTitle,
        errorDescription,
        setErrorDescription,
        image,
        setImage,
        selectedSlot,
        setSelectedSlot,
        flexWindow,
        setFlexWindow,
        accessCode,
        setAccessCode,
        gtidVal,
        webcamRef,
    };
}
