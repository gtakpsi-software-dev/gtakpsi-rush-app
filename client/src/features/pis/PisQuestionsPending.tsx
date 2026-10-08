import Navbar from "../../components/Navbar";

type Props = {
    questions: { question: string }[];
    revealAt: Date | null;
};

// Display the question unlock time and fixed questions available before reveal.
export default function PisQuestionsPending({ questions, revealAt }: Props) {
    return (
        <div className="min-h-screen w-full bg-white overflow-y-auto">
            <Navbar />
            <div className="pt-24 p-4 flex flex-col items-center justify-center text-center">
                <div className="max-w-md">
                    <h1 className="text-apple-title2 font-normal text-black mb-3">
                        Interview questions are not ready yet
                    </h1>
                    <p className="text-apple-body text-apple-gray-500 mb-6">
                        This rushee&apos;s randomized interview questions unlock 5 minutes before their PIS. You can still see the fixed questions below in the meantime.
                    </p>
                    <div className="text-2xl font-light text-black mb-8">
                        {revealAt
                            ? `Unlocks at ${revealAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                            : "Unlocks 5 minutes before PIS"}
                    </div>
                    {questions.length > 0 && (
                        <div className="text-left bg-apple-gray-50 rounded-apple-xl p-5 space-y-3">
                            <h2 className="text-apple-headline font-normal text-black mb-2">Available now</h2>
                            {questions.map(/* Display an already-available interview question. */ (q, idx) => (
                                <p key={idx} className="text-apple-body text-apple-gray-700">{q.question}</p>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
