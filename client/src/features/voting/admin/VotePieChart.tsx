type VotePieChartProps = {
  yes: number;
  no: number;
  abstain: number;
};

// Display a Yes/No pie chart with abstentions reported outside the percentage denominator.
export default function VotePieChart({ yes, no, abstain }: VotePieChartProps) {
  // Abstentions remain outside the chart denominator and its percentages.
  const yesNoTotal = yes + no;

  if (yesNoTotal === 0) {
    return (
      <div className="w-48 h-48 mx-auto flex items-center justify-center bg-apple-gray-100 rounded-full border">
        <span className="text-apple-gray-500 text-apple-footnote">No Yes/No votes yet</span>
      </div>
    );
  }

  const yesPercentage = (yes / yesNoTotal) * 100;
  const noPercentage = (no / yesNoTotal) * 100;

  // Build the conic gradient for the nonzero Yes and No vote slices.
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

      <div className="flex flex-wrap justify-center gap-4">
        {slices.map(/* Render a vote-slice legend with count and percentage. */ (slice, index) => (
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

      {abstain > 0 && (
        <div className="text-apple-footnote text-apple-gray-500 mt-2">
          Abstain votes: {abstain}
        </div>
      )}
    </div>
  );
}
