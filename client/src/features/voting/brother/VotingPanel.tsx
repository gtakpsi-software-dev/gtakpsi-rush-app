import type { ReactNode } from 'react';

type VotingPanelProps = {
  title: string;
  children: ReactNode;
};

export default function VotingPanel({ title, children }: VotingPanelProps) {
  return (
    <div className="card-apple flex flex-col min-h-[320px]">
      <div className="p-5 border-b border-apple-gray-200 flex-shrink-0">
        <h3 className="text-xl font-semibold text-black">{title}</h3>
      </div>
      <div className="p-5 overflow-auto flex-1 max-h-[400px]" data-scrollable>
        {children}
      </div>
    </div>
  );
}
