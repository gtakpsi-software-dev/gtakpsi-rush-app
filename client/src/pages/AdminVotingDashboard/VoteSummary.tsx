import React from "react";
import { useAdminVotingContext } from "../../features/voting/admin/AdminVotingContext";
import { FaSync } from "react-icons/fa";
import { adminPost } from "../../features/admin/api";
import { toast } from "react-toastify";
import VotePieChart from "../../features/voting/admin/VotePieChart";

interface VoteSummaryProps {
  showBreakdown?: boolean;
}

export default function VoteSummary({ showBreakdown = true }: VoteSummaryProps) {
  const { votes } = useAdminVotingContext();

  const total = votes.length;
  const yes = votes.filter((v) => v.vote === "Yes").length;
  const no = votes.filter((v) => v.vote === "No").length;
  const abstain = votes.filter((v) => v.vote === "Abstain").length;

  const api = import.meta.env.VITE_API_PREFIX;

  const handleClearVotes = async () => {
    await toast.promise(
      adminPost(`${api}/admin/voting/clear-votes`, {}),
      {
        pending: "Clearing votes...",
        success: "Votes cleared successfully!",
        error: "Failed to clear votes",
      },
      {
        position: "top-center",
        theme: "light",
      }
    );
  };

  return (
    <div className="relative rounded-apple shadow-md p-6 bg-gradient-to-br from-white via-apple-gray-50 to-apple-gray-100 border border-apple-gray-200">
      <button
        onClick={handleClearVotes}
        className="absolute top-4 right-4 border border-apple-gray-300 text-apple-gray-400 hover:text-black hover:border-black rounded-full p-2 transition-colors"
      >
        <FaSync className="w-4 h-4" />
      </button>

      <h2 className="text-apple-title2 font-semibold text-black mb-4 tracking-tight">
        Voting Progress
      </h2>
      <p className="text-apple-body font-light text-apple-gray-600 mb-6">
        Total Votes Received: <span className="font-medium text-black">{total}</span>
      </p>

      <div className="mb-6">
        <VotePieChart yes={yes} no={no} abstain={abstain} />
      </div>

      {showBreakdown && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-100 text-green-800 rounded-apple px-4 py-2 text-center">
              <p className="text-apple-footnote font-medium">Yes</p>
              <p className="text-apple-title3 font-semibold">{yes}</p>
              <p className="text-apple-caption text-green-600">
                {yes + no > 0 ? ((yes / (yes + no)) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="bg-red-100 text-red-800 rounded-apple px-4 py-2 text-center">
              <p className="text-apple-footnote font-medium">No</p>
              <p className="text-apple-title3 font-semibold">{no}</p>
              <p className="text-apple-caption text-red-600">
                {yes + no > 0 ? ((no / (yes + no)) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>

          {abstain > 0 && (
            <div className="bg-yellow-50 text-yellow-700 rounded-apple px-4 py-2 text-center border border-yellow-200">
              <p className="text-apple-footnote font-medium">Abstain</p>
              <p className="text-apple-title3 font-semibold">{abstain}</p>
              <p className="text-apple-caption text-yellow-600">Not included in percentages</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
