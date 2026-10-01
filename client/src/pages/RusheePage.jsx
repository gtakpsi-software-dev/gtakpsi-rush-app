import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Loader from "../components/Loader";
import Badges from "../components/Badge";
import axios from "axios";

import Navbar from "../components/Navbar";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { FaRegEdit } from "react-icons/fa";

import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { base64ToBlob } from "../js/image_processing";
import { verifyInfo } from "../js/verifications";
import { submitProfileChanges } from "../features/rushee/self/submitProfileChanges";
import { submitRusheePhoto } from "../features/rushee/self/submitRusheePhoto";
import RusheePhotoModal from "../features/rushee/self/RusheePhotoModal";

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
