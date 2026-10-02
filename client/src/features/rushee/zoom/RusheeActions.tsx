type RusheeActionsProps = {
    gtid: string | undefined;
    copied: boolean;
    onSubmitPis: (path: string) => void;
    onCopyLink: () => void;
};

export default function RusheeActions({
    gtid,
    copied,
    onSubmitPis,
    onCopyLink,
}: RusheeActionsProps) {
    return (
        <div className="card-apple p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button
                onClick={() => onSubmitPis(`/pis/${gtid}`)}
                className="btn-apple px-6 py-4 text-apple-headline font-light"
            >
                Submit PIS
            </button>
            <button
                onClick={onCopyLink}
                className="btn-apple-secondary px-6 py-4 text-apple-headline font-light"
            >
                {copied ? "Link Copied!" : "Copy Edit Page Link"}
            </button>
        </div>
    );
}
