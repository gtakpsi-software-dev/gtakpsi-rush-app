import BasicInfoFields, { type BasicInfoFieldsProps } from "./BasicInfoFields";

type BasicInfoFormProps = BasicInfoFieldsProps & {
    onContinue: () => void | Promise<void>;
};

// Render the basic-information stage and its Continue action.
export default function BasicInfoForm(props: BasicInfoFormProps) {
    return (
        <div className="mt-24 p-4 max-w-4xl mx-auto">
            <div className="text-center mb-8 animate-slide-up">
                <h1 className="mb-3 text-apple-large font-light text-black">
                    Basic Information
                </h1>
                <div className="w-16 h-0.5 bg-black mx-auto mb-4"></div>
                <p className="text-apple-subheadline text-apple-gray-600 font-light">
                    Let&apos;s get some basic information about you to get started
                </p>
            </div>
            <div className="card-apple animate-slide-up mb-16" style={{animationDelay: '0.1s'}}>
                <form className="p-8 space-y-6">
                    <BasicInfoFields {...props} />

                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={props.onContinue}
                            className="btn-apple px-8 py-4 text-apple-headline"
                            type="button"
                        >
                            Continue
                        </button>
                    </div>
                </form>
            </div>
        </div>

    );
}
