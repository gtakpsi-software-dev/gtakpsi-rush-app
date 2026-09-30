import dayjs from "dayjs";

type PisResponse = { question: string; answer: string };

type RusheePisDetailsProps = {
    rushee: {
        pis_timeslot: { $date: { $numberLong: string } };
        pis_signup: {
            first_brother_first_name: string;
            first_brother_last_name: string;
            second_brother_first_name: string;
            second_brother_last_name: string;
        };
        pis: PisResponse[];
    };
    setSelectedPis: (pis: PisResponse) => void;
};

export default function RusheePisDetails({ rushee, setSelectedPis }: RusheePisDetailsProps) {
    return (
        <div className="card-apple p-6 mb-6 max-h-[40rem] overflow-y-auto">
            <h2 className="text-apple-title1 font-light text-black mb-4">PIS Details</h2>

            <div className="space-y-3 mb-6 text-apple-body">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🕒</span>
                    <span className="text-apple-gray-600 font-light">
                        <span className="text-black font-normal">Timeslot:</span>{" "}
                        {dayjs(parseInt(rushee.pis_timeslot.$date.$numberLong)).format('ddd, DD MMM YYYY h:mm A')}
                    </span>
                </div>
                <p className="text-apple-gray-600 font-light">
                    <span className="text-black font-normal">Brother 1:</span> {rushee.pis_signup.first_brother_first_name} {rushee.pis_signup.first_brother_last_name}
                </p>
                <p className="text-apple-gray-600 font-light">
                    <span className="text-black font-normal">Brother 2:</span> {rushee.pis_signup.second_brother_first_name} {rushee.pis_signup.second_brother_last_name}
                </p>
            </div>

            <div className="border-t border-apple-gray-200 pt-6">
                <h3 className="text-apple-title2 font-normal text-black mb-4">PIS Responses</h3>
                <div className="space-y-4">
                    {rushee.pis.map((pis, idx) => (
                        <div
                            key={idx}
                            className="bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple hover:bg-apple-gray-100 cursor-pointer transition-all duration-200"
                            onClick={() => setSelectedPis(pis)}
                        >
                            <p className="text-apple-body text-black font-light mb-2">
                                <span className="font-normal text-apple-gray-700">Q:</span> {pis.question}
                            </p>
                            <p className="text-apple-body text-black font-light">
                                <span className="font-normal text-apple-gray-700">A:</span> {pis.answer}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
