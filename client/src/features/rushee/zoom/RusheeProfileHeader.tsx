import Badges from "../../../components/Badge";

type RusheeProfile = {
    image_url: string;
    first_name: string;
    last_name: string;
    pronouns: string;
    email: string;
    major: string;
    class: string;
    housing: string;
    gtid: string;
    attendance: { name: string }[];
};

type RusheeProfileHeaderProps = {
    rushee: RusheeProfile;
    isBidCommitteeMode: () => boolean;
    getRusheeNumber: () => string;
};

export default function RusheeProfileHeader({ rushee, isBidCommitteeMode, getRusheeNumber }: RusheeProfileHeaderProps) {
    return (
        <div className="card-apple p-6 mb-6">
            <div className="flex flex-col md:flex-row items-start gap-6">
                {isBidCommitteeMode() ? (
                    <div className="w-60 h-60 bg-apple-gray-100 rounded-apple-2xl border border-apple-gray-200 flex items-center justify-center shrink-0">
                        <span className="text-6xl font-light text-black">
                            {getRusheeNumber()}
                        </span>
                    </div>
                ) : (
                    <img
                        src={rushee.image_url}
                        alt={`${rushee.first_name} ${rushee.last_name}`}
                        className="w-60 h-60 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                    />
                )}
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                        {isBidCommitteeMode() ? (
                            <h1 className="text-apple-large font-light text-black">
                                Rushee #{getRusheeNumber()}
                            </h1>
                        ) : (
                            <h1 className="text-apple-large font-light text-black">
                                {rushee.first_name} {rushee.last_name}
                            </h1>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {rushee.attendance.map((event, idx) => (
                                <Badges text={event.name} key={idx} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 text-apple-body">
                        {!isBidCommitteeMode() && (
                            <>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Email:</span> {rushee.email}
                                </p>
                            </>
                        )}
                        {!isBidCommitteeMode() && (
                            <>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Major:</span> {rushee.major}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Class:</span> {rushee.class}
                                </p>
                            </>
                        )}
                        {!isBidCommitteeMode() && (
                            <p className="text-apple-gray-600 font-light">
                                <span className="text-black font-normal">Housing:</span> {rushee.housing}
                            </p>
                        )}
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
