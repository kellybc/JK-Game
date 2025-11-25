import React, { useState } from 'react';

interface CombatViewProps {
    enemyName: string;
    enemyHp: number;
    enemyMaxHp: number;
    enemyDesc: string;
    playerHp: number;
    playerMaxHp: number;
    onRoll: (roll: number) => void;
    isRolling: boolean;
}

export const CombatView: React.FC<CombatViewProps> = ({ 
    enemyName, enemyHp, enemyMaxHp, enemyDesc, playerHp, playerMaxHp, onRoll, isRolling 
}) => {
    const [dieValue, setDieValue] = useState<number | null>(null);

    const handleRoll = () => {
        if (isRolling) return;
        // Animation simulation
        let i = 0;
        const interval = setInterval(() => {
            setDieValue(Math.ceil(Math.random() * 20));
            i++;
            if (i > 10) {
                clearInterval(interval);
                const finalRoll = Math.ceil(Math.random() * 20);
                setDieValue(finalRoll);
                onRoll(finalRoll);
            }
        }, 50);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-950 p-6 relative border-2 border-red-900/50 rounded-lg shadow-[inset_0_0_50px_rgba(153,27,27,0.2)]">
            <div className="absolute top-4 left-4 right-4 flex justify-between text-sm font-mono text-slate-500 uppercase tracking-widest">
                <span>Combat Mode</span>
                <span>Round Active</span>
            </div>

            {/* Enemy Card */}
            <div className="text-center mb-8 w-full max-w-md">
                <div className="text-6xl mb-4 animate-bounce">👹</div>
                <h2 className="text-2xl font-serif font-bold text-red-500 mb-1">{enemyName}</h2>
                <p className="text-slate-400 italic text-sm mb-4">"{enemyDesc}"</p>
                
                <div className="w-full bg-slate-800 h-4 rounded-full overflow-hidden border border-slate-700">
                    <div 
                        className="h-full bg-red-600 transition-all duration-500"
                        style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
                    />
                </div>
                <div className="flex justify-between text-xs mt-1 text-slate-400">
                    <span>HP</span>
                    <span>{enemyHp} / {enemyMaxHp}</span>
                </div>
            </div>

            {/* Dice Roller */}
            <div className="flex flex-col items-center gap-4">
                <button 
                    onClick={handleRoll}
                    disabled={isRolling}
                    className={`
                        w-24 h-24 rounded-xl border-4 flex items-center justify-center text-4xl font-bold transition-all
                        ${isRolling ? 'bg-slate-800 border-slate-600 text-slate-500' : 'bg-mythic-gold border-amber-600 text-mythic-900 hover:scale-105 hover:shadow-lg cursor-pointer'}
                    `}
                >
                    {dieValue || 'D20'}
                </button>
                <div className="text-slate-300 font-serif">
                    {isRolling ? "Rolling..." : "Click to Attack"}
                </div>
            </div>

            {/* Player Status Mini */}
            <div className="absolute bottom-4 w-full px-8">
                 <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                    <div className="text-left">
                        <span className="block text-xs text-slate-500 uppercase">You</span>
                        <span className="text-emerald-400 font-bold">{playerHp} / {playerMaxHp} HP</span>
                    </div>
                 </div>
            </div>
        </div>
    );
};