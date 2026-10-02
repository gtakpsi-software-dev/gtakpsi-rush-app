import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    text?: ReactNode;
    variant?: string;
    size?: string;
};

export default function Button(props: ButtonProps) {
    const text = props.text ? props.text : "Submit";
    const variant = props.variant || "primary";
    const size = props.size || "default";

    const baseClasses = "inline-flex items-center justify-center font-normal transition-all duration-200 ease-out border-0 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95";

    const variants: Record<string, string> = {
        primary: "btn-apple",
        secondary: "btn-apple-secondary",
        ghost: "bg-transparent text-black hover:bg-apple-gray-100 active:bg-apple-gray-200 rounded-apple-xl px-6 py-3",
    };

    const sizes: Record<string, string> = {
        sm: "px-4 py-2 text-apple-footnote rounded-apple",
        default: "px-6 py-3 text-apple-body rounded-apple-xl",
        lg: "px-8 py-4 text-apple-headline rounded-apple-2xl",
    };

    const variantClass = variants[variant] || variants.primary;
    const sizeClass = variant === "primary" || variant === "secondary" ? "" : sizes[size];

    // Spreading props last lets callers override the default class and type.
    return (
        <button
            className={`${baseClasses} ${variantClass} ${sizeClass} mt-3`}
            type="button"
            {...props}
        >
            {text}
        </button>
    );
}
