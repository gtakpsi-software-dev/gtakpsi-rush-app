import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../lib/imageProcessing";
import { verifyInfo } from "../features/registration/registrationVerification";
import { submitProfileChanges } from "../features/rushee/self/submitProfileChanges";
import { submitRusheePhoto } from "../features/rushee/self/submitRusheePhoto";
import RusheeSelfPageView from "../features/rushee/self/RusheeSelfPageView";

// Load a profile through its access code and manage profile and photo editing.
export default function RusheePage() {
    const { gtid, link } = useParams();
    const [rushee, setRushee] = useState(null);
    const [initialRushee, setInitialRushee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [showPreview, setShowPreview] = useState(false);
    const [image, setImage] = useState();

    const webcamRef = useRef();

    // Capture a webcam screenshot and display it for review.
    const capture = () => {
        const screenshot = webcamRef.current.getScreenshot();
        setShowPreview(true);
        setImage(screenshot);
    };

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        // Fetch the profile while the page is loading.
        // Request the profile using the route’s GTID and access code.
        async function fetch() {
            await axios
                .get(`${api}/rushee/self/${gtid}`, { params: { code: link } })
                .then((response) => {
                    // Store the loaded profile or navigate to the appropriate access or lookup error.
                    if (response.data.status === "success") {
                        const fetchedRushee = response.data.payload;
                        setRushee(fetchedRushee);
                        setInitialRushee(fetchedRushee);
                    } else if (response.data.message === "Invalid access code") {
                        navigate(`/error/${"Incorrect Access Code"}/${"Reach out to the Support Team for assistance"}`);
                    } else {
                        navigate(`/error/${"Rushee with this GTID does not exist"}`);
                    }
                })
                .catch(() => {
                    // Navigate to the retry error page after a failed profile request.
                    navigate(`/error/${"An error occurred"}/${"Please try again later"}`);
                });

            setLoading(false);
        }

        if (loading) {
            fetch();
        }
    }, [loading, api, gtid, link, navigate]);

    // Upload and save the captured photo with the page’s dependencies.
    const handlePhotoSubmit = () => submitRusheePhoto({
        image,
        gtid,
        api,
        storage,
        setLoading,
        makeStorageRef: ref,
        toBlob: base64ToBlob,
        upload: uploadBytes,
        getDownloadUrl: getDownloadURL,
        // Forward the photo-update request through Axios.
        post: (...args) => axios.post(...args),
        toast,
        // Reload the page after a successful photo update.
        reload: () => window.location.reload(),
        navigate,
        logger: console,
    });

    // Validate and submit profile edits using the saved profile as the baseline.
    const handleSubmit = (e) => submitProfileChanges(e, {
        rushee,
        initialRushee,
        api,
        gtid,
        link,
        setLoading,
        toast,
        verifyInfo,
        // Forward the profile-update request through Axios.
        post: (...args) => axios.post(...args),
        location: window.location,
        logger: console,
    });

    // Update the edited profile field by its input name.
    const handleChange = (e) => {
        const { name, value } = e.target;
        setRushee({ ...rushee, [name]: value });
    };

    // Toggle the photo modal and clear its preview and captured image.
    const handlePhotoClose = () => {
        setIsModalOpen(!isModalOpen);
        setShowPreview(false);
        setImage(null);
    };

    const formattedPisTime = loading
        ? null
        : new Date(parseInt(initialRushee.pis_timeslot.$date.$numberLong)).toLocaleString();

    return <RusheeSelfPageView
        loading={loading}
        rushee={rushee}
        initialRushee={initialRushee}
        formattedPisTime={formattedPisTime}
        isModalOpen={isModalOpen}
        showPreview={showPreview}
        image={image}
        webcamRef={webcamRef}
        onPhotoClose={handlePhotoClose}
        onPhotoRetake={/* Return to the camera to retake the profile photo. */ () => setShowPreview(false)}
        onPhotoSave={handlePhotoSubmit}
        onPhotoCapture={capture}
        onEditImage={/* Open the photo-edit modal. */ () => setIsModalOpen(true)}
        onSubmit={handleSubmit}
        onChange={handleChange}
    />;
}
