import React from "react";
import { useAdminVotingContext } from "./AdminVotingContext";

export default function VotePieChart() {
  const { votes } = useAdminVotingContext();

  const yes = votes.filter((v) => v.vote === "Yes").length;
  const no = votes.filter((v) => v.vote === "No").length;
  const abstain = votes.filter((v) => v.vote === "Abstain").length;
  const total = votes.length;

  // Don't render if no votes
  if (total === 0) {
    return (
      <div className="relative rounded-apple shadow-md p-6 bg-gradient-to-br from-white via-apple-gray-50 to-apple-gray-100 border border-apple-gray-200">
        <h3 className="text-apple-title2 font-semibold text-black mb-4 tracking-tight">
          Vote Distribution
        </h3>
        <div className="flex items-center justify-center h-32 text-apple-gray-500">
          <p className="text-apple-body font-light">No votes yet</p>
        </div>
      </div>
    );
  }

  // Calculate angles for pie chart
  const yesAngle = (yes / total) * 360;
  const noAngle = (no / total) * 360;
  const abstainAngle = (abstain / total) * 360;

  // Calculate SVG path for pie slices
  const radius = 60;
  const centerX = 80;
  const centerY = 80;

  const createArc = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  let currentAngle = 0;
  const yesPath = createArc(currentAngle, currentAngle + yesAngle);
  currentAngle += yesAngle;
  const noPath = createArc(currentAngle, currentAngle + noAngle);
  currentAngle += noAngle;
  const abstainPath = createArc(currentAngle, currentAngle + abstainAngle);

  return (
    <div className="relative rounded-apple shadow-md p-6 bg-gradient-to-br from-white via-apple-gray-50 to-apple-gray-100 border border-apple-gray-200">
      <h3 className="text-apple-title2 font-semibold text-black mb-4 tracking-tight">
        Vote Distribution
      </h3>
      
      <div className="flex items-center justify-center space-x-8">
        {/* Pie Chart */}
        <div className="relative">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {/* Yes slice */}
            {yes > 0 && (
              <path
                d={yesPath}
                fill="#dcfce7"
                stroke="#16a34a"
                strokeWidth="2"
              />
            )}
            {/* No slice */}
            {no > 0 && (
              <path
                d={noPath}
                fill="#fee2e2"
                stroke="#dc2626"
                strokeWidth="2"
              />
            )}
            {/* Abstain slice */}
            {abstain > 0 && (
              <path
                d={abstainPath}
                fill="#fef3c7"
                stroke="#d97706"
                strokeWidth="2"
              />
            )}
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-apple-footnote font-medium text-apple-gray-600">Total</p>
              <p className="text-apple-title2 font-semibold text-black">{total}</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-green-100 border-2 border-green-600 rounded-full"></div>
            <div>
              <p className="text-apple-footnote font-medium text-black">Yes</p>
              <p className="text-apple-caption font-light text-apple-gray-600">{yes} votes ({yes > 0 ? Math.round((yes / total) * 100) : 0}%)</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-red-100 border-2 border-red-600 rounded-full"></div>
            <div>
              <p className="text-apple-footnote font-medium text-black">No</p>
              <p className="text-apple-caption font-light text-apple-gray-600">{no} votes ({no > 0 ? Math.round((no / total) * 100) : 0}%)</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-600 rounded-full"></div>
            <div>
              <p className="text-apple-footnote font-medium text-black">Abstain</p>
              <p className="text-apple-caption font-light text-apple-gray-600">{abstain} votes ({abstain > 0 ? Math.round((abstain / total) * 100) : 0}%)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
