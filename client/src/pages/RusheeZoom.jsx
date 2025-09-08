import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import dayjs from 'dayjs';

import Navbar from "../components/Navbar";
import { verifyUser } from "../js/verifications";
import Loader from "../components/Loader";
import CommentWarning from "../components/CommentWarning";
import { validateComment, generateWarnings } from "../js/speculativeWordBank";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { FaEdit, FaTrash } from "react-icons/fa";
import Badges from "../components/Badge";


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
    const [ratings, setRatings] = useState({
        "Why AKPsi": null,
        "1:1 Interactions": null,
        "Group Interactions": null,
        "Professionalism": null,
    });

    const navigate = useNavigate();

    const api = import.meta.env.VITE_API_PREFIX;

    // Function to assign rushee ID based on GTID
    const getRusheeId = (gtid) => {
        // Use the last 4 digits of GTID as the rushee ID, preserving leading zeros
        return gtid.slice(-4);
    };

    // Check if user is in bid committee mode
    const isBidCommitteeMode = () => {
        return location.pathname.includes('/bid-committee') || 
               location.search.includes('bid_committee=true') ||
               document.referrer.includes('/bid-committee');
    };

    const ratingFields = [
        "Why AKPsi",
        "1:1 Interactions",
        "Group Interactions",
        "Professionalism",
    ];

    // Function to check if current user has already posted a comment
    const hasUserPostedComment = () => {
        if (!rushee || !user) return false;
        const currentUserName = user.firstname + " " + user.lastname;
        return rushee.comments.some(comment => comment.brother_name === currentUserName);
    };

    useEffect(() => {

        async function fetch() {

            await verifyUser()
                .then(async (response) => {

                    if (response == false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }

                    await axios.get(`${api}/rushee/${gtid}`)
                        .then((response) => {

                            if (response.data.status === "success") {

                                console.log(response.data.payload);
                                setRushee(response.data.payload);

                            } else {

                                navigate(`/error/${errorTitle}/${"Rushee with this GTID does not exist"}`);
                            }

                        });

                })
                .catch((error) => {

                    setError(true);
                    navigate(`/error/${errorTitle}/${errorDescription}`);

                });

            setLoading(false);

        }

        if (loading == true) {
            fetch();
        }

    });

    const handleAddComment = () => {
        setIsAddingComment(true);
        setCommentWarnings([]);
    };

    const handleRatingChange = (field, value) => {
        setRatings({
            ...ratings,
            [field]: value,
        });
    };

    const validateNewComment = (commentText) => {
        if (!rushee) return;
        
        const validationResult = validateComment(commentText, rushee.first_name, rushee.last_name);
        const warnings = generateWarnings(validationResult);
        setCommentWarnings(warnings);
    };

    const validateEditComment = (commentText) => {
        if (!rushee) return;
        
        const validationResult = validateComment(commentText, rushee.first_name, rushee.last_name);
        const warnings = generateWarnings(validationResult);
        setEditCommentWarnings(warnings);
    };

    const handleSubmitComment = async () => {
        // Validate comment before submission
        if (!rushee) return;
        
        const validationResult = validateComment(newComment, rushee.first_name, rushee.last_name);
        
        if (validationResult.hasWarnings) {
            const warnings = generateWarnings(validationResult);
            setCommentWarnings(warnings);
            
            // Show warning toast but allow submission
            toast.warning("Comment contains potentially problematic language. Please review before submitting.", {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
        }

        setLoading(true)

        const actualRatings = []

        for (const rating in ratings) {
            if (ratings[rating] != null) {
                actualRatings.push({
                    name: rating,
                    value: parseInt(ratings[rating])
                })
            }
        }

        const payload = {
            brother_id: "000000",
            brother_name: user.firstname + " " + user.lastname,
            comment: newComment,
            ratings: actualRatings,
        }

        console.log(user)

        await axios.post(`${api}/rushee/post-comment/${gtid}`, payload)
            .then((response) => {

                if (response.data.status === "success") {

                    window.location.reload();

                } else {

                    const title = "Uh Oh! Something weird happened..."
                    const description = "Something odd happened while submitting your comment..."

                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });

                }

            })
            .catch((error) => {

                console.log(error)

                const title = "Uh Oh! Something weird happened..."
                const description = "Some network error happened while submitting your comment..."

                navigate(`/error/${title}/${description}`)

            })

        // Reset the form after submission
        setNewComment("");
        setCommentWarnings([]);
        setRatings({
            "Professionalism": null,
            "Goatedness": null,
            "Awesomeness": null,
            "Eye Contact": null,
        });
        setIsAddingComment(false);
        setLoading(false)
    };

    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(`https://www.gtakpsi-rush.com/rushee/${gtid}/${rushee.access_code}`).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset the copied state after 2 seconds
        });
    };

    const handleEditComment = (comment) => {
        setEditingCommentId(comment.comment); // Track the comment being edited
        setEditedCommentText(comment.comment); // Pre-populate with the existing comment text
        setEditCommentWarnings([]); // Clear previous warnings
    };

    const handleSubmitEdit = async (comment) => {

        console.log(comment)

        // Validate edited comment before submission
        if (!rushee) return;
        
        const validationResult = validateComment(editedCommentText, rushee.first_name, rushee.last_name);
        
        if (validationResult.hasWarnings) {
            const warnings = generateWarnings(validationResult);
            setEditCommentWarnings(warnings);
            
            // Show warning toast but allow submission
            toast.warning("Edited comment contains potentially problematic language. Please review before submitting.", {
                position: "top-center",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
                theme: "dark",
            });
        }

        setLoading(true)
        const payload = {
            brother_id: "000000",
            brother_name: comment.brother_name,
            comment: editedCommentText,
            ratings: comment.ratings,
            night: comment.night,
        }

        await axios.post(`${api}/rushee/edit-comment/${gtid}`, payload)
            .then((response) => {

                if (response.data.status === "success") {

                    window.location.reload();
                    // console.log("worked")

                } else {

                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });

                }

            })
            .catch((err) => {

                console.log(error)
                toast.error(`Some network error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });

            })

        setEditingCommentId(null); // Reset editing state
        setEditedCommentText("");
        setEditCommentWarnings([]); // Clear warnings
        setLoading(false)

    }

    const handleDeleteComment = async (comment) => {

        setLoading(true)

        await axios.post(`${api}/rushee/delete-comment/${gtid}`, comment)
            .then((response) => {

                if (response.data.status === "success") {
                    window.location.reload();
                } else {
                    toast.error(`${response.data.message}`, {
                        position: "top-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "dark",
                    });
                }

            })
            .catch((error) => {

                console.log(error)

                toast.error(`Some network error occurred`, {
                    position: "top-center",
                    autoClose: 5000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    progress: undefined,
                    theme: "dark",
                });
            })

        setLoading(false)

    }

    return (
        <div>
            {loading ? (
                <Loader />
            ) : (
                <div>
                    <div className="min-h-screen w-full bg-white">

                        {/* Modal for Zoomed-In Comment */}
                        {selectedComment && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                                onClick={() => setSelectedComment(null)} // close if user clicks backdrop
                            >
                                {/* Modal inner box, stops click propagation */}
                                <div
                                    className="card-apple p-6 w-11/12 max-w-2xl transform scale-100 transition-transform duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Close button */}
                                    <button
                                        className="text-apple-gray-600 hover:text-black float-right text-2xl font-light focus:outline-none"
                                        onClick={() => setSelectedComment(null)}
                                    >
                                        ×
                                    </button>

                                    {/* Modal Content */}
                                    <h3 className="text-apple-title1 font-light mb-4 text-black clear-right">
                                        Comment from <span className="font-normal text-black">{selectedComment.brother_name}</span>
                                    </h3>
                                    <p className="text-apple-body text-black font-light mb-6 leading-relaxed">{selectedComment.comment}</p>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        {selectedComment.ratings.map((rating, rIdx) => (
                                            <span
                                                key={rIdx}
                                                className="bg-apple-gray-100 text-apple-gray-700 px-2 py-1 rounded-apple text-apple-footnote font-light"
                                            >
                                                {rating.name}: {rating.value == 5 ? "Satisfactory" : "Unsatisfactory"}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal for Zoomed-In PIS View */}
                        {selectedPis && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                                onClick={() => setSelectedPis(null)} // close if user clicks backdrop
                            >
                                {/* This inner box stops clicks from propagating to backdrop */}
                                <div
                                    className="card-apple p-6 w-11/12 max-w-2xl transform scale-100 transition-transform duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {/* Close button */}
                                    <button
                                        className="text-apple-gray-600 hover:text-black float-right text-2xl font-light focus:outline-none"
                                        onClick={() => setSelectedPis(null)}
                                    >
                                        ×
                                    </button>

                                    {/* Modal content */}
                                    <div className="clear-right">
                                        <h3 className="text-apple-title2 font-normal text-apple-gray-700 mt-2">Question:</h3>
                                        <p className="text-apple-body text-black font-light mb-6 leading-relaxed">{selectedPis.question}</p>

                                        <h3 className="text-apple-title2 font-normal text-apple-gray-700">Answer:</h3>
                                        <p className="text-apple-body text-black font-light leading-relaxed">{selectedPis.answer}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Navbar />
                        
                        <div className="pt-24 p-4 pb-20">
                            <div className="container mx-auto px-4 max-w-4xl">
                                {/* Profile Header */}
                                <div className="card-apple p-6 mb-6">
                                    <div className="flex flex-col md:flex-row items-start gap-6">
                                        {isBidCommitteeMode() ? (
                                            // Bid Committee Mode - Show numbered placeholder
                                            <div className="w-60 h-60 bg-apple-gray-100 rounded-apple-2xl border border-apple-gray-200 flex items-center justify-center shrink-0">
                                                <span className="text-6xl font-light text-black">
                                                    {getRusheeId(rushee.gtid)}
                                                </span>
                                            </div>
                                        ) : (
                                            // Normal Mode - Show actual photo
                                            <img
                                                src={rushee.image_url}
                                                alt={`${rushee.first_name} ${rushee.last_name}`}
                                                className="w-60 h-60 rounded-apple-2xl object-cover border border-apple-gray-200 shrink-0"
                                            />
                                        )}
                                        <div className="flex-1">
                                            <div className="flex flex-col sm:flex-row gap-3 items-start mb-4">
                                                {isBidCommitteeMode() ? (
                                                    <h1 className="text-apple-large font-light text-black">
                                                        Rushee #{getRusheeId(rushee.gtid)}
                                                    </h1>
                                                ) : (
                                                    <h1 className="text-apple-large font-light text-black">
                                                        {rushee.first_name} {rushee.last_name}
                                                    </h1>
                                                )}
                                                <div className="flex flex-wrap gap-2">
                                                    {rushee.attendance.map((event, idx) => (
                                                        <Badges text={event.name} key={idx} />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-apple-body">
                                                {!isBidCommitteeMode() && (
                                                    <>
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">Pronouns:</span> {rushee.pronouns}
                                                        </p>
                                                        <p className="text-apple-gray-600 font-light">
                                                            <span className="text-black font-normal">Email:</span> {rushee.email}
                                                        </p>
                                                    </>
                                                )}
                                                <p className="text-apple-gray-600 font-light">
                                                    <span className="text-black font-normal">Major:</span> {rushee.major}
                                                </p>
                                                <p className="text-apple-gray-600 font-light">
                                                    <span className="text-black font-normal">Class:</span> {rushee.class}
                                                </p>
                                                {!isBidCommitteeMode() && (
                                                    <p className="text-apple-gray-600 font-light">
                                                        <span className="text-black font-normal">Housing:</span> {rushee.housing}
                                                    </p>
                                                )}
                                                <p className="text-apple-gray-600 font-light">
                                                    <span className="text-black font-normal">GTID:</span> {rushee.gtid}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

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

                                {/* Ratings */}
                                <div className="card-apple p-6 mb-6">
                                    <h2 className="text-apple-title1 font-light text-black mb-4">Ratings</h2>

                                    <div className="flex flex-col gap-4">
                                        {rushee.ratings.map((rating, idx) => (
                                            <div key={idx} className="w-full">
                                                <p className="text-apple-body text-black font-normal mb-2">{rating.name}</p>
                                                <div className="w-full bg-apple-gray-100 rounded-apple h-3">
                                                    <div
                                                        className="bg-black h-3 rounded-apple transition-all duration-300"
                                                        style={{ width: `${(rating.value / 5) * 100}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-apple-footnote text-apple-gray-600 font-light mt-1">{`${((rating.value / 5) * 100).toFixed(0)}%`}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* PIS Responses */}
                                <div className="card-apple p-6 mb-6 max-h-[40rem] overflow-y-auto">
                                    <h2 className="text-apple-title1 font-light text-black mb-4">PIS Details</h2>

                                    <div className="space-y-3 mb-6 text-apple-body">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🕒</span>
                                            <span className="text-apple-gray-600 font-light">
                                                <span className="text-black font-normal">Timeslot:</span>{" "}
                                                {dayjs(parseInt(rushee.pis_timeslot.$date.$numberLong)).format('ddd, DD MMM YYYY HH:mm:ss')}
                                            </span>
                                        </div>
                                        <p className="text-apple-gray-600 font-light">
                                            <span className="text-black font-normal">Brother 1:</span> {rushee.pis_signup.first_brother_first_name} {rushee.pis_signup.first_brother_last_name}
                                        </p>
                                        <p className="text-apple-gray-600 font-light">
                                            <span className="text-black font-normal">Brother 2:</span> {rushee.pis_signup.second_brother_first_name} {rushee.pis_signup.second_brother_last_name}
                                        </p>
                                        <p className="text-apple-gray-600 font-light">
                                            <span className="text-black font-normal">Brother 3:</span> {rushee.pis_signup.third_brother_first_name} {rushee.pis_signup.third_brother_last_name}
                                        </p>
                                    </div>

                                    {/* PIS Responses Section */}
                                    <div className="border-t border-apple-gray-200 pt-6">
                                        <h3 className="text-apple-title2 font-normal text-black mb-4">PIS Responses</h3>
                                        <div className="space-y-4">
                                            {rushee.pis.map((pis, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-apple-gray-50 border border-apple-gray-200 p-4 rounded-apple hover:bg-apple-gray-100 cursor-pointer transition-all duration-200"
                                                    onClick={() => setSelectedPis(pis)}
                                                >
                                                    <p className="text-apple-body text-black font-light mb-2">
                                                        <span className="font-normal text-apple-gray-700">Q:</span> {pis.question}
                                                    </p>
                                                    <p className="text-apple-body text-black font-light">
                                                        <span className="font-normal text-apple-gray-700">A:</span> {pis.answer}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Brothers who wrote comments */}
                                {hasUserPostedComment() && (
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

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                                {ratingFields.map((field) => (
                                                    <div key={field}>
                                                        <label
                                                            htmlFor={field}
                                                            className="block text-apple-body font-normal text-apple-gray-700 mb-2"
                                                        >
                                                            {field}
                                                        </label>
                                                        <select
                                                            id={field}
                                                            className="input-apple text-apple-footnote"
                                                            value={ratings[field] || ""}
                                                            onChange={(e) =>
                                                                handleRatingChange(field, e.target.value)
                                                            }
                                                        >
                                                            <option value="" disabled>
                                                                Not Seen
                                                            </option>
                                                            <option value={5}>Satisfactory</option>
                                                            <option value={0}>Unsatisfactory</option>
                                                        </select>
                                                    </div>
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
                                    
                                    {/* Show comments only if user has posted their own comment */}
                                    {hasUserPostedComment() && (
                                        <div className="mt-6 space-y-4">
                                            {rushee.comments.map((comment, idx) => (
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
                                                                {rating.name}: {rating.value == 5 ? "Satisfactory" : "Unsatisfactory"}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Show message if user hasn't posted a comment yet */}
                                    {!hasUserPostedComment() && (
                                        <div className="mt-6 p-6 bg-apple-gray-50 border border-apple-gray-200 rounded-apple text-center">
                                            <p className="text-apple-body text-apple-gray-600 font-light">
                                                Post your first comment to see other brothers' comments.
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