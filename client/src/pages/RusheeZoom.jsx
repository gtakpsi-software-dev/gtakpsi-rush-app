import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import Navbar from "../components/Navbar";
import { verifyUser } from "../js/verifications";
import { loadRusheeZoom } from "../features/rushee/zoom/loadRusheeZoom";
import { createCommentCreateActions } from "../features/rushee/zoom/commentCreateActions";
import { createExistingCommentActions } from "../features/rushee/zoom/existingCommentActions";
import ZoomModals from "../features/rushee/zoom/ZoomModals";
import RusheeProfileHeader from "../features/rushee/zoom/RusheeProfileHeader";
import RusheeRatings from "../features/rushee/zoom/RusheeRatings";
import RusheePisDetails from "../features/rushee/zoom/RusheePisDetails";
import ExistingCommentList from "../features/rushee/zoom/ExistingCommentList";
import NewCommentForm from "../features/rushee/zoom/NewCommentForm";
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
    const [errorTitle, setErrorTitle] = useState("Uh Oh! Something untoward happened");
    const [errorDescription, setErrorDescription] = useState("Something really weird happened");
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
                                    <div className="card-apple p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <button 
                                            onClick={() => navigate(`/pis/${gtid}`)}
                                            className="btn-apple px-6 py-4 text-apple-headline font-light"
                                        >
                                            Submit PIS
                                        </button>
                                        <button 
                                            onClick={handleCopy} 
                                            className="btn-apple-secondary px-6 py-4 text-apple-headline font-light"
                                        >
                                            {copied ? "Link Copied!" : "Copy Edit Page Link"}
                                        </button>
                                    </div>
                                )}

                                <RusheeRatings rushee={rushee} showAllComments={showAllComments} />

                                <RusheePisDetails rushee={rushee} setSelectedPis={setSelectedPis} />

                                {showAllComments && rushee.comments.length > 0 && (
                                    <div className="card-apple p-6 mb-6">
                                        <h2 className="text-apple-title1 font-light text-black mb-4">
                                            Brothers Who Commented
                                        </h2>
                                        <div className="flex flex-wrap gap-2">
                                            {rushee.comments.map((comment, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-apple-gray-100 text-apple-gray-700 px-3 py-2 rounded-apple hover:bg-apple-gray-200 cursor-pointer transform transition-all duration-200 ease-in-out hover:scale-105 text-apple-footnote font-light"
                                                >
                                                    {comment.brother_name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="card-apple p-6 mb-6">
                                    <h2 className="text-apple-title1 font-light text-black mb-4">
                                        Comments
                                    </h2>
                                    <NewCommentForm
                                        isAddingComment={isAddingComment}
                                        handleAddComment={handleAddComment}
                                        newComment={newComment}
                                        setNewComment={setNewComment}
                                        validateNewComment={validateNewComment}
                                        commentWarnings={commentWarnings}
                                        setCommentWarnings={setCommentWarnings}
                                        ratingFields={ratingFields}
                                        ratings={ratings}
                                        ratingNotSeen={ratingNotSeen}
                                        handleRatingChange={handleRatingChange}
                                        handleRatingNotSeenChange={handleRatingNotSeenChange}
                                        handleSubmitComment={handleSubmitComment}
                                    />

                                    <ExistingCommentList
                                        visibleComments={visibleComments}
                                        user={user}
                                        editingCommentId={editingCommentId}
                                        editedCommentText={editedCommentText}
                                        setSelectedComment={setSelectedComment}
                                        handleEditComment={handleEditComment}
                                        handleDeleteComment={handleDeleteComment}
                                        setEditedCommentText={setEditedCommentText}
                                        validateEditComment={validateEditComment}
                                        editCommentWarnings={editCommentWarnings}
                                        setEditCommentWarnings={setEditCommentWarnings}
                                        handleSubmitEdit={handleSubmitEdit}
                                    />

                                    {requireCommentToView && !isAdmin && !isBidcom && !userHasOwnComment && (
                                        <div className="mt-6 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple text-center">
                                            <p className="text-apple-body text-apple-gray-600 font-light">
                                                Post your comment to save your ratings and notes. You won't see other brothers' comments.
                                            </p>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );

}
