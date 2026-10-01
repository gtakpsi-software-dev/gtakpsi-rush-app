import { TypeAnimation } from "react-type-animation";

import Button from "../components/Button";
import { useNavigate } from "react-router-dom";

export default function OldHome() {

    const navigate = useNavigate()

    return (
        <div
            className="w-full h-screen bg-slate-800 flex items-center justify-center"
            style={{
                backgroundImage: "url('backgrounds/home.jpg')",
                backgroundSize: "cover", // Ensures the image covers the entire div
                backgroundPosition: "center", // Centers the image
                backgroundRepeat: "no-repeat", // Prevents tiling
            }}
        >
            <div className="text-center">
                <p onClick={() => {
                    navigate("/login")
                }} class="cursor-pointer inline-flex justify-between items-center py-1 px-1 pe-4 mb-7 text-sm text-black bg-blue-300 hover:bg-blue-100 rounded-full ">
                    <span class="ml-3 text-sm font-medium">Are you a current brother? Go to brother login</span>
                    <svg class="w-2.5 h-2.5 ms-2 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4" />
                    </svg>
                </p>
                <h1 className="text-6xl text-white font-extrabold mb-8">
                    Welcome to AKPsi Rush
                </h1>
                <TypeAnimation
                    sequence={[
                        "Find your community",
                        5000,
                        "Find your brotherhood",
                        5000,
                        "Find your friends",
                        5000,
                        "Find your belonging",
                        5000,
                    ]}
                    wrapper="span"
                    speed={50}
                    className="text-2xl text-gray-200 font-medium"
                    repeat={Infinity}
                />

                <div className="mt-12 space-x-4">
                    <button onClick={() => {
                        navigate('/register')
                    }} className="px-6 py-3 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        Register for Rush
                    </button>
                    <button onClick={() => {
                        window.location.href = 'https://gtakpsi.com/rush'
                    }} className="px-6 py-3 bg-orange-300 text-white font-semibold rounded-lg shadow-md hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                        Learn More
                    </button>
                </div>

            </div>
        </div>
    );
}
