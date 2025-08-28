export interface Rating {
    name: string;
    value: number;
}

export interface Comment {
    brother_id: string;
    brother_name: string;
    comment: string;
    ratings: Rating[];
    night: Date | string;
}

export interface Rushee {
    first_name: string;
    last_name: string;
    gtid: string;
    major: string;
    pronouns: string;
    image_url: string;
    comments: Comment[];
    ratings: Rating[];
}

export interface Brother {
    firstname: string;
    lastname: string;
    _id: string;
}

export interface BrotherVotingContextType {
    rushee: Rushee | null;
    question: string | null;
    setRushee: React.Dispatch<React.SetStateAction<Rushee | null>>;
    setQuestion: React.Dispatch<React.SetStateAction<string | null>>;
}