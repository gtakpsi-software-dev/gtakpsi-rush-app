import type { Ref } from "react";

import { formatPhoneInput } from "../../lib/formatPhoneInput.js";

export type BasicContactFieldsProps = {
    email: Ref<HTMLInputElement>;
    housing: Ref<HTMLInputElement>;
    phone: Ref<HTMLInputElement>;
};

export default function BasicContactFields(props: BasicContactFieldsProps) {
    return (
        <>
            <div>
                <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-email">
                    GT Email
                </label>
                <input
                    ref={props.email}
                    className="input-apple"
                    id="grid-email"
                    type="email"
                    placeholder="gburdell3@gatech.edu"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-housing">
                        Housing
                    </label>
                    <input
                        ref={props.housing}
                        className="input-apple"
                        id="grid-housing"
                        type="text"
                        placeholder="Glenn 346"
                    />
                </div>
                <div>
                    <label
                        className="block mb-2 text-apple-footnote font-normal text-apple-gray-700"
                        htmlFor="grid-phone"
                    >
                        Phone Number
                    </label>
                    <input
                        ref={props.phone}
                        className="input-apple"
                        id="grid-phone"
                        type="tel"
                        placeholder="(123) 456-7890"
                        onChange={(e) => {
                            e.target.value = formatPhoneInput(e.target.value);
                        }}
                    />
                </div>
            </div>
        </>
    );
}
