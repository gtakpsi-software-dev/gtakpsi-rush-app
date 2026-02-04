import React, { useState } from "react";

export default function Badges(props) {

    let css = "bg-apple-gray-100 text-apple-gray-700 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
    const [text, setText] = useState((props.text ? props.text : "Default"))

    if (props.text === "Night 1") css = "bg-red-50 text-red-700 border border-red-200 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
    if (props.text === "Night 2") css = "bg-purple-50 text-purple-700 border border-purple-200 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
    if (props.text === 'PIS Night') css = "bg-green-50 text-green-700 border border-green-200 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
    if (props.text === 'Night 4') css = "bg-pink-50 text-pink-700 border border-pink-200 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
    if (props.text === 'Closed Night') css = "bg-teal-50 text-teal-700 border border-teal-200 text-apple-caption1 font-light me-2 px-2 py-1 rounded-apple whitespace-nowrap"
   

    return (
        <span className={"h-6 " + css}>{props.text}</span>
    )

}