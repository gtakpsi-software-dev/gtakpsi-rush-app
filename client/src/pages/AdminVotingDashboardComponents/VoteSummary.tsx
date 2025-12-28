import React from "react";
import { useAdminVotingContext } from "./AdminVotingContext";
import { FaSync } from "react-icons/fa";
import { adminPost } from "../../js/adminAxios";
import { toast } from "react-toastify";

interface VoteSummaryProps {
  showBreakdown?: boolean;
}

// Simple CSS-based Pie Chart Component (Yes/No only)
const PieChart = ({ yes, no, abstain, total }: { yes: number; no: number; abstain: number; total: number }) => {
  const yesNoTotal = yes + no;
  
  if (yesNoTotal === 0) {
    return (
      <div className="w-48 h-48 mx-auto flex items-center justify-center bg-apple-gray-100 rounded-full border">
        <span className="text-apple-gray-500 text-apple-footnote">No Yes/No votes yet</span>
      </div>
    );
  }

  // Calculate percentages based on Yes/No votes only (excluding abstains)
  const yesPercentage = (yes / yesNoTotal) * 100;
  const noPercentage = (no / yesNoTotal) * 100;

  // Using conic-gradient for a simpler implementation
  const generateGradient = () => {
    let gradient = "conic-gradient(";
    
    if (yes > 0) {
      gradient += `#22c55e 0% ${yesPercentage}%`;
    }
    
    if (no > 0) {
      if (yes > 0) gradient += ", ";
      gradient += `#ef4444 ${yesPercentage}% 100%`;
    }
    
    gradient += ")";
    return gradient;
  };

  const slices: Array<{ label: string; count: number; percentage: number; color: string }> = [];
  if (yes > 0) slices.push({ label: "Yes", count: yes, percentage: yesPercentage, color: "#22c55e" });
  if (no > 0) slices.push({ label: "No", count: no, percentage: noPercentage, color: "#ef4444" });

  console.log("Pie chart data (Yes/No only):", { yes, no, yesNoTotal, gradient: generateGradient() });

  return (
    <div className="flex flex-col items-center space-y-4">
      <div 
        className="w-48 h-48 rounded-full border-4 border-white shadow-lg"
        style={{ background: generateGradient() }}
      />
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4">
        {slices.map((slice, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-gray-300"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-apple-footnote text-apple-gray-700">
              {slice.label}: {slice.count} ({slice.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
      
      {/* Show abstain count separately if there are any */}
      {abstain > 0 && (
        <div className="text-apple-footnote text-apple-gray-500 mt-2">
          Abstain votes: {abstain}
        </div>
      )}
    </div>
  );
};

export default function VoteSummary({ showBreakdown = true }: VoteSummaryProps) {
  const { votes, setVotes } = useAdminVotingContext();

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

      {/* Pie Chart */}
      <div className="mb-6">
        <PieChart yes={yes} no={no} abstain={abstain} total={total} />
      </div>

      {showBreakdown && (
        <div className="mt-3 space-y-3">
          {/* Yes/No breakdown - main focus */}
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
          
          {/* Abstain count - separate and less prominent */}
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