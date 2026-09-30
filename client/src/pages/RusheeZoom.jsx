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
import Loader from "../components/Loader";
import { auth } from "../firebase";
import CommentWarning from "../components/CommentWarning";
import { validateComment, generateWarnings } from "../js/speculativeWordBank";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { FaEdit, FaTrash } from "react-icons/fa";
import Badges from "../components/Badge";
import RatingSlider from "../components/RatingSlider";
import { formatRatingValue } from "../js/ratingDisplay";
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
    const [requireCommentToView, setRequireCommentToView] = useState(true); // Default to existing behavior

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    // Get rushee number from URL query params (passed from bid committee dashboard)
    const getRusheeNumber = () => {
        const params = new URLSearchParams(location.search);
        return params.get('rushee_num') || '---';
    };

    // Check if user is in bid committee mode
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
            setTimeout(() => setCopied(false), 2000); // Reset the copied state after 2 seconds
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

                                {/* Section: Brothers who wrote comments (admins/bidcom/unrestricted only) */}
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

                                {/* Comments */}
                                <div className="card-apple p-6 mb-6">
                                    <h2 className="text-apple-title1 font-light text-black mb-4">
                                        Comments
                                    </h2>
                                    {!isAddingComment ? (
                                        <div
                                            onClick={handleAddComment}
                                            className="border-2 border-dashed border-apple-gray-300 p-8 rounded-apple cursor-pointer flex items-center justify-center hover:bg-apple-gray-50 hover:border-apple-gray-400 transition-all duration-300"
                                        >
                                            <span className="text-3xl text-apple-gray-400 font-light">+</span>
                                        </div>
                                    ) : (
                                        <div className="bg-apple-gray-50 border border-apple-gray-200 p-6 rounded-apple">
                                            <textarea
                                                className="input-apple mb-4 resize-none min-h-[120px]"
                                                placeholder="Add your comment..."
                                                value={newComment}
                                                onChange={(e) => {
                                                    setNewComment(e.target.value);
                                                    validateNewComment(e.target.value);
                                                }}
                                            ></textarea>
                                            
                                            <CommentWarning 
                                                warnings={commentWarnings} 
                                                onDismiss={(index) => {
                                                    const newWarnings = commentWarnings.filter((_, i) => i !== index);
                                                    setCommentWarnings(newWarnings);
                                                }}
                                            />

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                                                {ratingFields.map((field) => (
                                                    <RatingSlider
                                                        key={field}
                                                        label={field}
                                                        value={ratings[field]}
                                                        notSeen={ratingNotSeen[field]}
                                                        onValueChange={(value) => handleRatingChange(field, value)}
                                                        onNotSeenChange={(notSeen) => handleRatingNotSeenChange(field, notSeen)}
                                                    />
                                                ))}
                                            </div>

                                            <button
                                                onClick={handleSubmitComment}
                                                className="btn-apple px-6 py-3 text-apple-body font-light"
                                            >
                                                Submit Comment
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Visible comments (own only when restricted) */}
                                    {visibleComments.length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            {visibleComments.map((comment, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedComment(comment)}
                                                    className="relative bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple hover:bg-apple-gray-100 cursor-pointer transition-all duration-200"
                                                >
                                                    {/* Buttons in the top-right corner */}
                                                    <div
                                                        className={
                                                            user.firstname + " " + user.lastname === comment.brother_name &&
                                                                editingCommentId !== comment.comment
                                                                ? "absolute top-3 right-3 flex space-x-2"
                                                                : "hidden"
                                                        }
                                                    >
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditComment(comment);
                                                            }}
                                                            className="text-apple-gray-500 hover:text-black text-lg transition-colors"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteComment(comment);
                                                            }}
                                                            className="text-apple-gray-500 hover:text-red-600 text-lg transition-colors"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </div>

                                                    {/* Comment Content or Edit Field */}
                                                    {editingCommentId === comment.comment ? (
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <textarea
                                                                className="input-apple mb-4 resize-none min-h-[120px]"
                                                                value={editedCommentText}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => {
                                                                    setEditedCommentText(e.target.value);
                                                                    validateEditComment(e.target.value);
                                                                }}
                                                            ></textarea>
                                                            
                                                            <CommentWarning 
                                                                warnings={editCommentWarnings} 
                                                                onDismiss={(index) => {
                                                                    const newWarnings = editCommentWarnings.filter((_, i) => i !== index);
                                                                    setEditCommentWarnings(newWarnings);
                                                                }}
                                                            />
                                                            
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSubmitEdit(comment);
                                                                }}
                                                                className="btn-apple px-4 py-2 text-apple-footnote font-light"
                                                            >
                                                                Update Comment
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <Badges text={comment.night.name} />
                                                            </div>
                                                            <p className="text-apple-body text-black font-light leading-relaxed">
                                                                <span className="font-normal">{comment.brother_name}:</span> {comment.comment}
                                                            </p>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-apple-gray-200">
                                                        {comment.ratings.map((rating, rIdx) => (
                                                            <span
                                                                key={rIdx}
                                                                className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-footnote font-light"
                                                            >
                                                                {rating.name}: {formatRatingValue(rating.value)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Prompt when restricted and user hasn't commented yet */}
                                    {requireCommentToView && !isAdmin && !isBidcom && !userHasOwnComment && (
                                        <div className="mt-6 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple text-center">
                                            <p className="text-apple-body text-apple-gray-600 font-light">
                                                Post your comment to save your ratings and notes. You won't see other brothers' comments.
                                            </p>
                                        </div>
                                    )}
                                </div>

                            {/* Attendance */}
                            {/* <div className="card-apple p-6 mb-6">
                                <h2 className="text-apple-title1 font-light text-black mb-4">Attendance</h2>
                                {rushee.attendance.map((event, idx) => (
                                    <p key={idx} className="text-apple-body text-apple-gray-600 font-light">
                                        {event.name} - {event.date}
                                    </p>
                                ))}
                            </div> */}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );

}
