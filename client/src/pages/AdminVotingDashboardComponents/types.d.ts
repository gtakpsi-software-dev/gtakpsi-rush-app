import React from 'react'

export type VoteResult = "Yes" | "No" | "Abstain";

export interface Vote {
    brother_id: string;
    first_name: string;
    last_name: string;
    vote: VoteResult;
}

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
    attendance?: { time: Date | string; name: string }[];
    interactions_by_night?: { night_index: number; name: string; interactions: number | null }[];
}

export interface Brother {
    _id: string;           // Firebase UID
    uid: string;           // Firebase UID
    firstname: string;
    lastname: string;
    email: string;
    displayName?: string;
}

export interface AdminVotingContextType {
    votes: Vote[];
    rushee: Rushee | null;
    question: string | null;
    brothers: Brother[];
    setVotes: React.Dispatch<React.SetStateAction<Vote[]>>;
    setRushee: React.Dispatch<React.SetStateAction<Rushee | null>>;
    setQuestion: React.Dispatch<React.SetStateAction<string | null>>;
}