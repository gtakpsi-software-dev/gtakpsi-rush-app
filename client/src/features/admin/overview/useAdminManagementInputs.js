import { useEffect, useRef, useState } from "react";
import { createQuestionActions } from "../pis/questionActions";

/**
 * Management Input Summary:
 * - Keeps question and scheduling form state with the actions that use it.
 * - Registers question loading after the page's bootstrap effect, preserving request order.
 * - Existing question-action and admin-page fixtures pin the resulting contracts.
 */
export default function useAdminManagementInputs({ apiBase, axios, toast }) {
    const [question, setQuestion] = useState("");
    const [questionType, setQuestionType] = useState("");
    const [questionOrder, setQuestionOrder] = useState("");
    const [questionCategory, setQuestionCategory] = useState("");
    const [pisQuestions, setPisQuestions] = useState([]);
    const [pisQuestionsLoading, setPisQuestionsLoading] = useState(false);
    const [categoryEdits, setCategoryEdits] = useState({});
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [rushNightName, setRushNightName] = useState("");
    const [rushNightTime, setRushNightTime] = useState("");

    const { fetchPisQuestions, saveQuestionCategory } = createQuestionActions({
        apiBase,
        categoryEdits,
        setPisQuestions,
        setPisQuestionsLoading,
        axios,
        toast,
    });

    // Keep the mount-only request bound to its first render as category edits change.
    const initialFetchPisQuestions = useRef(fetchPisQuestions);
    useEffect(() => {
        initialFetchPisQuestions.current();
    }, []);

    return {
        question,
        setQuestion,
        questionType,
        setQuestionType,
        questionOrder,
        setQuestionOrder,
        questionCategory,
        setQuestionCategory,
        pisQuestions,
        pisQuestionsLoading,
        categoryEdits,
        setCategoryEdits,
        timeslotTime,
        setTimeslotTime,
        timeslotChange,
        setTimeslotChange,
        rushNightName,
        setRushNightName,
        rushNightTime,
        setRushNightTime,
        fetchPisQuestions,
        saveQuestionCategory,
    };
}
