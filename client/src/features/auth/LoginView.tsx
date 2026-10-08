import type { KeyboardEventHandler, MouseEventHandler, RefObject } from "react";
import { Link } from "react-router-dom";

import Loader from "../../components/Loader";
import Navbar from "../../components/Navbar";
import AuthEmailField from "./AuthEmailField";

type LoginViewProps = {
    loading: boolean;
    email: RefObject<HTMLInputElement>;
    password: RefObject<HTMLInputElement>;
    handleLogin: MouseEventHandler<HTMLButtonElement>;
    handleKeyPress: KeyboardEventHandler<HTMLInputElement>;
};

// Render the login form or its initial loading indicator.
export default function LoginView(props: LoginViewProps) {
    return (
        <div className="bg-white min-h-screen">
            <Navbar />
            {props.loading ? (
                <Loader />
            ) : (
                <div className="animate-fade-in">
                    <div className="text-left">
                        <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
                            <a href="#" className="flex items-center mb-8 animate-slide-up">
                                <img className="w-20 h-20 mr-3" src="akpsilogo.png" alt="logo" />
                            </a>
                            <div className="w-96 card-apple animate-slide-up" style={{ animationDelay: "0.1s" }}>
                                <div className="p-8 space-y-6">
                                    <div className="text-center">
                                        <h1 className="text-apple-title1 font-light text-black mb-2">
                                            Welcome Back
                                        </h1>
                                        <p className="text-apple-subheadline text-apple-gray-600">
                                            Sign in to your account
                                        </p>
                                    </div>
                                    <div className="space-y-5">
                                        <AuthEmailField
                                            email={props.email}
                                            handleKeyPress={props.handleKeyPress}
                                        />
                                        <div>
                                            <label
                                                htmlFor="password"
                                                className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                                            >
                                                Password
                                            </label>
                                            <input
                                                ref={props.password}
                                                type="password"
                                                name="password"
                                                id="password"
                                                placeholder="Enter your password"
                                                className="input-apple"
                                                onKeyPress={props.handleKeyPress}
                                                required
                                            />
                                        </div>
                                        <div className="flex items-center justify-end">
                                            <Link to="/forgot-password">
                                                <p className="text-apple-footnote font-normal text-black hover:text-apple-gray-600 transition-colors duration-200">
                                                    Forgot Password?
                                                </p>
                                            </Link>
                                        </div>
                                        <button
                                            onClick={props.handleLogin}
                                            className="btn-apple w-full"
                                        >
                                            Sign In
                                        </button>

                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-apple-gray-200"></div>
                                            </div>
                                            <div className="relative flex justify-center text-sm">
                                                <span className="px-4 bg-white text-apple-gray-500">or</span>
                                            </div>
                                        </div>

                                        <Link to="/create-account" className="mt-2 block">
                                            <button className="btn-apple-secondary w-full">
                                                Create Account
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
