
import React from 'react';

export const AiInsightCard: React.FC<{ advice: string | null; className?: string }> = ({ advice, className }) => (
    <div className={`bg-gradient-to-r from-blue-900/50 to-gray-800 p-6 rounded-lg border border-blue-700 shadow-lg ${className}`}>
        <div className="flex items-center space-x-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.707.707M12 21v-1" /></svg>
            <h3 className="text-lg font-semibold text-white">Gemini Strategic Insight</h3>
        </div>
        <p className="text-gray-300 mt-3">{advice || "Awaiting strategic analysis from Gemini..."}</p>
    </div>
);
