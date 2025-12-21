import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { verifyUser } from "../js/verifications";

export default function Admin() {
    const apiBase = import.meta.env.VITE_API_PREFIX + "/admin";

    const [question, setQuestion] = useState("");
    const [questionType, setQuestionType] = useState("");
    const [timeslotTime, setTimeslotTime] = useState("");
    const [timeslotChange, setTimeslotChange] = useState(1);
    const [rushNightName, setRushNightName] = useState("");
    const [rushNightTime, setRushNightTime] = useState("");
    const [results, setResults] = useState("");
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    const errorTitle = "Invalid User Credentials";
    const errorDescription = "If this is a mistake, try logging back in";

    useEffect(() => {

        async function fetch() {

            await verifyUser()
                .then(async (response) => {

                    if (response == false) {
                        navigate(`/error/${errorTitle}/${errorDescription}`);
                    }

                })
                .catch((error) => {

                    navigate(`/error/${errorTitle}/${errorDescription}`);

                });

            setLoading(false);

        }

        if (loading == true) {
            fetch();
        }

    });

    const handleRequest = async (endpoint, payload, method = "post") => {
        try {
          const updatedPayload = { ...payload };
      
          if (updatedPayload.time) {
            // Convert datetime-local value to UTC (ISO 8601 format)
            updatedPayload.time = new Date(updatedPayload.time).toISOString();
          }
      
          const response = await axios[method](`${apiBase}/${endpoint}`, updatedPayload);
          setResults(JSON.stringify(response.data, null, 2));
        } catch (error) {
          setResults(error.response?.data || "An error occurred");
        }
      };

    // Export Rushee Numbers CSV (for Bid Committee)
    const exportRusheeNumbers = async () => {
        try {
            const response = await axios.get(`${apiBase}/export-rushee-numbers`);
            
            if (response.data.status === "success") {
                const mappings = response.data.payload;
                
                // Create CSV content
                const csvHeaders = ["Rushee Number", "Name", "GTID"];
                const csvRows = [
                    csvHeaders.join(","),
                    ...mappings.map(m => `"${m.rushee_number}","${m.name}","${m.gtid}"`)
                ];
                
                // Create and download CSV
                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                
                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `Rushee_Numbers_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                setResults(`Successfully exported ${mappings.length} rushee number mappings to CSV`);
            } else {
                setResults("Error: Failed to fetch rushee numbers");
            }
        } catch (error) {
            console.error("Export error:", error);
            setResults(`Error exporting rushee numbers: ${error.message}`);
        }
    };

    const exportPISSchedule = async () => {
        try {
            const api = import.meta.env.VITE_API_PREFIX;
            const response = await axios.get(`${api}/rushee/get-timeslots`);
            
            if (response.data.status === "success") {
                const timeslots = response.data.payload;
                
                // Create CSV content
                const csvHeaders = ["Date", "Time", "Rushee Name", "Flexible"];
                
                // Process each timeslot and create objects for easy sorting
                const processedSlots = timeslots.map(slot => {
                    // Convert MongoDB DateTime to JavaScript Date
                    const jsDate = new Date(parseInt(slot.time.$date.$numberLong));
                    
                    // Format date and time
                    const date = jsDate.toLocaleDateString(); // MM/DD/YYYY format
                    const time = jsDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // HH:MM AM/PM format
                    
                    // Get rushee name
                    const rusheeName = `${slot.rushee_first_name} ${slot.rushee_last_name}`;
                    
                    // Get flexibility status
                    const flexWindow = slot.flex_window ? "Yes" : "No";
                    
                    // Create CSV row (escape commas in names)
                    const csvRow = [
                        `"${date}"`,
                        `"${time}"`,
                        `"${rusheeName}"`,
                        `"${flexWindow}"`
                    ].join(",");
                    
                    return {
                        originalDate: jsDate,
                        csvRow: csvRow
                    };
                });
                
                // Sort by full date/time (chronological order)
                processedSlots.sort((a, b) => a.originalDate - b.originalDate);
                
                // Create final CSV rows array
                const csvRows = [csvHeaders.join(","), ...processedSlots.map(slot => slot.csvRow)];
                
                // Create and download CSV
                const csvContent = csvRows.join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                
                if (link.download !== undefined) {
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `PIS_Schedule_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                
                setResults(`Successfully exported ${timeslots.length} PIS appointments to CSV`);
            } else {
                setResults("Error: Failed to fetch PIS timeslots");
            }
        } catch (error) {
            console.error("Export error:", error);
            setResults(`Error exporting PIS schedule: ${error.message}`);
        }
    };
      

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

            {/* Add PIS Question */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Add PIS Question</h2>
                <input
                    type="text"
                    placeholder="Question"
                    className="border p-2 w-full mb-2"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Question Type"
                    className="border p-2 w-full mb-2"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                />
                <button
                    onClick={() =>
                        handleRequest("add_pis_question", { question, question_type: questionType })
                    }
                    className="bg-blue-500 text-white px-4 py-2"
                >
                    Add Question
                </button>
            </div>

            {/* Delete PIS Question */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Delete PIS Question</h2>
                <input
                    type="text"
                    placeholder="Question"
                    className="border p-2 w-full mb-2"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Question Type"
                    className="border p-2 w-full mb-2"
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                />
                <button
                    onClick={() =>
                        handleRequest("delete_pis_question", { question, question_type: questionType })
                    }
                    className="bg-red-500 text-white px-4 py-2"
                >
                    Delete Question
                </button>
            </div>

            {/* Get PIS Questions */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Get PIS Questions</h2>
                <button
                    onClick={() => handleRequest("get_pis_questions", {}, "get")}
                    className="bg-green-500 text-white px-4 py-2"
                >
                    Fetch Questions
                </button>
            </div>

            {/* Add PIS Timeslot */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Add PIS Timeslot</h2>
                <input
                    type="datetime-local"
                    className="border p-2 w-full mb-2"
                    value={timeslotTime}
                    onChange={(e) => setTimeslotTime(e.target.value)}
                />
                <input
                    type="number"
                    placeholder="Change"
                    className="border p-2 w-full mb-2"
                    value={timeslotChange}
                    onChange={(e) => setTimeslotChange(Number(e.target.value))}
                />
                <button
                    onClick={() =>
                        handleRequest("add_pis_timeslot", { time: timeslotTime, change: timeslotChange })
                    }
                    className="bg-blue-500 text-white px-4 py-2"
                >
                    Add Timeslot
                </button>
            </div>

            {/* Delete PIS Timeslot */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Delete PIS Timeslot</h2>
                <input
                    type="datetime-local"
                    className="border p-2 w-full mb-2"
                    value={timeslotTime}
                    onChange={(e) => setTimeslotTime(e.target.value)}
                />
                <input
                    type="number"
                    placeholder="Change"
                    className="border p-2 w-full mb-2"
                    value={timeslotChange}
                    onChange={(e) => setTimeslotChange(Number(e.target.value))}
                />
                <button
                    onClick={() =>
                        handleRequest("delete_pis_timeslot", { time: timeslotTime, change: timeslotChange })
                    }
                    className="bg-red-500 text-white px-4 py-2"
                >
                    Delete Timeslot
                </button>
            </div>

            {/* Get PIS Timeslots */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Get PIS Timeslots</h2>
                <button
                    onClick={() => handleRequest("get_pis_timeslots", {}, "get")}
                    className="bg-green-500 text-white px-4 py-2"
                >
                    Fetch Timeslots
                </button>
            </div>

            {/* Export PIS Schedule */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Export PIS Schedule</h2>
                <p className="text-gray-600 mb-2">Download a CSV file with all PIS appointments</p>
                <button
                    onClick={exportPISSchedule}
                    className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded transition duration-200"
                >
                    Export PIS Schedule
                </button>
            </div>

            {/* Export Rushee Numbers (for Bid Committee) */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Export Rushee Numbers (Bid Committee)</h2>
                <p className="text-gray-600 mb-2">Download a CSV file mapping rushee numbers to names (001, 002, etc.)</p>
                <button
                    onClick={exportRusheeNumbers}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded transition duration-200"
                >
                    Export Rushee Numbers
                </button>
            </div>

            {/* Add Rush Night */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Add Rush Night</h2>
                <input
                    type="text"
                    placeholder="Name"
                    className="border p-2 w-full mb-2"
                    value={rushNightName}
                    onChange={(e) => setRushNightName(e.target.value)}
                />
                <input
                    type="datetime-local"
                    className="border p-2 w-full mb-2"
                    value={rushNightTime}
                    onChange={(e) => setRushNightTime(e.target.value)}
                />
                <button
                    onClick={() =>
                        handleRequest("add-rush-night", { name: rushNightName, time: rushNightTime })
                    }
                    className="bg-blue-500 text-white px-4 py-2"
                >
                    Add Rush Night
                </button>
            </div>

            {/* Delete Rush Night */}
            <div className="mb-6">
                <h2 className="text-xl font-semibold">Delete Rush Night</h2>
                <input
                    type="datetime-local"
                    className="border p-2 w-full mb-2"
                    value={rushNightTime}
                    onChange={(e) => setRushNightTime(e.target.value)}
                />
                <button
                    onClick={() =>
                        handleRequest("delete_rush_night", { time: rushNightTime })
                    }
                    className="bg-red-500 text-white px-4 py-2"
                >
                    Delete Rush Night
                </button>
            </div>

            {/* Results */}
            <div>
                <h2 className="text-xl font-semibold">Results</h2>
                <pre className="bg-gray-800 text-white p-4 rounded">
                    {results || "No results yet"}
                </pre>
            </div>
        </div>
    );
};

