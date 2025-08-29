import React, { useState, useMemo } from "react";
import { useAdminVotingContext } from "./AdminVotingContext";
import { verifyUser } from "../../js/verifications";
import axios from "axios";
import Loader from "../../components/Loader";
import { Rushee } from "./types";
import { toast } from "react-toastify";

export default function RusheePreviewCard() {
    const { rushee, setRushee } = useAdminVotingContext();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [allRushees, setAllRushees] = useState<Rushee[] | null>(null);
    const [loading, setLoading] = useState(false);

    const api = import.meta.env.VITE_API_PREFIX;

    // Filter rushees based on search query
    const filteredRushees = useMemo(() => {
        if (!allRushees || !searchQuery.trim()) return allRushees;
        
        const query = searchQuery.toLowerCase();
        return allRushees.filter(r => {
            // Handle different possible name structures
            const firstName = r.first_name || (r as any).firstname || '';
            const lastName = r.last_name || (r as any).lastname || '';
            const fullName = `${firstName} ${lastName}`.toLowerCase().trim();
            const singleName = (r as any).name?.toLowerCase() || '';
            const gtid = (r.gtid || '').toLowerCase();
            
            return fullName.includes(query) || singleName.includes(query) || gtid.includes(query);
        });
    }, [allRushees, searchQuery]);

    const handleSearchClick = async () => {
        setSearchOpen(true);
        if (!allRushees) {
            setLoading(true);
            try {
                const response = await axios.get(`${api}/rushee/get-rushees`);
                if (response.data.status === "success") {
                    console.log("Rushees data structure:", response.data.payload[0]); // Debug log
                    setAllRushees(response.data.payload);
                } else {
                    console.error("Failed to fetch rushees");
                }
            } catch (err) {
                console.error("Network error while fetching rushees");
            }
            setLoading(false);
        }
    };

    const handleCloseSearch = () => {
        setSearchOpen(false);
        setSearchQuery("");
    };

    const handleSelect = async (selected: Rushee) => {
        const payload = { gtid: selected.gtid };

        await toast.promise(
            axios.post(`${api}/admin/voting/change-rushee`, payload),
            {
                pending: "Updating rushee...",
                success: "Rushee updated successfully!",
                error: "Failed to update rushee",
            },
            {
                position: "top-center",
                theme: "light",
            }
        );

        handleCloseSearch();
    };

    return (
        <div className="relative w-full">
            {/* Search Bar */}
            <div className="card-apple p-4 rounded-apple mb-4">
                <label className="text-apple-footnote text-apple-gray-600 font-light block mb-3">
                    Select Rushee
                </label>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search by name or GTID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={handleSearchClick}
                        className="w-full px-4 py-3 border border-apple-gray-300 rounded-apple text-apple-body focus:outline-none focus:border-black transition-colors duration-150"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="w-5 h-5 text-apple-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {/* Search Results */}
                {searchOpen && (
                    <div className="absolute z-50 mt-2 left-4 right-4 bg-white border border-apple-gray-200 rounded-apple shadow-lg max-h-64 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 flex justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-b-transparent"></div>
                            </div>
                        ) : filteredRushees && filteredRushees.length > 0 ? (
                            <ul>
                                {filteredRushees.map((r, idx) => {
                                    // Handle different possible data structures
                                    const displayName = r.first_name && r.last_name 
                                        ? `${r.first_name} ${r.last_name}`
                                        : (r as any).name || `${(r as any).firstname || ''} ${(r as any).lastname || ''}`.trim() || 'Unknown Name';
                                    
                                    return (
                                        <li
                                            key={idx}
                                            onClick={() => handleSelect(r)}
                                            className="px-4 py-3 hover:bg-apple-gray-50 text-apple-body text-black cursor-pointer border-b border-apple-gray-100 last:border-b-0 flex justify-between items-center"
                                        >
                                            <span>{displayName}</span>
                                            <span className="text-apple-footnote text-apple-gray-500">{r.gtid}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : searchQuery.trim() ? (
                            <div className="p-4 text-center text-apple-gray-500 text-apple-footnote">
                                No rushees found matching "{searchQuery}"
                            </div>
                        ) : null}
                    </div>
                )}

                {searchOpen && (
                    <div 
                        className="fixed inset-0 z-40"
                        onClick={handleCloseSearch}
                    />
                )}
            </div>

            {/* Current Rushee Display */}
            {rushee ? (
                <div className="card-apple flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-apple">
                    <img
                        src={rushee.image_url}
                        alt={`${rushee.first_name} ${rushee.last_name}`}
                        className="w-32 h-32 object-cover rounded-apple-2xl border border-apple-gray-200"
                    />

                    <div className="flex-1 w-full space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <h2 className="text-apple-title1 font-light text-black">
                                {rushee.first_name} {rushee.last_name}
                            </h2>
                            <p className="text-apple-footnote text-apple-gray-600 font-light">
                                GTID: {rushee.gtid}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-apple-footnote text-apple-gray-600 font-light">
                            <span><span className="text-black font-normal">Major:</span> {rushee.major}</span>
                            <span><span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}</span>
                        </div>

                        {rushee.ratings && rushee.ratings.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {rushee.ratings.map((rating, idx) => (
                                    <span
                                        key={idx}
                                        className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-caption1 font-light"
                                    >
                                        {rating.name}: {((rating.value / 5) * 100).toFixed(0)}%
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="card-apple p-8 rounded-apple text-center">
                    <p className="text-apple-gray-400 text-apple-body font-light italic">
                        No rushee selected. Use the search bar above to find and select a rushee.
                    </p>
                </div>
            )}
        </div>
    );
}
