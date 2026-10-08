type NavbarAdminItemsProps = {
    isMidtermMode: boolean;
};

// Render administrator menu links according to midterm mode.
export default function NavbarAdminItems({ isMidtermMode }: NavbarAdminItemsProps) {
    return (
        <ul className="absolute left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 w-48 z-50">
            <li>
                <a
                    href="/admin"
                    className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                >
                    Admin Panel
                </a>
            </li>
            <li>
                <a
                    href="/admin/voting"
                    className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                >
                    Admin Voting
                </a>
            </li>
            {!isMidtermMode && (
                <>
                    <li>
                        <a
                            href="/admin/sorting"
                            className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                        >
                            Admin Sorting
                        </a>
                    </li>
                    <li>
                        <a
                            href="/bidcom/sorting"
                            className="block px-4 py-2 text-black hover:bg-apple-gray-100"
                        >
                            BidCom Sorting
                        </a>
                    </li>
                </>
            )}
        </ul>
    );
}
