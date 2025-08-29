import React from "react";
import { useAdminVotingContext } from "./AdminVotingContext";
import { FaSync } from "react-icons/fa";
import axios from "axios";
import { toast } from "react-toastify";

interface VoteSummaryProps {
  showBreakdown?: boolean;
}

// Simple CSS-based Pie Chart Component
const PieChart = ({ yes, no, abstain, total }: { yes: number; no: number; abstain: number; total: number }) => {
  if (total === 0) {
    return (
      <div className="w-48 h-48 mx-auto flex items-center justify-center bg-apple-gray-100 rounded-full border">
        <span className="text-apple-gray-500 text-apple-footnote">No votes yet</span>
      </div>
    );
  }

  const yesPercentage = (yes / total) * 100;
  const noPercentage = (no / total) * 100;
  const abstainPercentage = (abstain / total) * 100;

  // Using conic-gradient for a simpler implementation
  const generateGradient = () => {
    let gradient = "conic-gradient(";
    let currentPercentage = 0;
    
    if (yes > 0) {
      gradient += `#22c55e 0% ${yesPercentage}%`;
      currentPercentage = yesPercentage;
    }
    
    if (no > 0) {
      if (currentPercentage > 0) gradient += ", ";
      gradient += `#ef4444 ${currentPercentage}% ${currentPercentage + noPercentage}%`;
      currentPercentage += noPercentage;
    }
    
    if (abstain > 0) {
      if (currentPercentage > 0) gradient += ", ";
      gradient += `#f59e0b ${currentPercentage}% 100%`;
    }
    
    gradient += ")";
    return gradient;
  };

  const slices = [];
  if (yes > 0) slices.push({ label: "Yes", count: yes, percentage: yesPercentage, color: "#22c55e" });
  if (no > 0) slices.push({ label: "No", count: no, percentage: noPercentage, color: "#ef4444" });
  if (abstain > 0) slices.push({ label: "Abstain", count: abstain, percentage: abstainPercentage, color: "#f59e0b" });

  console.log("Pie chart data:", { yes, no, abstain, total, gradient: generateGradient() });

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
                axios.post(`${api}/admin/voting/clear-votes`),
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
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="bg-green-100 text-green-800 rounded-apple px-4 py-2 text-center">
            <p className="text-apple-footnote font-medium">Yes</p>
            <p className="text-apple-title3 font-semibold">{yes}</p>
          </div>
          <div className="bg-red-100 text-red-800 rounded-apple px-4 py-2 text-center">
            <p className="text-apple-footnote font-medium">No</p>
            <p className="text-apple-title3 font-semibold">{no}</p>
          </div>
          <div className="bg-yellow-100 text-yellow-800 rounded-apple px-4 py-2 text-center">
            <p className="text-apple-footnote font-medium">Abstain</p>
            <p className="text-apple-title3 font-semibold">{abstain}</p>
          </div>
        </div>
      )}
    </div>
  );
}