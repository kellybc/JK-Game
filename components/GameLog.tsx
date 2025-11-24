import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface GameLogProps {
  logs: LogEntry[];
  isThinking: boolean;
}

export const GameLog: React.FC<GameLogProps> = ({ logs, isThinking }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isThinking]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide relative bg-mythic-900">
      {logs.map((log) => (
        <div 
          key={log.id} 
          className={`flex ${log.sender === 'player' ? 'justify-end' : 'justify-start'}`}
        >
          <div 
            className={`
              max-w-[85%] rounded-lg p-4 font-serif leading-relaxed shadow-md
              ${log.sender === 'player' 
                ? 'bg-slate-800 border border-slate-600 text-slate-200' 
                : log.sender === 'system'
                  ? 'bg-red-900/20 border border-red-900/50 text-red-200 text-sm font-mono'
                  : 'bg-transparent text-slate-300 border-l-2 border-mythic-gold pl-4'}
            `}
          >
            {log.sender === 'dm' && <span className="block text-mythic-gold text-xs font-bold uppercase mb-1 tracking-widest">Dungeon Master</span>}
            {log.content}
          </div>
        </div>
      ))}
      
      {isThinking && (
        <div className="flex justify-start animate-pulse">
           <div className="bg-transparent border-l-2 border-mythic-gold pl-4 p-4 text-slate-500 font-serif italic">
             The Fates are spinning your destiny...
           </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};