import type { ComponentProps } from "react";

import Navbar from "../../../components/Navbar";
import AvailabilityEditorModal from "../availability/AvailabilityEditorModal";
import PisAvailabilitySection from "../availability/PisAvailabilitySection";
import AdminExportsAccessSection from "./AdminExportsAccessSection";
import AdminManagementSection from "./AdminManagementSection";

type AdminPageViewProps = {
    editor: ComponentProps<typeof AvailabilityEditorModal>;
    exportsAccess: ComponentProps<typeof AdminExportsAccessSection>;
    management: ComponentProps<typeof AdminManagementSection>;
    availability: ComponentProps<typeof PisAvailabilitySection>;
};

// Render the admin panel sections and optional availability editor.
export default function AdminPageView({
    editor,
    exportsAccess,
    management,
    availability,
}: AdminPageViewProps) {
    return (
        <div className="min-h-screen w-full bg-white">
            {editor.editingBrotherAvailability && (
                <AvailabilityEditorModal {...editor} />
            )}

            <Navbar />

            <div className="pt-24 p-4 pb-20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <div className="mb-8">
                        <h1 className="text-apple-large font-light text-black">Admin Panel</h1>
                        <p className="text-apple-body text-apple-gray-600 font-light mt-2">
                            Manage PIS questions, timeslots, and rush nights
                        </p>
                    </div>

                    <AdminExportsAccessSection {...exportsAccess} />

                    <div className="border-t border-apple-gray-200 my-10"></div>

                    <AdminManagementSection {...management} />

                    <div className="border-t border-apple-gray-200 my-10"></div>

                    <PisAvailabilitySection {...availability} />
                </div>
            </div>
        </div>
    );
}
