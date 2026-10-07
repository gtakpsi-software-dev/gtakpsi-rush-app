import SplitText from "./SplitText";

const votingOptions = ["Yes", "No", "Abstain"];

type Props = {
    midtermMode: boolean;
    question: string | null;
    hasVoted: boolean;
    onVote: (vote: string) => void;
};

export default function QuestionBannerView({ midtermMode, question, hasVoted, onVote }: Props) {
    if (midtermMode) {
        return (
            <div className="relative flex flex-col h-full p-8 gap-6 overflow-hidden rounded-apple-xl bg-gradient-to-br from-apple-gray-100 via-white to-apple-gray-50 shadow-md">
                {Array.from({ length: 20 }).map((_, idx) => (
                    <span
                        key={idx}
                        className="absolute text-[20px] sm:text-[28px] text-apple-gray-700 opacity-30 animate-float pointer-events-none select-none"
                        style={{
                            top: `${Math.random() * 100}%`,
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`,
                            transform: `translate(-50%, -50%)`,
                        }}
                    >
                        ?
                    </span>
                ))}

                <div className="relative flex-1 flex items-center justify-center text-center">
                    <SplitText
                        key={question}
                        text={question ? question : "No Question Set"}
                        splitType="words"
                        className="text-4xl lg:text-5xl font-semibold text-black leading-tight"
                        duration={0.5}
                        delay={60}
                    />
                </div>

                <div className="relative flex-shrink-0 flex gap-4 justify-center">
                    {hasVoted ? (
                        <div className="flex items-center justify-center gap-3 w-full px-8 py-5 rounded-apple-xl bg-green-100 border border-green-200">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-green-800 font-semibold text-xl">Voted</span>
                        </div>
                    ) : (
                        votingOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => onVote(option)}
                                className="flex-1 py-5 rounded-apple-xl bg-apple-gray-100 hover:bg-apple-gray-200 active:scale-[0.97] transition text-apple-gray-800 font-semibold text-xl border border-apple-gray-200"
                            >
                                {option}
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full rounded-apple-xl overflow-hidden bg-gradient-to-br from-apple-gray-100 via-white to-apple-gray-50 shadow-md flex-shrink-0">
            {Array.from({ length: 8 }).map((_, idx) => (
                <span
                    key={idx}
                    className="absolute text-[20px] sm:text-[28px] text-apple-gray-700 opacity-30 animate-float pointer-events-none select-none"
                    style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 5}s`,
                        transform: `translate(-50%, -50%)`,
                    }}
                >
                    ?
                </span>
            ))}

            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-8">
                <SplitText
                    key={question}
                    text={question ? question : "No Question Set"}
                    splitType="words"
                    className="text-3xl sm:text-4xl font-semibold text-apple-gray-800 drop-shadow-sm"
                    duration={0.5}
                    delay={60}
                />

                <div className="flex gap-4 flex-shrink-0">
                    {hasVoted ? (
                        <div className="flex items-center gap-3 px-6 py-3 rounded-apple bg-green-100 border border-green-200">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <span className="text-green-800 font-semibold text-lg">
                                Voted
                            </span>
                        </div>
                    ) : (
                        votingOptions.map((option) => (
                            <button
                                key={option}
                                onClick={() => onVote(option)}
                                className="px-6 py-3 rounded-apple bg-apple-gray-200 hover:bg-apple-gray-300 active:scale-[0.97] transition text-apple-gray-800 font-semibold text-lg"
                            >
                                {option}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
