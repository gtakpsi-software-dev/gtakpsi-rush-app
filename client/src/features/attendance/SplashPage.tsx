import { useState } from "react";
import type { ChangeEvent } from "react";
import { verifyGTID } from "../registration/registrationVerification";
import { useNavigate } from "react-router-dom";

type Props = {
    setGtid: (gtid: string) => void;
    func: () => void;
    gtid?: string;
};

// Render GTID entry with validation and a registration link.
export default function SplashPage(props: Props) {

    const [inputValue, setInputValue] = useState("");
    const [error, setError] = useState("");

    const navigate = useNavigate()

    // Update the entered GTID and show an error when it is invalid.
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        props.setGtid(e.target.value);
        setInputValue(e.target.value)
        if (e.target.value.trim() === "" || !verifyGTID(e.target.value.trim())) {
            setError("Invalid GTID");
        } else {
            setError("");
        }
        console.log(error)
    };

    // React treats the legacy truthy error string as a disabled button.
    const disableSubmit = (!inputValue.trim() || error) as boolean;

    return (
        <div className="min-h-screen w-full bg-white flex items-center justify-center p-4">
            <svg 
                className="absolute inset-0 w-full h-full"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid slice"
            >
                <defs>
                    <pattern 
                        id="geometricPattern" 
                        x="0" 
                        y="0" 
                        width="100" 
                        height="100" 
                        patternUnits="userSpaceOnUse"
                    >
                        <rect width="100" height="100" fill="#fafafa"/>
                        <circle cx="50" cy="50" r="30" fill="none" stroke="#f5f5f5" strokeWidth="1"/>
                        <circle cx="50" cy="50" r="15" fill="none" stroke="#f0f0f0" strokeWidth="0.5"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#geometricPattern)"/>
            </svg>

            <div className="relative z-10 text-center max-w-md w-full">
                <button 
                    onClick={/* Open the rushee registration page. */ () => navigate("/register")}
                    className="inline-flex items-center gap-2 py-2 px-4 mb-8 text-apple-footnote text-apple-gray-600 bg-apple-gray-100 hover:bg-apple-gray-200 rounded-apple-2xl transition-all duration-200 font-light"
                >
                    <span>{"Don't"} have an account? Create one now</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                <div className="mb-6">
                    <img 
                        src="/akpsilogo.png" 
                        alt="AKPsi Logo" 
                        className="h-40 w-40 mx-auto"
                    />
                </div>

                <h1 className="text-apple-large md:text-6xl text-black font-light mb-2">
                    GT AKPsi Rush
                </h1>
     
                <p className="text-apple-title2 text-apple-gray-600 font-light mb-8">
                    Check In
                </p>

                <div className="space-y-4">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        className={`input-apple w-full text-apple-body ${error ? "border-red-500 focus:ring-red-500" : ""}`}
                        placeholder="Enter your GTID"
                    />
                    
                    <button
                        onClick={props.func}
                        disabled={disableSubmit}
                        className={`w-full py-4 px-6 text-apple-headline font-light rounded-apple-xl transition-all duration-200 ${
                            inputValue.trim() && !error
                                ? 'bg-black text-white hover:bg-apple-gray-800'
                                : 'bg-apple-gray-200 text-apple-gray-400 cursor-not-allowed'
                        }`}
                    >
                        Check In
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-apple text-red-700 text-apple-footnote font-light">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
