import { Link } from "react-router-dom";
import NavbarAdminItems from "./NavbarAdminItems";
import NavbarMoreItems from "./NavbarMoreItems";

type NavbarMenuProps = {
    stripped: boolean;
    isMidtermMode: boolean;
    isBidcom: boolean;
    isAdmin: boolean;
    showMore: boolean;
    showAdmin: boolean;
    setShowMore: (value: boolean) => void;
    setShowAdmin: (value: boolean) => void;
    logout: () => void;
    reload: () => void;
};

export default function NavbarMenu({
    stripped,
    isMidtermMode,
    isBidcom,
    isAdmin,
    showMore,
    showAdmin,
    setShowMore,
    setShowAdmin,
    logout,
    reload,
}: NavbarMenuProps) {
    return (
        <ul
            className={
                !stripped
                    ? "font-normal flex flex-col p-4 md:p-0 mt-4 rounded-apple-lg md:flex-row md:space-x-2 md:mt-0 md:border-0"
                    : "hidden"
            }
        >
            {isMidtermMode ? (
                <>
                    <li>
                        <a
                            href="/dashboard"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                            aria-current="page"
                        >
                            Dashboard
                        </a>
                    </li>
                    <li>
                        <a
                            href="/voting"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                        >
                            Voting
                        </a>
                    </li>
                </>
            ) : (
                <>
                    <li>
                        <a
                            href="/dashboard"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                            aria-current="page"
                        >
                            Dashboard
                        </a>
                    </li>

                    <li>
                        <Link
                            to="/comments"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                        >
                            Comments
                        </Link>
                    </li>
                    <li>
                        <a
                            href="/voting"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                        >
                            Voting
                        </a>
                    </li>
                    <li>
                        <a
                            href="/my-pis"
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                        >
                            My PIS
                        </a>
                    </li>

                    <li className="relative">
                        <button
                            onClick={() => {
                                setShowMore(!showMore);
                                setShowAdmin(false);
                            }}
                            className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                        >
                            More ▾
                        </button>
                        {showMore && (
                            <NavbarMoreItems isBidcom={isBidcom} isAdmin={isAdmin} />
                        )}
                    </li>
                </>
            )}

            {isAdmin && (
                <li className="relative">
                    <button
                        onClick={() => {
                            setShowAdmin(!showAdmin);
                            setShowMore(false);
                        }}
                        className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2"
                    >
                        Admin ▾
                    </button>
                    {showAdmin && (
                        <NavbarAdminItems isMidtermMode={isMidtermMode} />
                    )}
                </li>
            )}

            <li>
                <p
                    onClick={() => {
                        logout();
                        reload();
                    }}
                    className="block py-2 px-4 text-black rounded-apple hover:bg-apple-gray-100 transition-colors duration-200 md:p-2 cursor-pointer"
                >
                    Logout
                </p>
            </li>
        </ul>
    );
}
