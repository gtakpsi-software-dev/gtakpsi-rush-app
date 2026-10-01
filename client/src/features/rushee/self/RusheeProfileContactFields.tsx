import type { ChangeEvent } from "react";

export type RusheeContactProfile = {
    housing: string;
    phone_number: string;
    email: string;
    gtid: string;
};

type RusheeProfileContactFieldsProps = {
    rushee: RusheeContactProfile;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function RusheeProfileContactFields({
    rushee,
    onChange,
}: RusheeProfileContactFieldsProps) {
    return (
        <>
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
                            onChange(e);
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
        </>
    );
}
