import Button from "../Button";

export default function DisplayInfo(props) {

    const initialRushee = props.rushee

    return (
        <div className="min-h-screen w-full bg-white flex justify-center items-center p-4">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-apple-large font-light text-black mb-3">Is this you?</h1>
                    <div className="w-16 h-0.5 bg-black mx-auto"></div>
                </div>

                {/* Profile Card */}
                <div className="card-apple p-6 mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <img
                            src={initialRushee.image_url}
                            alt={`${initialRushee.first_name} ${initialRushee.last_name}`}
                            className="w-44 h-44 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                        />
                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-apple-large font-light text-black mb-4">
                                {initialRushee.first_name} {initialRushee.last_name}
                            </h2>
                            
                            <div className="space-y-2 text-apple-body">
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Pronouns:</span> {initialRushee.pronouns}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Major:</span> {initialRushee.major}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Email:</span> {initialRushee.email}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Phone:</span> {initialRushee.phone_number}
                                </p>
                                <p className="text-apple-gray-600 font-light">
                                    <span className="text-black font-normal">Housing:</span> {initialRushee.housing}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button 
                        onClick={props.goBack}
                        className="btn-apple-secondary px-8 py-4 text-apple-headline font-light"
                    >
                        No? Go Back
                    </button>
                    <button 
                        onClick={props.checkIn}
                        className="btn-apple px-8 py-4 text-apple-headline font-light"
                    >
                        Yes! Check In
                    </button>
                </div>
            </div>
        </div>
    )

}