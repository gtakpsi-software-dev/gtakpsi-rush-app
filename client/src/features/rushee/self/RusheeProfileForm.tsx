import type { ChangeEvent, FormEvent } from "react";
import { MAJOR_OPTIONS } from "../../../data/majorOptions.js";
import { PRONOUN_OPTIONS, YEAR_OPTIONS } from "../../../data/profileOptions.js";
import RusheeProfileContactFields, {
    type RusheeContactProfile,
} from "./RusheeProfileContactFields";

type RusheeProfileFormProps = {
    rushee: RusheeContactProfile & {
        first_name: string;
        last_name: string;
        major: string;
        class: string;
        pronouns: string;
    };
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

// Render the editable rushee profile and its Save Changes action.
export default function RusheeProfileForm({ rushee, onSubmit, onChange }: RusheeProfileFormProps) {
    return (
        <div className="mt-8 max-w-4xl mx-auto card-apple mb-16">
            <div className="p-8">
                <form onSubmit={onSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">First Name</label>
                            <input
                                type="text"
                                name="first_name"
                                value={rushee.first_name}
                                onChange={onChange}
                                className="input-apple"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Last Name</label>
                            <input
                                type="text"
                                name="last_name"
                                value={rushee.last_name}
                                onChange={onChange}
                                className="input-apple"
                            />
                        </div>
                    </div>

                    <RusheeProfileContactFields rushee={rushee} onChange={onChange} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Major</label>
                            <select
                                name="major"
                                value={rushee.major}
                                onChange={onChange}
                                className="input-apple"
                            >
                                {MAJOR_OPTIONS.map(/* Render a major option. */ (major) => (
                                    <option key={major}>{major}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Year</label>
                            <select
                                name="class"
                                value={rushee.class}
                                onChange={onChange}
                                className="input-apple"
                            >
                                {YEAR_OPTIONS.map(/* Render a class-year option. */ (year) => (
                                    <option key={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Pronouns</label>
                        <select
                            name="pronouns"
                            value={rushee.pronouns}
                            onChange={onChange}
                            className="input-apple"
                        >
                            {PRONOUN_OPTIONS.map(/* Render a pronoun option with its stored value. */ ({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="btn-apple w-full px-8 py-4 text-apple-headline font-light"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
