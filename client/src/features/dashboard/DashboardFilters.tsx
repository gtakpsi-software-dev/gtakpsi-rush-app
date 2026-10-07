import type { ChangeEvent } from 'react';

type DashboardFiltersProps = {
    query: string;
    handleSearch: (event: ChangeEvent<HTMLInputElement>) => void;
    rushees: { major: string; class: string }[];
    selectedMajor: string;
    setSelectedMajor: (value: string) => void;
    selectedClass: string;
    setSelectedClass: (value: string) => void;
    selectedSort: string;
    setSelectedSort: (value: string) => void;
    onShuffle: () => void;
};

export default function DashboardFilters({
    query,
    handleSearch,
    rushees,
    selectedMajor,
    setSelectedMajor,
    selectedClass,
    setSelectedClass,
    selectedSort,
    setSelectedSort,
    onShuffle,
}: DashboardFiltersProps) {
    return (
        <div className="card-apple p-6 mb-6">
            <div className="mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={handleSearch}
                    placeholder="Search by name, email, major, or GTID..."
                    className="input-apple text-apple-body"
                />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                <div className="flex flex-wrap gap-3">
                    <div>
                        <select
                            value={selectedMajor}
                            onChange={(e) => setSelectedMajor(e.target.value)}
                            className="input-apple text-apple-body"
                        >
                            <option value="All">All Majors</option>
                            {Array.from(new Set(rushees.map((rushee) => rushee.major))).map((major, idx) => (
                                <option key={idx} value={major}>
                                    {major}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="input-apple text-apple-body"
                        >
                            <option value="All">All Years</option>
                            {Array.from(new Set(rushees.map((rushee) => rushee.class))).map((classYear, idx) => (
                                <option key={idx} value={classYear}>
                                    {classYear}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <select
                            value={selectedSort}
                            onChange={(e) => setSelectedSort(e.target.value)}
                            className="input-apple text-apple-body"
                        >
                            <option value="none">No Sorting</option>
                            <option value="firstName">First Name</option>
                            <option value="lastName">Last Name</option>
                        </select>
                    </div>
                </div>

                <div className="mt-2 sm:mt-0">
                    <button
                        onClick={onShuffle}
                        className="btn-apple-secondary px-6 py-3 text-apple-body font-light"
                    >
                        Shuffle
                    </button>
                </div>
            </div>
        </div>
    );
}
