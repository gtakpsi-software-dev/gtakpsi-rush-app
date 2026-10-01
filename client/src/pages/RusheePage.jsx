import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import axios from "axios";

import Navbar from "../components/Navbar";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../js/image_processing";
import { verifyInfo } from "../features/registration/registrationVerification";
import { submitProfileChanges } from "../features/rushee/self/submitProfileChanges";
import { submitRusheePhoto } from "../features/rushee/self/submitRusheePhoto";
import RusheePhotoModal from "../features/rushee/self/RusheePhotoModal";
import RusheeProfileForm from "../features/rushee/self/RusheeProfileForm";
import RusheeProfileSummary from "../features/rushee/self/RusheeProfileSummary";

export default function RusheePage() {

    const { gtid, link } = useParams();
    const [rushee, setRushee] = useState(null); // Stores the current state of the rushee
    const [initialRushee, setInitialRushee] = useState(null); // Stores the initial fetched state
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [showPreview, setShowPreview] = useState(false)
    const [image, setImage] = useState()

    const webcamRef = useRef();

    const capture = () => {
        const screenshot = webcamRef.current.getScreenshot();
        setShowPreview(true)
        setImage(screenshot);
    };

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    useEffect(() => {
        async function fetch() {
            await axios
                .get(`${api}/rushee/self/${gtid}`, { params: { code: link } })
                .then((response) => {
                    if (response.data.status === "success") {
                        const fetchedRushee = response.data.payload;
                        setRushee(fetchedRushee);
                        setInitialRushee(fetchedRushee); // Save the initial state for comparison
                    } else if (response.data.message === "Invalid access code") {
                        navigate(`/error/${"Incorrect Access Code"}/${"Reach out to the Support Team for assistance"}`);
                    } else {
                        navigate(`/error/${"Rushee with this GTID does not exist"}`);
                    }
                })
                .catch(() => {
                    navigate(`/error/${"An error occurred"}/${"Please try again later"}`);
                });

            setLoading(false);
        }

        if (loading) {
            fetch();
        }
    }, [loading, api, gtid, link, navigate]);


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
        post: (...args) => axios.post(...args),
        toast,
        reload: () => window.location.reload(),
        navigate,
        logger: console,
    });

    const handleSubmit = (e) => submitProfileChanges(e, {
        rushee,
        initialRushee,
        api,
        gtid,
        link,
        setLoading,
        toast,
        verifyInfo,
        post: (...args) => axios.post(...args),
        location: window.location,
        logger: console,
    });

    // Handle input changes
    const handleChange = (e) => {

        const { name, value } = e.target;
        setRushee({ ...rushee, [name]: value });
    };

    return (
        <div>

            <Navbar stripped={true} />

            {loading ? (
                <Loader />
            ) : (

                <div className="min-h-screen bg-white py-10">
                    {isModalOpen && (
                        <RusheePhotoModal
                            showPreview={showPreview}
                            image={image}
                            webcamRef={webcamRef}
                            onClose={() => {
                                setIsModalOpen(!isModalOpen)
                                setShowPreview(false)
                                setImage(null)
                            }}
                            onRetake={() => setShowPreview(false)}
                            onSave={handlePhotoSubmit}
                            onCapture={capture}
                        />
                    )}
                    <div className="h-16" />
                    <RusheeProfileSummary
                        initialRushee={initialRushee}
                        onEditImage={() => setIsModalOpen(true)}
                    />

                    <div className="mt-8 max-w-4xl mx-auto card-apple">
                        <div className="p-6">
                            <h2 className="text-apple-title1 font-light text-black mb-4">PIS Details</h2>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-apple-gray-100 rounded-apple flex items-center justify-center">
                                    <svg className="w-5 h-5 text-apple-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-apple-footnote text-apple-gray-500 font-light">Scheduled for</p>
                                    <p className="text-apple-body text-black font-normal">
                                        {new Date(parseInt(initialRushee.pis_timeslot.$date.$numberLong)).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <RusheeProfileForm
                        rushee={rushee}
                        onSubmit={handleSubmit}
                        onChange={handleChange}
                    />
                </div>
            )}
        </div>
    );
}
