import { useState, useEffect } from "react";

import { logout } from "../features/auth/account";
import { verifyUser } from "../features/auth/verifyUser";
import { parseAdminAllowlist } from "../features/auth/parseAdminAllowlist";
import { auth } from "../firebase";
import { useMidtermMode } from "../contexts/MidtermModeContext";
import { loadNavbarAuth } from "../features/navigation/loadNavbarAuth";
import NavbarMenu from "../features/navigation/NavbarMenu";

const ADMIN_ALLOWLIST = parseAdminAllowlist(import.meta.env.VITE_ADMIN_ALLOWLIST);

type NavbarProps = { stripped?: boolean };

export default function Navbar(props: NavbarProps) {
    const [showMenu, setShowMenu] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const [showAdmin, setShowAdmin] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBidcom, setIsBidcom] = useState(false);
    const stripped = props.stripped ? props.stripped : false;
    const { isMidtermMode } = useMidtermMode();

    useEffect(() => {
        loadNavbarAuth({
            verifyUser,
            auth,
            allowlist: ADMIN_ALLOWLIST,
            setIsAuthenticated,
            setIsAdmin,
            setIsBidcom,
            setIsLoading,
        });
    }, []);

    if (isLoading) {
        return null;
    }
    
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="fixed z-50 w-full navbar-apple">
            <nav className="backdrop-blur-md">
                <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                    <a href="/" className="flex items-center space-x-3">
                        <img src="/akpsilogo.png" className="h-8" alt="AKPsi Logo" />
                        <span className="self-center text-apple-title2 font-normal whitespace-nowrap text-black">
                            {isMidtermMode ? "AKPsi Midterm" : "AKPsi Rush Application"}
                        </span>
                    </a>
                    <button
                        onClick={() => {
                            setShowMenu(!showMenu);
                        }}
                        type="button"
                        className={
                            stripped
                                ? "hidden"
                                : "inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-black rounded-apple md:hidden hover:bg-apple-gray-100 focus:outline-none focus:ring-2 focus:ring-apple-gray-300"
                        }
                        aria-controls="navbar-default"
                        aria-expanded="false"
                    >
                        <span className="sr-only">Open main menu</span>
                        <svg
                            className="w-5 h-5"
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 17 14"
                        >
                            <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M1 1h15M1 7h15M1 13h15"
                            />
                        </svg>
                    </button>
                    <div
                        className={
                            showMenu && !stripped
                                ? "w-full md:block md:w-auto"
                                : "hidden w-full md:block md:w-auto"
                        }
                        id="navbar-default"
                    >
                        <NavbarMenu
                            stripped={stripped}
                            isMidtermMode={isMidtermMode}
                            isBidcom={isBidcom}
                            isAdmin={isAdmin}
                            showMore={showMore}
                            showAdmin={showAdmin}
                            setShowMore={setShowMore}
                            setShowAdmin={setShowAdmin}
                            logout={logout}
                            reload={() => window.location.reload()}
                        />
                    </div>
                </div>
            </nav>
        </div>
    );
}
