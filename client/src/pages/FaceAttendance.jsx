import { useState, useRef } from "react";

import "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import Loader from "../components/Loader";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { base64ToTensor } from "../lib/imageProcessing";
import FaceAttendanceCameraView from "../features/faceAttendance/FaceAttendanceCameraView";
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
                        <FaceAttendanceCameraView
                            showPreview={showPreview}
                            image={image}
                            webcamRef={webcamRef}
                            onCapture={capture}
                            onRetake={() => {
                                setShowPreview(false);
                            }}
                            onSubmit={handleImageSubmit}
                        />
                    ) : (
                        <div></div>
                    )}
                </div>
            )}
        </div>
    );
}
