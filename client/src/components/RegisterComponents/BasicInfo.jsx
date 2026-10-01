import { formatPhoneInput } from "../../features/registration/formatPhoneInput.js";

export default function BasicInfo(props) {

    return (
        <div className="mt-24 p-4 max-w-4xl mx-auto">
            <div className="text-center mb-8 animate-slide-up">
                <h1 className="mb-3 text-apple-large font-light text-black">
                    Basic Information
                </h1>
                <div className="w-16 h-0.5 bg-black mx-auto mb-4"></div>
                <p className="text-apple-subheadline text-apple-gray-600 font-light">
                    Let's get some basic information about you to get started
                </p>
            </div>
            <div className="card-apple animate-slide-up mb-16" style={{animationDelay: '0.1s'}}>
                <form className="p-8 space-y-6">
                    {/* Row 1: First and Last Name */}
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

                    {/* Row 2: Email */}
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

                    {/* Row 3: Housing and Phone */}
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

                    {/* Row 4: GTID and Major */}
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
                    </div>

                    {/* Row 5: Pronouns and Year */}
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

                    {/* Row 6: Exposure */}
                    <div>
                        <label className="block mb-2 text-apple-footnote font-normal text-apple-gray-700" htmlFor="grid-exposure">
                            How did you find us?
                        </label>
                        <select
                            ref={props.exposure}
                            className="input-apple"
                            id="grid-exposure"
                        >
                            <option>Friend or relative in GT AKPsi</option>
                            <option>Friend or relative NOT in GT AKPsi</option>
                            <option>Instagram Account</option>
                            <option>Instagram Ad</option>
                            <option>GT 1000/2000 Advertisement</option>
                            <option>Email Newsletter</option>
                            <option>Canvas Announcement</option>
                            <option>TikTok</option>
                            <option>LinkedIn</option>
                            <option>Reddit</option>
                            <option>Email</option>
                            <option>Flyer Found on Campus</option>
                            <option>Via Another Organization</option>
                            <option>AKPsi Website/Online Search</option>
                            <option>Virtual Information Session</option>
                            <option>Resume Blitz</option>
                            <option>Fall Org Fair</option>
                            <option>Interest Night</option>
                            <option>Scheller Org Fair</option>
                            <option>Tabling Event</option>
                        </select>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={props.func}
                            className="btn-apple px-8 py-4 text-apple-headline"
                            type="button"
                        >
                            Continue
                        </button>
                    </div>
                </form>
            </div>
        </div>

    )

}
