import Badges from "../../../components/Badge";
import { FaRegEdit } from "react-icons/fa";

type Rushee = {
    image_url: string;
    first_name: string;
    last_name: string;
    attendance: { name: string }[];
    pronouns: string;
    major: string;
    email: string;
    phone_number: string;
    housing: string;
};

type Props = {
    initialRushee: Rushee;
    onEditImage: () => void;
};

// Display the saved profile, attendance badges, and photo-edit action.
export default function RusheeProfileSummary({ initialRushee, onEditImage }: Props) {
    return (
        <div className="max-w-4xl mx-auto card-apple">
            <div className="flex flex-col sm:flex-row items-center space-y-6 sm:space-y-0 sm:space-x-8 p-8">
                <div className="relative flex-shrink-0">
                    <img
                        src={initialRushee.image_url}
                        alt={`${initialRushee.first_name} ${initialRushee.last_name}`}
                        className="w-40 h-40 rounded-apple-2xl object-cover border border-apple-gray-200"
                    />
                    <button
                        onClick={onEditImage}
                        className="absolute top-2 right-2 w-8 h-8 bg-black text-white rounded-apple flex items-center justify-center hover:bg-apple-gray-800 transition-colors duration-200"
                        aria-label="Edit Image"
                    >
                        <FaRegEdit className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row gap-3 items-center mb-4">
                        <h1 className="text-apple-large font-light text-black">
                            {initialRushee.first_name} {initialRushee.last_name}
                        </h1>
                        <div className="flex flex-wrap gap-2">
                            {initialRushee.attendance.map(/* Render a badge for an attended rush event. */ (event, idx) => (
                                <Badges text={event.name} key={idx} />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 text-apple-body">
                        <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Pronouns:</span> {initialRushee.pronouns}</p>
                        <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Major:</span> {initialRushee.major}</p>
                        <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Email:</span> {initialRushee.email}</p>
                        <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Phone:</span> {initialRushee.phone_number}</p>
                        <p className="text-apple-gray-600 font-light"><span className="font-normal text-black">Housing:</span> {initialRushee.housing}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
