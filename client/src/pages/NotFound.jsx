import { useNavigate } from "react-router-dom";

import { Canvas } from "@react-three/fiber";
import LiquidShader from "../features/notFound/LiquidShader";

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gradient-to-r from-blue-800 via-yellow-00 to-blue-800">
            <Canvas
                camera={{
                    position: [0, 0, 1],
                }}
                className="absolute top-0 left-0 w-full h-full"
            >
                <LiquidShader />
            </Canvas>

            <div className="absolute text-center inset-0 flex flex-col items-center justify-center z-10">
                <div className="flex items-center justify-center w-28 h-28 bg-red-500 rounded-full border-4 border-white">
                    <svg
                        className="w-16 h-16 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </div>

                <h1 className="text-3xl font-bold text-white mt-6 text-center">404</h1>

                <p className="text-lg text-white mt-3 text-center max-w-xl">Sorry, we {"couldn't"} find this page!</p>

                <button onClick={() => {
                    navigate("/");
                }} className="mt-3 px-6 py-3 bg-orange-300 text-white font-semibold rounded-lg shadow-md hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                    Go Back
                </button>
            </div>
        </div>
    );
}
