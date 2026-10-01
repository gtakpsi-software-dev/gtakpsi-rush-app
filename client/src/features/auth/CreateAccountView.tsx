import type { KeyboardEventHandler, MouseEventHandler, Ref } from "react";
import { Link } from "react-router-dom";

import Navbar from "../../components/Navbar";

type CreateAccountViewProps = {
    firstName: Ref<HTMLInputElement>;
    lastName: Ref<HTMLInputElement>;
    email: Ref<HTMLInputElement>;
    password: Ref<HTMLInputElement>;
    confirmPassword: Ref<HTMLInputElement>;
    loading: boolean;
    handleCreateAccount: MouseEventHandler<HTMLButtonElement>;
    handleKeyPress: KeyboardEventHandler<HTMLInputElement>;
};

export default function CreateAccountView(props: CreateAccountViewProps) {
    return (
        <div className="bg-white min-h-screen">
            <Navbar />
            <div className="animate-fade-in">
                <div className="text-left">
                    <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-screen lg:py-0">
                        <a href="#" className="flex items-center mb-8 animate-slide-up">
                            <img className="w-20 h-20 mr-3" src="akpsilogo.png" alt="logo" />
                        </a>
                        <div className="w-96 card-apple animate-slide-up" style={{ animationDelay: "0.1s" }}>
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
                                            <label
                                                htmlFor="firstName"
                                                className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                                            >
                                                First Name
                                            </label>
                                            <input
                                                ref={props.firstName}
                                                type="text"
                                                name="firstName"
                                                id="firstName"
                                                className="input-apple"
                                                placeholder="John"
                                                onKeyPress={props.handleKeyPress}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label
                                                htmlFor="lastName"
                                                className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                                            >
                                                Last Name
                                            </label>
                                            <input
                                                ref={props.lastName}
                                                type="text"
                                                name="lastName"
                                                id="lastName"
                                                className="input-apple"
                                                placeholder="Doe"
                                                onKeyPress={props.handleKeyPress}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="email"
                                            className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                                        >
                                            Email Address
                                        </label>
                                        <input
                                            ref={props.email}
                                            type="email"
                                            name="email"
                                            id="email"
                                            className="input-apple"
                                            placeholder="name@example.com"
                                            onKeyPress={props.handleKeyPress}
                                            required
                                        />
                                    </div>
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
                                            placeholder="At least 6 characters"
                                            className="input-apple"
                                            onKeyPress={props.handleKeyPress}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="confirmPassword"
                                            className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                                        >
                                            Confirm Password
                                        </label>
                                        <input
                                            ref={props.confirmPassword}
                                            type="password"
                                            name="confirmPassword"
                                            id="confirmPassword"
                                            placeholder="Re-enter your password"
                                            className="input-apple"
                                            onKeyPress={props.handleKeyPress}
                                            required
                                        />
                                    </div>
                                    <button
                                        onClick={props.handleCreateAccount}
                                        disabled={props.loading}
                                        className="btn-apple w-full disabled:opacity-50"
                                    >
                                        {props.loading ? "Creating Account..." : "Create Account"}
                                    </button>

                                    <div className="text-center pt-2">
                                        <p className="text-apple-footnote text-apple-gray-600">
                                            Already have an account?{" "}
                                            <Link
                                                to="/login"
                                                className="text-black font-medium hover:text-apple-gray-600 transition-colors duration-200"
                                            >
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
