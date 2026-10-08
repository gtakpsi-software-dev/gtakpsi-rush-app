import type { Rushee } from "./types";
import { previewRusheeName } from "./previewRusheeSearch";

type Props = {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchOpen: boolean;
    loading: boolean;
    filteredRushees: Rushee[] | null;
    handleSearchClick: () => void | Promise<void>;
    handleCloseSearch: () => void;
    handleSelect: (selected: Rushee) => void | Promise<void>;
};

// Render the rushee search input, result list, and dismissal backdrop.
export default function RusheePreviewSearch({
    searchQuery,
    setSearchQuery,
    searchOpen,
    loading,
    filteredRushees,
    handleSearchClick,
    handleCloseSearch,
    handleSelect,
}: Props) {
    return (
        <div className="card-apple p-4 rounded-apple mb-4">
            <label className="text-apple-footnote text-apple-gray-600 font-light block mb-3">
                Select Rushee
            </label>
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search by name or GTID..."
                    value={searchQuery}
                    onChange={/* Update the rushee search query. */ (e) => setSearchQuery(e.target.value)}
                    onFocus={handleSearchClick}
                    className="w-full px-4 py-3 border border-apple-gray-300 rounded-apple text-apple-body focus:outline-none focus:border-black transition-colors duration-150"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg className="w-5 h-5 text-apple-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {searchOpen && (
                <div className="absolute z-50 mt-2 left-4 right-4 bg-white border border-apple-gray-200 rounded-apple shadow-lg max-h-64 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 flex justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-black border-b-transparent"></div>
                        </div>
                    ) : filteredRushees && filteredRushees.length > 0 ? (
                        <ul>
                            {filteredRushees.map((r, idx) => {
                                // Render a selectable search result with its name and GTID.
                                return (
                                    <li
                                        key={idx}
                                        onClick={/* Select this rushee for voting. */ () => handleSelect(r)}
                                        className="px-4 py-3 hover:bg-apple-gray-50 text-apple-body text-black cursor-pointer border-b border-apple-gray-100 last:border-b-0 flex justify-between items-center"
                                    >
                                        <span>{previewRusheeName(r)}</span>
                                        <span className="text-apple-footnote text-apple-gray-500">{r.gtid}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : searchQuery.trim() ? (
                        <div className="p-4 text-center text-apple-gray-500 text-apple-footnote">
                            No rushees found matching &quot;{searchQuery}&quot;
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
    );
}
