import React, { useEffect, useState } from "react";
import { useAdminVotingContext } from "./AdminVotingContext";
import Loader from "../../../components/Loader";
import { adminGet, adminPost } from "../../admin/api";

// Display each brother’s voting status and eligibility controls.
export default function BrotherList() {
  const { brothers, votes } = useAdminVotingContext();
  const [eligibilityMap, setEligibilityMap] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const lambdaURL = import.meta.env.VITE_API_PREFIX;

  useEffect(() => {
      // Refresh eligibility when the brother directory or API URL changes.
    // Fetch ineligible IDs and derive each listed brother’s eligibility.
    const fetchEligibility = async () => {
      try {
        const response = await adminGet(`${lambdaURL}/admin/voting/get-eligibility`);
        if (response.data.status === "success") {
          const ineligibleIds: string[] = response.data.ineligible_ids;
          const map: Record<string, boolean> = {};
          brothers.forEach((b) => {
              // Mark this brother eligible unless their ID is in the ineligible list.
            map[b._id] = !ineligibleIds.includes(b._id);
          });
          setEligibilityMap(map);
        }
      } catch (err) {
        console.error("Error fetching eligibility:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEligibility();
  }, [brothers, lambdaURL]);

  // Check whether the current vote list includes this brother ID.
  const hasVoted = (gtid: string) => {
    return votes.some(/* Match a vote to the requested brother ID. */ (v) => v.brother_id === gtid);
  };

  // Request the opposite eligibility state and update local feedback.
  const toggleEligibility = async (gtid: string) => {
    try {
      setToggling(gtid);
      const isCurrentlyEligible = eligibilityMap?.[gtid];

      const route = isCurrentlyEligible ? "make-ineligible" : "make-eligible";
      await adminPost(`${lambdaURL}/admin/voting/${route}`, { gtid });

      setEligibilityMap((prev) => {
          // Invert the selected brother’s eligibility in the existing map.
        if (!prev) return prev;
        return {
          ...prev,
          [gtid]: !prev[gtid],
        };
      });
    } catch (e) {
      console.error("Error toggling eligibility", e);
    } finally {
      setToggling(null);
    }
  };

  if (loading || !eligibilityMap) return <Loader />;

  return (
    <div className="pt-4 space-y-3">
      {brothers.map(/* Render a brother’s vote status and eligibility button. */ (brother) => (
        <div
          key={brother._id}
          className="card-apple p-4 border border-apple-gray-200 rounded-apple shadow-sm hover:shadow-md transition-all duration-150"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h3 className="text-apple-title3 text-black">
                {brother.firstname} {brother.lastname}
              </h3>
              {/* <p className="text-apple-footnote text-apple-gray-600 font-light">GTID: {brother.gtid}</p> */}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-3 sm:mt-0">
              <span
                className={`px-3 py-1 rounded-full text-apple-footnote font-medium ${
                  hasVoted(brother._id) ? "bg-green-100 text-green-800" : "bg-apple-gray-100 text-apple-gray-600"
                }`}
              >
                {hasVoted(brother._id) ? "Voted" : "Not Voted"}
              </span>

              <button
                disabled={toggling === brother._id}
                onClick={/* Toggle this brother’s voting eligibility. */ () => toggleEligibility(brother._id)}
                className={`px-3 py-1 rounded-full text-apple-footnote font-medium border transition-all duration-150 ${
                  eligibilityMap[brother._id]
                    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    : "bg-red-100 text-red-700 border-red-200 hover:bg-red-200"
                }`}
              >
                {toggling === brother._id ? "Toggling..." : eligibilityMap[brother._id] ? "Eligible" : "Ineligible"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
