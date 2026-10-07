type Brother = {
    uid?: string;
    id?: string;
    _id?: string;
    firstname?: string;
    firstName?: string;
    lastname?: string;
    lastName?: string;
    email?: string;
};

type AdminAccessCardProps = {
    brotherSearch: string;
    setBrotherSearch: (value: string) => void;
    selectedBrother: Brother | null;
    setSelectedBrother: (brother: Brother | null) => void;
    filteredBrothers: Brother[];
    handleSelectBrother: (brother: Brother) => void;
    brotherAdminStatus: boolean | null;
    brotherBidcomStatus: boolean | null;
    isPromoting: boolean;
    handleSetAdmin: (makeAdmin: boolean) => Promise<void>;
    handleSetBidcom: (makeBidcom: boolean) => Promise<void>;
};

export default function AdminAccessCard({
    brotherSearch,
    setBrotherSearch,
    selectedBrother,
    setSelectedBrother,
    filteredBrothers,
    handleSelectBrother,
    brotherAdminStatus,
    brotherBidcomStatus,
    isPromoting,
    handleSetAdmin,
    handleSetBidcom,
}: AdminAccessCardProps) {
    return (
        <div className="card-apple p-5">
            <h3 className="text-apple-headline font-normal text-black mb-2">Admin Access</h3>
            <p className="text-apple-footnote text-apple-gray-600 font-light mb-4">
                Search a brother and grant admin access
            </p>
            <div className="relative mb-3">
                <input
                    type="text"
                    placeholder="Search brother by name or email..."
                    className="input-apple text-apple-body"
                    value={brotherSearch}
                    onChange={(e) => {
                        setBrotherSearch(e.target.value);
                        if (selectedBrother && e.target.value !== (selectedBrother.email || "")) {
                            setSelectedBrother(null);
                        }
                    }}
                />
                {filteredBrothers.length > 0 && !selectedBrother && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-apple-gray-200 rounded-apple-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredBrothers.map((brother) => {
                            const fullName = `${brother.firstname || brother.firstName || ""} ${brother.lastname || brother.lastName || ""}`.trim();
                            return (
                                <div
                                    key={brother.uid || brother.id || brother._id}
                                    className="px-4 py-3 hover:bg-apple-gray-100 cursor-pointer border-b border-apple-gray-100 last:border-b-0"
                                    onClick={() => handleSelectBrother(brother)}
                                >
                                    <div className="text-apple-body font-normal text-black">
                                        {fullName || brother.email}
                                    </div>
                                    <div className="text-apple-caption2 text-apple-gray-600">
                                        {brother.email}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {selectedBrother && (
                <div className="bg-apple-gray-50 rounded-apple-lg p-4 border border-apple-gray-200 mb-3 space-y-1">
                    <div className="text-apple-body font-medium text-black">
                        {`${selectedBrother.firstname || selectedBrother.firstName || ""} ${selectedBrother.lastname || selectedBrother.lastName || ""}`.trim() || selectedBrother.email}
                    </div>
                    <div className="text-apple-caption2 text-apple-gray-600">
                        {selectedBrother.email}
                    </div>
                    <div className="text-apple-caption2 flex gap-4 mt-2">
                        <span>
                            Admin:{" "}
                            <span className={`font-medium ${brotherAdminStatus ? "text-green-600" : "text-apple-gray-500"}`}>
                                {brotherAdminStatus === null ? "..." : brotherAdminStatus ? "Yes" : "No"}
                            </span>
                        </span>
                        <span>
                            Bid Committee:{" "}
                            <span className={`font-medium ${brotherBidcomStatus ? "text-blue-600" : "text-apple-gray-500"}`}>
                                {brotherBidcomStatus === null ? "..." : brotherBidcomStatus ? "Yes" : "No"}
                            </span>
                        </span>
                    </div>
                </div>
            )}

            {/* A claim change stays unavailable until a brother is selected and the current update completes. */}
            <div className="mb-3">
                <div className="text-apple-caption1 font-medium text-apple-gray-600 mb-2">Admin Access</div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSetAdmin(true)}
                        disabled={isPromoting || !selectedBrother || brotherAdminStatus}
                        className="flex-1 bg-black text-white py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light hover:bg-apple-gray-800 transition-all duration-200 disabled:opacity-60"
                    >
                        {isPromoting ? "..." : "Grant Admin"}
                    </button>
                    <button
                        onClick={() => handleSetAdmin(false)}
                        disabled={isPromoting || !selectedBrother || !brotherAdminStatus}
                        className="flex-1 bg-white text-black py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light border border-apple-gray-200 hover:bg-apple-gray-50 transition-all duration-200 disabled:opacity-60"
                    >
                        {isPromoting ? "..." : "Remove Admin"}
                    </button>
                </div>
            </div>

            <div>
                <div className="text-apple-caption1 font-medium text-apple-gray-600 mb-2">Bid Committee Access</div>
                <div className="flex gap-3">
                    <button
                        onClick={() => handleSetBidcom(true)}
                        disabled={isPromoting || !selectedBrother || brotherBidcomStatus}
                        className="flex-1 bg-blue-600 text-white py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light hover:bg-blue-700 transition-all duration-200 disabled:opacity-60"
                    >
                        {isPromoting ? "..." : "Grant Bid Com"}
                    </button>
                    <button
                        onClick={() => handleSetBidcom(false)}
                        disabled={isPromoting || !selectedBrother || !brotherBidcomStatus}
                        className="flex-1 bg-white text-black py-2.5 px-4 rounded-apple-xl text-apple-footnote font-light border border-apple-gray-200 hover:bg-apple-gray-50 transition-all duration-200 disabled:opacity-60"
                    >
                        {isPromoting ? "..." : "Remove Bid Com"}
                    </button>
                </div>
            </div>
        </div>
    );
}
