import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function MyError(props) {

    const { title, description } = useParams()

    const navigate = useNavigate()

    let titleShown = title ? title : "Something untoward occurred..."
    let descriptionShown = description ? description : "Please try again later or contact support."

    if (props.wrongpage) {

        titleShown = "404"
        descriptionShown = "Sorry! We couldn't find that page."

    }

    return (
        <div className="relative w-full h-screen bg-white flex flex-col items-center justify-center">
            <div className="text-center animate-fade-in">
                {/* Error Icon */}
                <div className="flex items-center justify-center w-24 h-24 bg-apple-gray-100 rounded-apple-2xl border border-apple-gray-200 mb-8 animate-slide-up mx-auto">
                    <svg
                        className="w-12 h-12 text-apple-gray-600"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                    >
                        {props.wrongpage ? (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                            />
                        ) : (
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        )}
                    </svg>
                </div>

                {/* Title */}
                <div className="mb-6 animate-slide-up" style={{animationDelay: '0.1s'}}>
                    <h1 className="text-apple-large font-light text-black mb-2">{titleShown}</h1>
                    <div className="w-16 h-0.5 bg-black mx-auto"></div>
                </div>

                {/* Description */}
                <p className="text-apple-title2 text-apple-gray-600 font-light mb-8 max-w-md mx-auto leading-relaxed animate-slide-up" style={{animationDelay: '0.2s'}}>
                    {descriptionShown}
                </p>

                {/* Button */}
                <div className="animate-slide-up" style={{animationDelay: '0.3s'}}>
                    <button 
                        onClick={() => navigate("/")} 
                        className="btn-apple px-8 py-4 text-apple-headline"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
