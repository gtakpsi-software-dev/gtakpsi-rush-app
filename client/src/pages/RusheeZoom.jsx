import { useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import { createCommentCreateActions } from "../features/rushee/zoom/commentCreateActions";
import { createExistingCommentActions } from "../features/rushee/zoom/existingCommentActions";
import useRusheeZoomAccess from "../features/rushee/zoom/useRusheeZoomAccess";
import RusheeZoomView from "../features/rushee/zoom/RusheeZoomView";
import {
    getRusheeNumber as getRusheeNumberFromSearch,
    isBidCommitteeMode as matchesBidCommitteeMode,
} from "../features/rushee/zoom/routeContext";
import Loader from "../components/Loader";
import { validateComment, generateWarnings } from "../features/comments/commentValidation";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


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
    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    const getRusheeNumber = () => getRusheeNumberFromSearch(location.search);
    const isBidCommitteeMode = () => matchesBidCommitteeMode(location, () => document.referrer);

    const ratingFields = RATING_FIELDS;

    const {
        isAdmin,
        isBidcom,
        requireCommentToView,
        showAllComments,
        visibleComments,
        userHasOwnComment,
    } = useRusheeZoomAccess({
        loading,
        navigate,
        errorTitle,
        errorDescription,
        api,
        gtid,
        rushee,
        user,
        setRushee,
        setError,
        setLoading,
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
                <RusheeZoomView
                    modals={{
                        selectedComment,
                        selectedPis,
                        onCloseComment: () => setSelectedComment(null),
                        onClosePis: () => setSelectedPis(null),
                    }}
                    profile={{ rushee, isBidCommitteeMode, getRusheeNumber }}
                    actions={{ gtid, copied, onSubmitPis: navigate, onCopyLink: handleCopy }}
                    ratings={{ rushee, showAllComments }}
                    pisDetails={{ rushee, setSelectedPis }}
                    comments={{
                        rusheeComments: rushee.comments,
                        showAllComments,
                        newCommentFormProps: {
                            isAddingComment, handleAddComment, newComment,
                            setNewComment, validateNewComment, commentWarnings,
                            setCommentWarnings, ratingFields, ratings, ratingNotSeen,
                            handleRatingChange, handleRatingNotSeenChange,
                            handleSubmitComment,
                        },
                        existingCommentListProps: {
                            visibleComments, user, editingCommentId, editedCommentText,
                            setSelectedComment, handleEditComment, handleDeleteComment,
                            setEditedCommentText, validateEditComment, editCommentWarnings,
                            setEditCommentWarnings, handleSubmitEdit,
                        },
                        showVisibilityNotice:
                            requireCommentToView && !isAdmin && !isBidcom && !userHasOwnComment,
                    }}
                    isBidCommitteeMode={isBidCommitteeMode}
                />
            )}
        </div>

    );

}
