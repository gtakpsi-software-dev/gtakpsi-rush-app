type NavbarMoreItemsProps = {
    isBidcom: boolean;
    isAdmin: boolean;
};

// Render additional brother links and the bid committee sorting link when applicable.
export default function NavbarMoreItems({ isBidcom, isAdmin }: NavbarMoreItemsProps) {
    return (
        <ul className="absolute left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-48 z-50">
            <li>
                <a
                    href="/bid-committee"
                    className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                >
                    Bid Committee
                </a>
            </li>
            <li>
                <a
                    href="/attendance"
                    target="_blank"
                    className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                >
                    Attendance
                </a>
            </li>
            <li>
                <a
                    href="/sorting"
                    className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                >
                    Sorting
                </a>
            </li>
            {isBidcom && !isAdmin && (
                <li>
                    <a
                        href="/bidcom/sorting"
                        className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                    >
                        BidCom Sorting
                    </a>
                </li>
            )}
        </ul>
    );
}
