import Badges from "../../components/Badge";

type Rushee = {
    image_url?: string;
    name?: string;
    attendance?: { name: string }[];
    pronouns?: string;
    email?: string;
    major?: string;
    class?: string;
    gtid?: string;
};

type Props = {
    rushee: Rushee;
    formattedTime: string;
    relativeTime: { text: string; color: string } | null;
    onView: () => void;
};

export default function PisAppointmentCard({ rushee, formattedTime, relativeTime, onView }: Props) {
    return (
        <div className="card-apple overflow-hidden">
            <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                    <img
                        src={rushee.image_url}
                        alt={rushee.name}
                        className="w-40 h-40 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                    />

                    <div className="flex-1">
                        <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                            <h2 className="text-apple-title1 font-light text-black">
                                {rushee.name}
                            </h2>
                            <div className="flex flex-wrap gap-1">
                                {rushee.attendance?.map((event, idx) => (
                                    <Badges text={event.name} key={idx} />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-apple-body">
                            {rushee.pronouns && (
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                                </p>
                            )}
                            <p className="text-apple-gray-600 font-light">
                                <span className="text-black font-normal">Email:</span> {rushee.email}
                            </p>
                            <p className="text-apple-gray-600 font-light">
                                <span className="text-black font-normal">Major:</span> {rushee.major}
                            </p>
                            <p className="text-apple-gray-600 font-light">
                                <span className="text-black font-normal">Class:</span> {rushee.class}
                            </p>
                            <p className="text-apple-gray-600 font-light">
                                <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-apple-gray-50 border-t border-apple-gray-200 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-apple border border-apple-gray-200 flex items-center justify-center">
                        <span className="text-lg">🕐</span>
                    </div>
                    <div>
                        <p className="text-apple-body text-black font-normal">
                            {formattedTime}
                        </p>
                        {relativeTime && (
                            <p className={`text-apple-footnote font-light ${relativeTime.color}`}>
                                {relativeTime.text}
                            </p>
                        )}
                    </div>
                </div>

                <button
                    onClick={onView}
                    className="btn-apple px-5 py-2.5 text-apple-footnote font-light"
                >
                    View Full Profile →
                </button>
            </div>
        </div>
    );
}
