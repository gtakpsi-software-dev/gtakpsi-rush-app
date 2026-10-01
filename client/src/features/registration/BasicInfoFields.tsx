import type { Ref } from "react";

import { MAJOR_OPTIONS } from "../../data/majorOptions.js";
import { formatPhoneInput } from "./formatPhoneInput.js";
import { EXPOSURE_OPTIONS } from "./basicInfoOptions.js";

export type BasicInfoFieldsProps = {
    firstname: Ref<HTMLInputElement>;
    lastname: Ref<HTMLInputElement>;
    email: Ref<HTMLInputElement>;
    housing: Ref<HTMLInputElement>;
    phone: Ref<HTMLInputElement>;
    gtid: Ref<HTMLInputElement>;
    major: Ref<HTMLSelectElement>;
    pronouns: Ref<HTMLSelectElement>;
    year: Ref<HTMLSelectElement>;
    exposure: Ref<HTMLSelectElement>;
};

export default function BasicInfoFields(props: BasicInfoFieldsProps) {
    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-first-name">
                        First Name
                    </label>
                    <input
                        ref={props.firstname}
                        className="input-apple"
                        id="grid-first-name"
                        type="text"
                        placeholder="George"
                    />
                </div>
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-last-name">
                        Last Name
                    </label>
                    <input
                        ref={props.lastname}
                        className="input-apple"
                        id="grid-last-name"
                        type="text"
                        placeholder="Burdell"
                    />
                </div>
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-gtid">
                        GTID
                    </label>
                    <input
                        ref={props.gtid}
                        className="input-apple"
                        id="grid-gtid"
                        type="text"
                        placeholder="903753779"
                    />
                </div>
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-major">
                        Major
                    </label>
                    <select
                        ref={props.major}
                        className="input-apple"
                        id="grid-major"
                    >
                        {MAJOR_OPTIONS.map((major) => (
                            <option key={major}>{major}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-pronouns">
                        Pronouns
                    </label>
                    <select
                        ref={props.pronouns}
                        className="input-apple"
                        id="grid-pronouns"
                    >
                        <option value="">Select pronouns</option>
                        <option value="he/him">he/him</option>
                        <option value="she/her">she/her</option>
                        <option value="they/them">they/them</option>
                    </select>
                </div>
                <div>
                    <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-year">
                        Year
                    </label>
                    <select
                        ref={props.year}
                        className="input-apple"
                        id="grid-year"
                    >
                        <option>First</option>
                        <option>Second</option>
                        <option>Third</option>
                        <option>Fourth</option>
                        <option>Fifth+</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-exposure">
                    How did you find us?
                </label>
                <select
                    ref={props.exposure}
                    className="input-apple"
                    id="grid-exposure"
                >
                    {EXPOSURE_OPTIONS.map((source) => (
                        <option key={source}>{source}</option>
                    ))}
                </select>
            </div>
        </>
    );
}
