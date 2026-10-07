import Badges from "../../components/Badge";

type Props = {
    rushee: {
        image_url: string;
        first_name: string;
        last_name: string;
        attendance: { name: string }[];
        pronouns: string;
        major: string;
        email: string;
        phone_number: string;
        housing: string;
        gtid: string;
    };
};

export default function PisProfileHeader({ rushee }: Props) {
    return (
        <div className="card-apple p-6 mb-6">
            <div className="flex flex-col md:flex-row items-start gap-6">
                <img
                    src={rushee.image_url}
                    alt={`${rushee.first_name} ${rushee.last_name}`}
                    className="w-60 h-60 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                />
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                        <h1 className="text-apple-large font-light text-black">
                            {rushee.first_name} {rushee.last_name}
                        </h1>
                        <div className="flex flex-wrap gap-2">
                            {rushee.attendance.map((event, idx) => (
                                <Badges text={event.name} key={idx} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 text-apple-body">
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                        </p>
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">Major:</span> {rushee.major}
                        </p>
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">Email:</span> {rushee.email}
                        </p>
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">Phone:</span> {rushee.phone_number}
                        </p>
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">Housing:</span> {rushee.housing}
                        </p>
                        <p className="text-apple-gray-600 font-light">
                            <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
