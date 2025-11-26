import React, { useState, useEffect } from 'react';

interface CombatViewProps {
    enemyName: string;
    enemyHp: number;
    enemyMaxHp: number;
    enemyDesc: string;
    enemyType?: string;
    playerHp: number;
    playerMaxHp: number;
    onRoll: (roll: number) => void;
    isRolling: boolean;
}

const VisualScene = ({ keyword }: { keyword: string }) => {
    // Determine image based on keyword mapping or default
    const getImageUrl = (k: string) => {
        const lowerK = k.toLowerCase();
        if (lowerK.includes('dragon')) return 'https://images.unsplash.com/photo-1577493340887-b7bfff550145?auto=format&fit=crop&q=80&w=800';
        if (lowerK.includes('orc') || lowerK.includes('goblin')) return 'https://images.unsplash.com/photo-1535581652167-3d6b98636db2?auto=format&fit=crop&q=80&w=800';
        if (lowerK.includes('skeleton') || lowerK.includes('undead')) return 'https://images.unsplash.com/photo-1509557965875-b88c97052f0e?auto=format&fit=crop&q=80&w=800';
        if (lowerK.includes('wolf') || lowerK.includes('beast')) return 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&q=80&w=800';
        if (lowerK.includes('bandit') || lowerK.includes('thief')) return 'https://images.unsplash.com/photo-1542259681-d4cd7593c0ea?auto=format&fit=crop&q=80&w=800';
        return 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?auto=format&fit=crop&q=80&w=800'; // Generic fantasy
    };

    return (
        <div className="absolute inset-0 w-full h-full">
            <img 
                src={getImageUrl(keyword)} 
                alt={keyword} 
                className="w-full h-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>
    );
}

export const CombatView: React.FC<CombatViewProps> = ({ 
    enemyName, enemyHp, enemyMaxHp, enemyDesc, enemyType = 'monster', playerHp, playerMaxHp, onRoll, isRolling 
}) => {
    const [dieValue, setDieValue] = useState<number | null>(null);

    const handleRoll = () => {
        if (isRolling) return;
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
        <div className="relative w-full h-full min-h-[400px] flex flex-col bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
            {/* Visual Background */}
            <VisualScene keyword={enemyType || enemyName} />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-center p-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
                <span className="text-xs font-mono text-red-400 uppercase tracking-widest animate-pulse">⚔️ Combat Encounter</span>
                <span className="text-xs font-mono text-slate-400">Round Active</span>
            </div>

            {/* Main Content Area */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-6">
                
                {/* Enemy Status */}
                <div className="w-full max-w-sm text-center">
                    <h2 className="text-3xl font-serif font-bold text-white drop-shadow-md mb-2">{enemyName}</h2>
                    <p className="text-slate-300 italic text-sm mb-4 line-clamp-2">{enemyDesc}</p>
                    
                    <div className="relative w-full h-6 bg-slate-900/80 rounded-full overflow-hidden border border-slate-600">
                        <div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-900 to-red-600 transition-all duration-500"
                            style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-black drop-shadow-md">
                            {enemyHp} / {enemyMaxHp} HP
                        </div>
                    </div>
                </div>

                {/* Dice Roller */}
                <div className="flex flex-col items-center gap-2 mt-4">
                    <button 
                        onClick={handleRoll}
                        disabled={isRolling}
                        className={`
                            relative w-20 h-20 flex items-center justify-center rounded-xl border-2 text-3xl font-bold transition-all shadow-xl
                            ${isRolling 
                                ? 'bg-slate-800 border-slate-600 text-slate-500 scale-95' 
                                : 'bg-gradient-to-br from-mythic-gold to-amber-700 border-amber-300 text-black hover:scale-110 hover:shadow-amber-500/20 active:scale-95 cursor-pointer'}
                        `}
                    >
                        {dieValue !== null ? dieValue : <span className="text-sm font-bold opacity-50">ROLL</span>}
                    </button>
                    <span className="text-xs text-slate-400 font-mono uppercase tracking-widest">
                        {isRolling ? "Rolling..." : "Attack (D20)"}
                    </span>
                </div>

            </div>

            {/* Player Footer */}
            <div className="relative z-10 p-4 bg-black/40 backdrop-blur-md border-t border-white/10 flex justify-between items-center">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase">Your Health</span>
                    <span className={`text-xl font-bold ${playerHp < playerMaxHp / 3 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                        {playerHp} / {playerMaxHp}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Action</span>
                    <span className="text-sm text-white italic">Choose your strike...</span>
                </div>
            </div>
        </div>
    );
};