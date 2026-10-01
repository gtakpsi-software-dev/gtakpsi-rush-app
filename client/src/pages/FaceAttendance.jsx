import { useState, useRef } from "react";
import Webcam from "react-webcam";

import "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import Loader from "../components/Loader";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { base64ToTensor } from "../js/image_processing";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Face Attendance Summary:
 * - Removes unused bindings while retaining the model module load and state order.
 * - Keeps camera, preview, lookup, and error paths unchanged.
 */
export default function FaceAttendance() {

    const [page, setPage] = useState(0)
    const [showPreview, setShowPreview] = useState(false)
    const [image, setImage] = useState()
    const [loading, setLoading] = useState()

    const [, setRushee] = useState()

    const navigate = useNavigate()

    const webcamRef = useRef()

    const api = import.meta.env.VITE_API_PREFIX;

    const capture = () => {
        const screenshot = webcamRef.current.getScreenshot();
        setShowPreview(true)
        setImage(screenshot);
    };

    const handleImageSubmit = async () => {

        setLoading(true)

        let vector;

        try {

            // Load the model
            const model = await mobilenet.load();

            // Convert the base64 image to a tensor
            const tensor = await base64ToTensor(image, model);

            // Perform inference to get embeddings
            const embeddings = model.infer(tensor, "conv_preds");

            // Convert embeddings to a 1D array
            vector = Array.from(embeddings.dataSync()); // This ensures a flat array
            console.log(typeof vector);

        } catch (err) {

            console.log(err)

            const errorTitle = "Couldn't Process your Face"
            const errorDescription = "While vectorizing your face, there was an issue."

            navigate(`/error/${errorTitle}/${errorDescription}`)
            return;

        }

        await axios.get(`${api}/rushee/get-rushee-face`, vector)
            .then((response) => {

                if (response.data.status === "success") {

                    setPage(1)
                    setRushee(response.data.payload)
                    console.log(response.data.payload)

                } else {

                    toast.warn(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: false,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "colored",
                    });

                }

            })
            .catch((error) => {

                console.log(error)

                toast.warn(`Some internal error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: false,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "colored",
                });

            })

        setLoading(false)

    }

    return (
        <div>
            {loading ? <Loader /> : <div>

                {page == 0 ? <div className="flex flex-col items-center justify-center min-h-screen bg-slate-800 text-white">
                    <h1 className="mb-2 text-left font-bold bg-gradient-to-r from-sky-700 via-amber-600 to-sky-700 animate-text bg-clip-text text-transparent text-4xl">GT AKPsi Rush Check In!</h1>
                    <h1 className="text-slate-500 text-left mb-4">Check in with your face!</h1>

                    <div className="w-96 h-96 bg-gray-800 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
                        {showPreview ? <img
                            src={image}
                            alt="Captured"
                            className="w-96 h-96 rounded-lg shadow-md border border-gray-700"
                        /> : <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                        />}
                    </div>


                    {showPreview ? <div className="flex flex-row gap-6">
                        <button
                            onClick={() => {
                                setShowPreview(false)
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
                    </div> : <button
                        onClick={capture}
                        className="bg-gradient-to-r mt-3 from-sky-700 to-amber-600 hover:from-pink-500 hover:to-green-500 text-white font-bold py-2 px-4 rounded focus:ring transform transition hover:scale-105 duration-300 ease-in-out"
                    >
                        Take Photo
                    </button>}
                </div> : <div></div>}

            </div>}
        </div>
    )

}
