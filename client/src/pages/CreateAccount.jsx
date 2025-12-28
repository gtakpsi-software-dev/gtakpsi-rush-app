import React, { useState, useRef } from "react";
import { Link, useNavigate } from 'react-router-dom'
import { toast } from "react-toastify";

import { createAccount } from "../js/user";
import Navbar from "../components/Navbar";

export default function CreateAccount() {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const firstName = useRef();
    const lastName = useRef();
    const email = useRef();
    const password = useRef();
    const confirmPassword = useRef();

    const handleCreateAccount = async () => {
        // Validation
        if (!firstName.current?.value || !lastName.current?.value) {
            toast.error('Please enter your first and last name', {
                position: "top-center",
                autoClose: 5000,
                theme: "dark",
            });
            return;
        }

        if (!email.current?.value) {
            toast.error('Please enter your email', {
                position: "top-center",
                autoClose: 5000,
                theme: "dark",
            });
            return;
        }

        if (!password.current?.value) {
            toast.error('Please enter a password', {
                position: "top-center",
                autoClose: 5000,
                theme: "dark",
            });
            return;
        }

        if (password.current?.value !== confirmPassword.current?.value) {
            toast.error('Passwords do not match', {
                position: "top-center",
                autoClose: 5000,
                theme: "dark",
            });
            return;
        }

        if (password.current?.value.length < 6) {
            toast.error('Password must be at least 6 characters', {
                position: "top-center",
                autoClose: 5000,
                theme: "dark",
            });
            return;
        }

        setLoading(true);

        const success = await createAccount({
            firstName: firstName.current?.value,
            lastName: lastName.current?.value,
            email: email.current?.value,
            pwd: password.current?.value,
        });

        setLoading(false);

        if (success) {
            navigate('/dashboard');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleCreateAccount();
        }
    };

    return (
        <div className="bg-white min-h-screen">
            <Navbar/>
            <div className="animate-fade-in">
                <div className="text-left">
                    <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
                        <a href="#" className="flex items-center mb-8 animate-slide-up">
                            <img className="w-20 h-20 mr-3" src="akpsilogo.png" alt="logo"/>
                        </a>
                        <div className="w-96 card-apple animate-slide-up" style={{animationDelay: '0.1s'}}>
                            <div className="p-8 space-y-6">
                                <div className="text-center">
                                    <h1 className="text-apple-title1 font-light text-black mb-2">
                                        Create Account
                                    </h1>
                                    <p className="text-apple-subheadline text-apple-gray-600">
                                        For GT AKPsi Brothers Only
                                    </p>
                                    <p className="text-apple-caption2 text-apple-gray-400 mt-1">
                                        Use your registered brother email
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="firstName" className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">First Name</label>
                                            <input 
                                                ref={firstName} 
                                                type="text" 
                                                name="firstName" 
                                                id="firstName" 
                                                className="input-apple" 
                                                placeholder="John"
                                                onKeyPress={handleKeyPress}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="lastName" className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Last Name</label>
                                            <input 
                                                ref={lastName} 
                                                type="text" 
                                                name="lastName" 
                                                id="lastName" 
                                                className="input-apple" 
                                                placeholder="Doe"
                                                onKeyPress={handleKeyPress}
                                                required
                                            />
                                        </div>
                                    </div>
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
                                    <div>
                                        <label htmlFor="password" className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Password</label>
                                        <input 
                                            ref={password} 
                                            type="password" 
                                            name="password" 
                                            id="password" 
                                            placeholder="At least 6 characters" 
                                            className="input-apple"
                                            onKeyPress={handleKeyPress}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="confirmPassword" className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Confirm Password</label>
                                        <input 
                                            ref={confirmPassword} 
                                            type="password" 
                                            name="confirmPassword" 
                                            id="confirmPassword" 
                                            placeholder="Re-enter your password" 
                                            className="input-apple"
                                            onKeyPress={handleKeyPress}
                                            required
                                        />
                                    </div>
                                    <button 
                                        onClick={handleCreateAccount}
                                        disabled={loading}
                                        className="btn-apple w-full disabled:opacity-50"
                                    >
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </button>
                                    
                                    {/* Back to Login */}
                                    <div className="text-center pt-2">
                                        <p className="text-apple-footnote text-apple-gray-600">
                                            Already have an account?{' '}
                                            <Link to='/login' className="text-black font-medium hover:text-apple-gray-600 transition-colors duration-200">
                                                Sign In
                                            </Link>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

