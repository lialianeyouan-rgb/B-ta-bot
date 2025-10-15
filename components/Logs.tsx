import React, { useEffect, useRef } from 'react';

interface LogsProps {
    logs: string[];
}

export const Logs: React.FC<LogsProps> = ({ logs }) => {
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="space-y-6 flex flex-col h-full">
            <h2 className="text-2xl font-bold flex-shrink-0">Live Execution Logs</h2>
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 h-full overflow-y-auto flex-grow">
                <div className="font-mono text-xs text-gray-400 space-y-1">
                    {logs.map((log, i) => (
                        <p key={i} className="whitespace-pre-wrap">
                            {log}
                        </p>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>
        </div>
    );
};
