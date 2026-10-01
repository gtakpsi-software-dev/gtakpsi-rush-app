import { useState, useRef } from "react";
import Webcam from "react-webcam";

import "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import Loader from "../components/Loader";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { base64ToTensor } from "../lib/imageProcessing";
import { createFaceImageSubmit } from "../features/faceAttendance/createFaceImageSubmit";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function FaceAttendance() {
    const [page, setPage] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [image, setImage] = useState();
    const [loading, setLoading] = useState();
    const [, setRushee] = useState();

    const navigate = useNavigate();
    const webcamRef = useRef();

    const api = import.meta.env.VITE_API_PREFIX;

    const capture = () => {
        const screenshot = webcamRef.current.getScreenshot();
        setShowPreview(true);
        setImage(screenshot);
    };

    const handleImageSubmit = createFaceImageSubmit({
        image,
        api,
        loadModel: () => mobilenet.load(),
        base64ToTensor,
        get: (...args) => axios.get(...args),
        navigate,
        setLoading,
        setPage,
        setRushee,
        warn: (...args) => toast.warn(...args),
        log: (value) => console.log(value),
    });

    return (
        <div>
            {loading ? (
                <Loader />
            ) : (
                <div>
                    {page == 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-800 text-white">
                            <h1 className="mb-2 text-left font-bold bg-gradient-to-r from-sky-700 via-amber-600 to-sky-700 animate-text bg-clip-text text-transparent text-4xl">GT AKPsi Rush Check In!</h1>
                            <h1 className="text-slate-500 text-left mb-4">Check in with your face!</h1>

                            <div className="w-96 h-96 bg-gray-800 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
                                {showPreview ? (
                                    <img
                                        src={image}
                                        alt="Captured"
                                        className="w-96 h-96 rounded-lg shadow-md border border-gray-700"
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

                            {showPreview ? (
                                <div className="flex flex-row gap-6">
                                    <button
                                        onClick={() => {
                                            setShowPreview(false);
                                        }}
                                        className="bg-gradient-to-r mt-3 from-sky-700 to-amber-600 hover:from-pink-500 hover:to-green-500 text-white font-bold py-2 px-4 rounded focus:ring transform transition hover:scale-105 duration-300 ease-in-out"
                                    >
                                        Retake Photo
                                    </button>
                                    <button
                                        onClick={handleImageSubmit}
                                        className="bg-gradient-to-r mt-3 from-sky-700 to-amber-600 hover:from-pink-500 hover:to-green-500 text-white font-bold py-2 px-4 rounded focus:ring transform transition hover:scale-105 duration-300 ease-in-out"
                                    >
                                        Submit Photo
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={capture}
                                    className="bg-gradient-to-r mt-3 from-sky-700 to-amber-600 hover:from-pink-500 hover:to-green-500 text-white font-bold py-2 px-4 rounded focus:ring transform transition hover:scale-105 duration-300 ease-in-out"
                                >
                                    Take Photo
                                </button>
                            )}
                        </div>
                    ) : (
                        <div></div>
                    )}
                </div>
            )}
        </div>
    );
}
