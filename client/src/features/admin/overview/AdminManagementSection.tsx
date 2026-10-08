import type { ComponentProps } from 'react';

import PisQuestionsCard from '../pis/PisQuestionsCard';
import ReschedulePisCard from '../pis/ReschedulePisCard';
import AdminSchedulingCards from '../scheduling/AdminSchedulingCards';

type AdminManagementSectionProps =
    ComponentProps<typeof PisQuestionsCard> &
    ComponentProps<typeof AdminSchedulingCards> &
    ComponentProps<typeof ReschedulePisCard>;

// Group PIS questions, scheduling, and rushee rescheduling controls.
export default function AdminManagementSection(props: AdminManagementSectionProps) {
    const {
        question, setQuestion, questionType, setQuestionType, questionOrder,
        setQuestionOrder, questionCategory, setQuestionCategory, handleRequest,
        fetchPisQuestions, pisQuestions, pisQuestionsLoading, categoryEdits,
        setCategoryEdits, saveQuestionCategory, timeslotTime, setTimeslotTime,
        timeslotChange, setTimeslotChange, rushNightName, setRushNightName,
        rushNightTime, setRushNightTime, rusheeSearch, setRusheeSearch,
        selectedRushee, setSelectedRushee, filteredRushees, handleSelectRushee,
        formatCurrentPISTime, selectedNewTimeslot, setSelectedNewTimeslot,
        availableTimeslots, formatTimeslot, handleReschedulePIS,
    } = props;

    return (
        <div>
            <h2 className="text-apple-title2 font-normal text-black mb-4">Manage Data</h2>

            <div className="space-y-6">
                <PisQuestionsCard
                    question={question}
                    setQuestion={setQuestion}
                    questionType={questionType}
                    setQuestionType={setQuestionType}
                    questionOrder={questionOrder}
                    setQuestionOrder={setQuestionOrder}
                    questionCategory={questionCategory}
                    setQuestionCategory={setQuestionCategory}
                    handleRequest={handleRequest}
                    fetchPisQuestions={fetchPisQuestions}
                    pisQuestions={pisQuestions}
                    pisQuestionsLoading={pisQuestionsLoading}
                    categoryEdits={categoryEdits}
                    setCategoryEdits={setCategoryEdits}
                    saveQuestionCategory={saveQuestionCategory}
                />

                <AdminSchedulingCards
                    timeslotTime={timeslotTime}
                    setTimeslotTime={setTimeslotTime}
                    timeslotChange={timeslotChange}
                    setTimeslotChange={setTimeslotChange}
                    rushNightName={rushNightName}
                    setRushNightName={setRushNightName}
                    rushNightTime={rushNightTime}
                    setRushNightTime={setRushNightTime}
                    handleRequest={handleRequest}
                />

                <ReschedulePisCard
                    rusheeSearch={rusheeSearch}
                    setRusheeSearch={setRusheeSearch}
                    selectedRushee={selectedRushee}
                    setSelectedRushee={setSelectedRushee}
                    filteredRushees={filteredRushees}
                    handleSelectRushee={handleSelectRushee}
                    formatCurrentPISTime={formatCurrentPISTime}
                    selectedNewTimeslot={selectedNewTimeslot}
                    setSelectedNewTimeslot={setSelectedNewTimeslot}
                    availableTimeslots={availableTimeslots}
                    formatTimeslot={formatTimeslot}
                    handleReschedulePIS={handleReschedulePIS}
                />
            </div>
        </div>
    );
}
