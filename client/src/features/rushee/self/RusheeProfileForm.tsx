import type { ChangeEvent, FormEvent } from "react";

/**
 * Profile Form Summary:
 * - Types the stored profile fields and form callbacks consumed here.
 * - Keeps the rendered controls and phone-event mutation unchanged.
 * - Existing markup and event tests pin those behavior contracts.
 */
type RusheeProfileFormProps = {
    rushee: {
        first_name: string;
        last_name: string;
        housing: string;
        phone_number: string;
        email: string;
        gtid: string;
        major: string;
        class: string;
        pronouns: string;
    };
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Housing</label>
                            <input
                                type="text"
                                name="housing"
                                value={rushee.housing}
                                onChange={onChange}
                                className="input-apple"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Phone Number</label>
                            <input
                                type="text"
                                name="phone_number"
                                value={rushee.phone_number}
                                onChange={(e) => {
                                    const input = e.target.value.replace(/\D/g, "");
                                    const formatted = input
                                        .replace(/^(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
                                        .replace(/^(\d{3})(\d{1,3})$/, "($1) $2")
                                        .replace(/^(\d{1,3})$/, "($1");
                                    e.target.value = formatted;
                                    onChange(e)
                                }}
                                className="input-apple"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Email</label>
                            <input
                                type="email"
                                name="email"
                                value={rushee.email}
                                onChange={onChange}
                                className="input-apple"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">GTID</label>
                            <input
                                type="text"
                                name="gtid"
                                value={rushee.gtid}
                                onChange={onChange}
                                className="input-apple"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700">Major</label>
                            <select
                                name="major"
                                value={rushee.major}
                                onChange={onChange}
                                className="input-apple"
                            >
                                <option>Aerospace Engineering</option>
                                <option>Applied Languages and Intercultural Studies</option>
                                <option>Architecture</option>
                                <option>Biochemistry</option>
                                <option>Biology</option>
                                <option>Biomedical Engineering</option>
                                <option>Business Administration</option>
                                <option>Chemical and Biomolecular Engineering</option>
                                <option>Chemistry</option>
                                <option>Civil Engineering</option>
                                <option>Computational Media</option>
                                <option>Computer Engineering</option>
                                <option>Computer Science</option>
                                <option>Earth and Atmospheric Sciences</option>
                                <option>Economics</option>
                                <option>Economics and International Affairs</option>
                                <option>Electrical Engineering</option>
                                <option>Environmental Engineering</option>
                                <option>Global Economics and Modern Languages</option>
                                <option>History, Technology, and Society</option>
                                <option>Industrial Design</option>
                                <option>Industrial Engineering</option>
                                <option>International Affairs</option>
                                <option>International Affairs and Modern Languages</option>
                                <option>Literature, Media, and Communication</option>
                                <option>Materials Science and Engineering</option>
                                <option>Mathematics</option>
                                <option>Mechanical Engineering</option>
                                <option>Nuclear and Radiological Engineering</option>
                                <option>Neuroscience</option>
                                <option>Physics</option>
                                <option>Psychology</option>
                                <option>Public Policy</option>
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
                                <option>First</option>
                                <option>Second</option>
                                <option>Third</option>
                                <option>Fourth</option>
                                <option>Fifth+</option>
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
                            <option value="">Select pronouns</option>
                            <option value="he/him">he/him</option>
                            <option value="she/her">she/her</option>
                            <option value="they/them">they/them</option>
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
