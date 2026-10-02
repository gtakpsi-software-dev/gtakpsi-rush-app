import type { KeyboardEventHandler, Ref } from "react";

type AuthEmailFieldProps = {
    email: Ref<HTMLInputElement>;
    handleKeyPress: KeyboardEventHandler<HTMLInputElement>;
};

export default function AuthEmailField({ email, handleKeyPress }: AuthEmailFieldProps) {
    return (
        <div>
            <label
                htmlFor="email"
                className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
            >
                Email Address
            </label>
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
    );
}
