import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import Navbar from "../components/Navbar";
import { verifyUser } from "../features/auth/verifyUser";
import { loadRusheeZoom } from "../features/rushee/zoom/loadRusheeZoom";
import { createCommentCreateActions } from "../features/rushee/zoom/commentCreateActions";
import { createExistingCommentActions } from "../features/rushee/zoom/existingCommentActions";
import ZoomModals from "../features/rushee/zoom/ZoomModals";
import RusheeProfileHeader from "../features/rushee/zoom/RusheeProfileHeader";
import RusheeRatings from "../features/rushee/zoom/RusheeRatings";
import RusheePisDetails from "../features/rushee/zoom/RusheePisDetails";
import RusheeCommentsView from "../features/rushee/zoom/RusheeCommentsView";
import RusheeActions from "../features/rushee/zoom/RusheeActions";
import Loader from "../components/Loader";
import { auth } from "../firebase";
import { validateComment, generateWarnings } from "../js/speculativeWordBank";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
    getVisibleComments,
    hasOwnComment,
    shouldShowAllComments,
} from "../js/commentVisibility";

const RATING_FIELDS = [
    "Why AKPsi",
    "1:1 Interactions",
    "Group Interactions",
    "Professionalism",
];

const DEFAULT_RATING = 3;

function createDefaultRatings() {
    return Object.fromEntries(RATING_FIELDS.map((f) => [f, DEFAULT_RATING]));
}

function createDefaultNotSeen() {
    return Object.fromEntries(RATING_FIELDS.map((f) => [f, true]));
}

export default function RusheeZoom() {

    const { gtid } = useParams();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user'))

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [errorTitle] = useState("Uh Oh! Something untoward happened");
    const [errorDescription] = useState("Something really weird happened");
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editedCommentText, setEditedCommentText] = useState("");

    const [selectedPis, setSelectedPis] = useState(null);
    const [selectedComment, setSelectedComment] = useState(null);

    const [rushee, setRushee] = useState();
    const [isAddingComment, setIsAddingComment] = useState(false);
    const [newComment, setNewComment] = useState("");
    const [commentWarnings, setCommentWarnings] = useState([]);
    const [editCommentWarnings, setEditCommentWarnings] = useState([]);
    const [ratings, setRatings] = useState(createDefaultRatings);
    const [ratingNotSeen, setRatingNotSeen] = useState(createDefaultNotSeen);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isBidcom, setIsBidcom] = useState(false);
    // Keep comments restricted until the access settings finish loading.
    const [requireCommentToView, setRequireCommentToView] = useState(true);

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    const getRusheeNumber = () => {
        const params = new URLSearchParams(location.search);
        return params.get('rushee_num') || '---';
    };

    const isBidCommitteeMode = () => {
        return location.pathname.includes('/bid-committee') || 
               location.search.includes('bid_committee=true') ||
               document.referrer.includes('/bid-committee');
    };

    const ratingFields = RATING_FIELDS;

    const visibilityOptions = { requireCommentToView, isAdmin, isBidcom };
    const showAllComments = shouldShowAllComments(visibilityOptions);
    const visibleComments = rushee
        ? getVisibleComments(rushee.comments, user, visibilityOptions)
        : [];
    const userHasOwnComment = rushee ? hasOwnComment(rushee.comments, user) : false;

    useEffect(() => {
        async function fetch() {
            await loadRusheeZoom({
                verifyUser,
                navigate,
                errorTitle,
                errorDescription,
                auth,
                setIsAdmin,
                setIsBidcom,
                axios,
                api,
                gtid,
                setRushee,
                setRequireCommentToView,
                setError,
                setLoading,
                logError: (message, error) => console.error(message, error),
                logData: (value) => console.log(value),
            });
        }

        if (loading == true) {
            fetch();
        }
    });

    const {
        handleAddComment,
        handleRatingChange,
        handleRatingNotSeenChange,
        validateNewComment,
        handleSubmitComment,
    } = createCommentCreateActions({
        rushee,
        user,
        gtid,
        api,
        navigate,
        ratings,
        ratingNotSeen,
        newComment,
        ratingFields,
        setIsAddingComment,
        setCommentWarnings,
        setRatings,
        setRatingNotSeen,
        setLoading,
        setNewComment,
        createDefaultRatings,
        createDefaultNotSeen,
        validateComment,
        generateWarnings,
        toast,
        axios,
        reload: () => window.location.reload(),
        log: (value) => console.log(value),
    });

    const {
        validateEditComment,
        handleEditComment,
        handleSubmitEdit,
        handleDeleteComment,
    } = createExistingCommentActions({
        rushee,
        error,
        editedCommentText,
        gtid,
        api,
        setEditingCommentId,
        setEditedCommentText,
        setEditCommentWarnings,
        setLoading,
        validateComment,
        generateWarnings,
        toast,
        axios,
        reload: () => window.location.reload(),
        log: (value) => console.log(value),
    });

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`${window.location.origin}/rushee/${gtid}/${rushee.access_code}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div>
            {loading ? (
                <Loader />
            ) : (
                <div>
                    <div className="min-h-screen w-full bg-white">

                        <ZoomModals
                            selectedComment={selectedComment}
                            selectedPis={selectedPis}
                            onCloseComment={() => setSelectedComment(null)}
                            onClosePis={() => setSelectedPis(null)}
                        />

                        <Navbar />
                        
                        <div className="pt-24 p-4 pb-20">
                            <div className="container mx-auto px-4 max-w-4xl">
                                <RusheeProfileHeader
                                    rushee={rushee}
                                    isBidCommitteeMode={isBidCommitteeMode}
                                    getRusheeNumber={getRusheeNumber}
                                />

                                {!isBidCommitteeMode() && (
                                    <RusheeActions
                                        gtid={gtid}
                                        copied={copied}
                                        onSubmitPis={navigate}
                                        onCopyLink={handleCopy}
                                    />
                                )}

                                <RusheeRatings rushee={rushee} showAllComments={showAllComments} />

                                <RusheePisDetails rushee={rushee} setSelectedPis={setSelectedPis} />

                                <RusheeCommentsView
                                    rusheeComments={rushee.comments}
                                    showAllComments={showAllComments}
                                    newCommentFormProps={{
                                        isAddingComment, handleAddComment, newComment,
                                        setNewComment, validateNewComment, commentWarnings,
                                        setCommentWarnings, ratingFields, ratings, ratingNotSeen,
                                        handleRatingChange, handleRatingNotSeenChange,
                                        handleSubmitComment,
                                    }}
                                    existingCommentListProps={{
                                        visibleComments, user, editingCommentId, editedCommentText,
                                        setSelectedComment, handleEditComment, handleDeleteComment,
                                        setEditedCommentText, validateEditComment, editCommentWarnings,
                                        setEditCommentWarnings, handleSubmitEdit,
                                    }}
                                    showVisibilityNotice={
                                        requireCommentToView && !isAdmin && !isBidcom && !userHasOwnComment
                                    }
                                />

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );

}
