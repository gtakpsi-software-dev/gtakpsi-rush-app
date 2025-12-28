import React, { useState, useRef } from "react";
import { Link } from 'react-router-dom'

import { resetPassword } from "../js/user";
import Navbar from "../components/Navbar";

export default function ForgotPassword() {
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    
    const email = useRef();

    const handleResetPassword = async () => {
        if (!email.current?.value) {
            return;
        }

        setLoading(true);

        const success = await resetPassword(email.current?.value);

        setLoading(false);

        if (success) {
            setEmailSent(true);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleResetPassword();
        }
    };

    return (
        <div className="bg-white min-h-screen">
            <Navbar/>
            <div className="animate-fade-in">
                <div className="text-left">
                    <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
                        <a href="#" className="flex items-center mb-8 animate-slide-up">
                            <img className="w-20 h-20 mr-3" src="akpsilogo.png" alt="logo"/>
                        </a>
                        <div className="w-96 card-apple animate-slide-up" style={{animationDelay: '0.1s'}}>
                            <div className="p-8 space-y-6">
                                {emailSent ? (
                                    // Success State
                                    <div className="text-center space-y-4">
                                        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        <h1 className="text-apple-title1 font-light text-black">
                                            Check Your Email
                                        </h1>
                                        <p className="text-apple-subheadline text-apple-gray-600">
                                            We've sent a password reset link to <span className="font-medium text-black">{email.current?.value}</span>
                                        </p>
                                        <p className="text-apple-footnote text-apple-gray-500">
                                            Didn't receive the email? Check your spam folder or try again.
                                        </p>
                                        <div className="pt-6 space-y-4">
                                            <button 
                                                onClick={() => setEmailSent(false)}
                                                className="btn-apple-secondary w-full"
                                            >
                                                Try Again
                                            </button>
                                            <Link to='/login' className="block">
                                                <button className="btn-apple w-full">
                                                    Back to Sign In
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    // Form State
                                    <>
                                        <div className="text-center">
                                            <h1 className="text-apple-title1 font-light text-black mb-2">
                                                Reset Password
                                            </h1>
                                            <p className="text-apple-subheadline text-apple-gray-600">
                                                Enter your email and we'll send you a reset link
                                            </p>
                                        </div>
                                        <div className="space-y-5">
                                            <div>
                                                <label htmlFor="email" className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Email Address</label>
                                                <input 
                                                    ref={email} 
                                                    type="email" 
                                                    name="email" 
                                                    id="email" 
                                                    className="input-apple" 
                                                    placeholder="name@example.com"
                                                    onKeyPress={handleKeyPress}
                                                    required
                                                />
                                            </div>
                                            <button 
                                                onClick={handleResetPassword}
                                                disabled={loading}
                                                className="btn-apple w-full disabled:opacity-50"
                                            >
                                                {loading ? 'Sending...' : 'Send Reset Link'}
                                            </button>
                                            
                                            {/* Back to Login */}
                                            <div className="text-center pt-2">
                                                <Link to='/login' className="text-apple-footnote text-black font-medium hover:text-apple-gray-600 transition-colors duration-200">
                                                    ← Back to Sign In
                                                </Link>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

