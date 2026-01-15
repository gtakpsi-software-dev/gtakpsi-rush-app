import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import Badges from "../components/Badge";
import axios from "axios";
import Webcam from "react-webcam";

import Navbar from "../components/Navbar";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Button from "../components/Button";
import { FaRegEdit } from "react-icons/fa";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../js/image_processing";
import { verifyInfo } from "../js/verifications";
import AppDisabledOverlay from "../components/AppDisabledOverlay";
import { useAppDisableCheck } from "../hooks/useAppDisableCheck";

export default function RusheePage() {

    const { gtid, link } = useParams();
    const [rushee, setRushee] = useState(null); // Stores the current state of the rushee
    const [initialRushee, setInitialRushee] = useState(null); // Stores the initial fetched state
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // App disabled state (hook handles admin/bidcom logic)
    const { appDisabled, appDisabledMessage } = useAppDisableCheck();

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
                .get(`${api}/rushee/${gtid}`)
                .then((response) => {
                    if (response.data.status === "success") {
                        const fetchedRushee = response.data.payload;

                        if (fetchedRushee.access_code !== link) {
                            navigate(`/error/${"Incorrect Access Code"}/${"Reach out to the Support Team for assistance"}`);
                        } else {
                            setRushee(fetchedRushee);
                            setInitialRushee(fetchedRushee); // Save the initial state for comparison
                        }
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


    const handlePhotoSubmit = async () => {

        setLoading(true)

        try {
            // Create a unique filename with timestamp
            const fileName = `profile-pictures/${gtid}_${Date.now()}.jpg`;
            const storageRef = ref(storage, fileName);

            // Convert base64 to blob and upload to Firebase Storage
            const blob = base64ToBlob(image);
            await uploadBytes(storageRef, blob);
            
            // Get the download URL
            const imageUrl = await getDownloadURL(storageRef);

            const payload = [
                {
                    "field": "image_url",
                    "new_value": imageUrl,
                }
            ]

            await axios.post(`${api}/rushee/update-rushee/${gtid}`, payload)
                .then((response) => {

                    if (response.data.status == "success") {

                        window.location.reload()

                    } else {

                        toast.error(`${response.data.message}`, {
                            position: "top-center",
                            autoClose: 5000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            progress: undefined,
                            theme: "dark",
                        });

                    }

                })
                .catch((error) => {

                    toast.error(`Some internal network error occurred`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });

                })

        } catch (error) {

            console.error("Error uploading image:", error);
            navigate(`/error/${"Uh Oh! Something Unexpected Occurred.."}/${"There was an error uploading your image to the cloud."}`)
            return;

        }

        setLoading(false)

    }

    // Handle form submission
    const handleSubmit = async (e) => {

        setLoading(true)

        if (
            !rushee.first_name ||
            !rushee.last_name ||
            !rushee.housing ||
            !rushee.phone_number ||
            !rushee.email ||
            !rushee.gtid ||
            !rushee.major ||
            !rushee.class ||
            !rushee.pronouns ||
            rushee.first_name === "" ||
            rushee.last_name === "" ||
            rushee.housing === "" ||
            rushee.phone_number === "" ||
            rushee.email === "" ||
            rushee.gtid === "" ||
            rushee.major === "" ||
            rushee.class === "" ||
            rushee.pronouns === ""
        ) {
            toast.error(`Fields cannot be empty`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            return;
        }

        e.preventDefault();

        if (!rushee || !initialRushee) {
            toast.error(`${"Unable to parse changes"}`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            return;
        }

        // Create a payload with only the changed fields
        const payload = Object.keys(rushee)
            .filter((key) => rushee[key] !== initialRushee[key]) // Compare initial and current state
            .map((key) => ({
                field: key,
                new_value: rushee[key],
            }));

        if (payload.length === 0) {
            toast.info(`${"No changes were made"}`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            return;
        }

        try {

            const checkValidity = await verifyInfo(rushee["gtid"], rushee["email"], rushee["phone_number"], rushee["gtid"] !== initialRushee["gtid"])

            if (checkValidity.status === "error") {

                toast.error(`${checkValidity.message}`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });

                return;

            }

        } catch (err) {
            console.log(err)
            toast.error(`${"Failed to update rushee"}`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
            return;
        }

        try {
            const response = await axios.post(`${api}/rushee/update-rushee/${gtid}`, payload);

            if (response.data.status === "success") {
                window.location.reload(`https://www.gtakpsi-rush.com/rushee/${rushee.gtid}/${link}`)
            } else {
                toast.error(`${response.data.message}`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });
            }

        } catch (err) {
            toast.error(`${err.response?.data?.message || "Failed to update rushee"}`, {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
        }

        setLoading(false)
    };

    // Handle input changes
    const handleChange = (e) => {

        const { name, value } = e.target;
        setRushee({ ...rushee, [name]: value });
    };

    return (
        <div>
            {/* App Disabled Overlay */}
            {appDisabled && (
                <AppDisabledOverlay message={appDisabledMessage} />
            )}

            <Navbar stripped={true} />

            {loading ? (
                <Loader />
            ) : (

                <div className="min-h-screen bg-white py-10">
                    {/* Modal */}
                    {isModalOpen && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="card-apple p-6 max-w-lg w-full mx-4 relative">
                                {/* Header */}
                                <div className="mb-6">
                                    <h2 className="text-apple-title1 font-light text-black text-center">Update Photo</h2>
                                    <div className="w-12 h-0.5 bg-black mx-auto mt-2"></div>
                                </div>

                                {/* Close Button */}
                                <button
                                    onClick={() => {
                                        setIsModalOpen(!isModalOpen)
                                        setShowPreview(false)
                                        setImage(null)
                                    }}
                                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-apple-gray-500 hover:text-black transition-colors duration-200 rounded-apple"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                {/* Camera Container */}
                                <div className="w-80 h-80 bg-apple-gray-50 rounded-apple-2xl overflow-hidden border border-apple-gray-200 flex items-center justify-center mb-6">
                                    {showPreview ? (
                                        <img
                                            src={image}
                                            alt="Captured preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Webcam
                                            ref={webcamRef}
                                            audio={false}
                                            screenshotFormat="image/jpeg"
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-3">
                                    {showPreview ? (
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <button
                                                onClick={() => setShowPreview(false)}
                                                className="btn-apple-secondary px-6 py-3 text-apple-body font-light flex-1"
                                            >
                                                Retake Photo
                                            </button>
                                            <button
                                                onClick={handlePhotoSubmit}
                                                className="btn-apple px-6 py-3 text-apple-body font-light flex-1"
                                            >
                                                Save Photo
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={capture}
                                            className="btn-apple px-8 py-4 text-apple-headline font-light"
                                        >
                                            Take Photo
                                        </button>
                                    )}
                                </div>


                                {/* <h2 className="text-lg font-bold mb-4">Edit Image</h2>
                                <p className="text-sm text-gray-600 mb-6">
                                    Add functionality to upload and change the image here.
                                </p>
                                <button
                                    onClick={() => {
                                        setIsModalOpen(!isModalOpen)
                                    }}
                                    className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
                                >
                                    Close
                                </button> */}

                            </div>
                        </div>
                    )}
                    <div className="h-16" />
                    {/* Rushee Information */}
                    <div className="max-w-4xl mx-auto card-apple">
                        <div className="flex flex-col sm:flex-row items-center space-y-6 sm:space-y-0 sm:space-x-8 p-8">
                            {/* Image with Edit Icon */}
                            <div className="relative flex-shrink-0">
                                <img
                                    src={initialRushee.image_url}
                                    alt={`${initialRushee.first_name} ${initialRushee.last_name}`}
                                    className="w-40 h-40 rounded-apple-2xl object-cover border border-apple-gray-200"
                                />
                                {/* Edit Icon */}
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="absolute top-2 right-2 w-8 h-8 bg-black text-white rounded-apple flex items-center justify-center hover:bg-apple-gray-800 transition-colors duration-200"
                                    aria-label="Edit Image"
                                >
                                    <FaRegEdit className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Rushee Details */}
                            <div className="flex-1 text-center sm:text-left">
                                <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
                                    <h1 className="text-apple-large font-light text-black">
                                        {initialRushee.first_name} {initialRushee.last_name}
                                    </h1>
                                    <div className="flex flex-wrap gap-2">
                                        {initialRushee.attendance.map((event, idx) => (
                                            <Badges text={event.name} key={idx} />
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2 text-apple-body">
                                    <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Pronouns:</span> {initialRushee.pronouns}</p>
                                    <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Major:</span> {initialRushee.major}</p>
                                    <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Email:</span> {initialRushee.email}</p>
                                    <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Phone:</span> {initialRushee.phone_number}</p>
                                    <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Housing:</span> {initialRushee.housing}</p>
                                </div>
                            </div>
                        </div>
                    </div>


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

                    {/* Form Section */}
                    <div className="mt-8 max-w-4xl mx-auto card-apple mb-16">
                        <div className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Row 1: Name */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">First Name</label>
                                        <input
                                            type="text"
                                            name="first_name"
                                            value={rushee.first_name}
                                            onChange={handleChange}
                                            className="input-apple"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Last Name</label>
                                        <input
                                            type="text"
                                            name="last_name"
                                            value={rushee.last_name}
                                            onChange={handleChange}
                                            className="input-apple"
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Contact */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Housing</label>
                                        <input
                                            type="text"
                                            name="housing"
                                            value={rushee.housing}
                                            onChange={handleChange}
                                            className="input-apple"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Phone Number</label>
                                        <input
                                            type="text"
                                            name="phone_number"
                                            value={rushee.phone_number}
                                            onChange={(e) => {
                                                const input = e.target.value.replace(/\D/g, "");
                                                const formatted = input
                                                    .replace(/^(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
                                                    .replace(/^(\d{3})(\d{1,3})$/, "($1) $2")
                                                    .replace(/^(\d{1,3})$/, "($1");
                                                e.target.value = formatted;
                                                handleChange(e)
                                            }}
                                            className="input-apple"
                                        />
                                    </div>
                                </div>

                                {/* Row 3: Academic Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={rushee.email}
                                            onChange={handleChange}
                                            className="input-apple"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">GTID</label>
                                        <input
                                            type="text"
                                            name="gtid"
                                            value={rushee.gtid}
                                            onChange={handleChange}
                                            className="input-apple"
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Major and Class */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Major</label>
                                        <select
                                            name="major"
                                            value={rushee.major}
                                            onChange={handleChange}
                                            className="input-apple"
                                        >
                                            <option>Aerospace Engineering</option>
                                            <option>Applied Languages and Intercultural Studies</option>
                                            <option>Architecture</option>
                                            <option>Biochemistry</option>
                                            <option>Biology</option>
                                            <option>Biomedical Engineering</option>
                                            <option>Business Administration</option>
                                            <option>Chemical and Biomolecular Engineering</option>
                                            <option>Chemistry</option>
                                            <option>Civil Engineering</option>
                                            <option>Computational Media</option>
                                            <option>Computer Engineering</option>
                                            <option>Computer Science</option>
                                            <option>Earth and Atmospheric Sciences</option>
                                            <option>Economics</option>
                                            <option>Economics and International Affairs</option>
                                            <option>Electrical Engineering</option>
                                            <option>Environmental Engineering</option>
                                            <option>Global Economics and Modern Languages</option>
                                            <option>History, Technology, and Society</option>
                                            <option>Industrial Design</option>
                                            <option>Industrial Engineering</option>
                                            <option>International Affairs</option>
                                            <option>International Affairs and Modern Languages</option>
                                            <option>Literature, Media, and Communication</option>
                                            <option>Materials Science and Engineering</option>
                                            <option>Mathematics</option>
                                            <option>Mechanical Engineering</option>
                                            <option>Nuclear and Radiological Engineering</option>
                                            <option>Neuroscience</option>
                                            <option>Physics</option>
                                            <option>Psychology</option>
                                            <option>Public Policy</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Year</label>
                                        <select
                                            name="class"
                                            value={rushee.class}
                                            onChange={handleChange}
                                            className="input-apple"
                                        >
                                            <option>First</option>
                                            <option>Second</option>
                                            <option>Third</option>
                                            <option>Fourth</option>
                                            <option>Fifth+</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Row 5: Pronouns */}
                                <div>
                                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Pronouns</label>
                                    <select
                                        name="pronouns"
                                        value={rushee.pronouns}
                                        onChange={handleChange}
                                        className="input-apple"
                                    >
                                        <option value="">Select pronouns</option>
                                        <option value="he/him">he/him</option>
                                        <option value="she/her">she/her</option>
                                        <option value="they/them">they/them</option>
                                    </select>
                                </div>

                                {/* Submit Button */}
                                <div className="pt-4">
                                    <button
                                        type="submit"
                                        className="btn-apple w-full px-8 py-4 text-apple-headline font-light"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
