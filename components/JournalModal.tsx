import React from 'react';
import { Quest } from '../types';
import { Book, CheckSquare, X } from 'lucide-react';

interface JournalModalProps {
    quests: Quest[];
    notes: string[];
    onClose: () => void;
}

export const JournalModal: React.FC<JournalModalProps> = ({ quests, notes, onClose }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div className="bg-amber-100 text-slate-900 rounded-lg p-0 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col md:flex-row h-[600px] border-4 border-amber-900/50">
                <button onClick={onClose} className="absolute top-2 right-2 text-slate-600 hover:text-black z-10"><X size={24}/></button>
                
                {/* Left Page: Quests */}
                <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-amber-900/20 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]">
                    <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6 flex items-center gap-2 border-b-2 border-amber-900 pb-2">
                        <CheckSquare size={24}/> Active Quests
                    </h2>
                    
                    {quests.length === 0 ? (
                        <p className="text-slate-600 italic">No active quests. Speak to villagers or explore to find work.</p>
                    ) : (
                        <div className="space-y-6">
                            {quests.map((q, idx) => (
                                <div key={idx} className="relative">
                                    <h3 className="font-bold text-lg text-amber-900">{q.title}</h3>
                                    <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded text-white ${q.type === 'MINI' ? 'bg-blue-600' : q.type === 'MAIN' ? 'bg-purple-600' : 'bg-red-600'}`}>
                                        {q.type} Quest
                                    </span>
                                    <p className="text-sm text-slate-800 mt-1 leading-relaxed">{q.description}</p>
                                    {q.completed && <div className="text-emerald-600 font-bold text-xs mt-1">✓ COMPLETED</div>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Page: Notes */}
                <div className="flex-1 p-8 overflow-y-auto bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]">
                    <h2 className="text-2xl font-serif font-bold text-amber-900 mb-6 flex items-center gap-2 border-b-2 border-amber-900 pb-2">
                        <Book size={24}/> Journal Notes
                    </h2>
                    
                    {notes.length === 0 ? (
                        <p className="text-slate-600 italic">No notes recorded yet.</p>
                    ) : (
                        <ul className="space-y-4 list-disc pl-5">
                            {notes.map((note, idx) => (
                                <li key={idx} className="text-sm text-slate-800 leading-relaxed font-serif">
                                    {note}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};