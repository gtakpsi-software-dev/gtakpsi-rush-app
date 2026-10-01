import CollaborativeInput from "../../components/CollaborativeInput";

type Brother = { firstName: string; lastName: string };
type Signup = {
    first_brother_first_name: string;
    first_brother_last_name: string;
    second_brother_first_name: string;
    second_brother_last_name: string;
};

type Props = {
    rushee: { pis_signup: Signup | null };
    brotherA: Brother;
    brotherB: Brother;
    collaboration: unknown;
    currentUser: unknown;
    handleBrotherAChange: (field: string, value: string) => void;
    handleBrotherBChange: (field: string, value: string) => void;
};

export default function PisBrotherFields({
    rushee, brotherA, brotherB, collaboration, currentUser,
    handleBrotherAChange, handleBrotherBChange,
}: Props) {
    return (
        <div className="mb-8 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple">
            <h3 className="text-apple-title2 font-normal text-black mb-4">Brother Information</h3>

            {/* The backend uses "none" to mark unassigned brothers. */}
            {rushee.pis_signup && (rushee.pis_signup.first_brother_first_name !== "none" || rushee.pis_signup.second_brother_first_name !== "none") && (
                <div className="mb-6 p-4 bg-apple-gray-100 border border-apple-gray-200 rounded-apple">
                    <h4 className="text-apple-body text-black font-normal mb-2">Currently Assigned:</h4>
                    {rushee.pis_signup.first_brother_first_name !== "none" && (
                        <p className="text-apple-body text-apple-gray-600 font-light">
                            Brother 1: {rushee.pis_signup.first_brother_first_name} {rushee.pis_signup.first_brother_last_name}
                        </p>
                    )}
                    {rushee.pis_signup.second_brother_first_name !== "none" && (
                        <p className="text-apple-body text-apple-gray-600 font-light">
                            Brother 2: {rushee.pis_signup.second_brother_first_name} {rushee.pis_signup.second_brother_last_name}
                        </p>
                    )}
                </div>
            )}

            <div className="mb-6">
                <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother A:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CollaborativeInput
                        fieldKey="_brotherA_firstName"
                        placeholder="First Name"
                        value={brotherA.firstName}
                        onChange={(value) => handleBrotherAChange('firstName', value)}
                        className="input-apple text-apple-footnote"
                        collaboration={collaboration}
                        currentUser={currentUser}
                        required
                    />
                    <CollaborativeInput
                        fieldKey="_brotherA_lastName"
                        placeholder="Last Name"
                        value={brotherA.lastName}
                        onChange={(value) => handleBrotherAChange('lastName', value)}
                        className="input-apple text-apple-footnote"
                        collaboration={collaboration}
                        currentUser={currentUser}
                        required
                    />
                </div>
            </div>

            <div className="mb-0">
                <label className="block text-apple-footnote font-normal text-apple-gray-700 mb-2">Brother B:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CollaborativeInput
                        fieldKey="_brotherB_firstName"
                        placeholder="First Name"
                        value={brotherB.firstName}
                        onChange={(value) => handleBrotherBChange('firstName', value)}
                        className="input-apple text-apple-footnote"
                        collaboration={collaboration}
                        currentUser={currentUser}
                    />
                    <CollaborativeInput
                        fieldKey="_brotherB_lastName"
                        placeholder="Last Name"
                        value={brotherB.lastName}
                        onChange={(value) => handleBrotherBChange('lastName', value)}
                        className="input-apple text-apple-footnote"
                        collaboration={collaboration}
                        currentUser={currentUser}
                    />
                </div>
            </div>
        </div>
    );
}
