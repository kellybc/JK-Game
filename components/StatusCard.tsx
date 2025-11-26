import React from 'react';
import { CharacterStats, Item } from '../types';

interface StatusCardProps {
  stats: CharacterStats;
  inventory: Item[];
  reputation: number;
  className?: string;
}

const ProgressBar = ({ value, max, colorClass }: { value: number; max: number; colorClass: string }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-1 shadow-inner">
      <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${percent}%` }} />
    </div>
  );
};

const StatBox = ({ label, value, bonus = 0 }: { label: string; value: number; bonus?: number }) => {
    const modifier = Math.floor((value + bonus - 10) / 2);
    const sign = modifier >= 0 ? '+' : '';
    
    return (
        <div className="bg-slate-900/50 p-2 rounded border border-slate-700 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold text-slate-200">{value + bonus}</span>
                <span className={`text-xs ${modifier >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ({sign}{modifier})
                </span>
            </div>
        </div>
    );
};

export const StatusCard: React.FC<StatusCardProps> = ({ stats, inventory, reputation, className }) => {
    // Calculate equipped bonuses
    const equippedItems = inventory.filter(i => i.equipped);
    const getBonus = (statName: string) => equippedItems.reduce((acc, i) => acc + (i.effect?.stat === statName ? i.effect.value : 0), 0);

    return (
    <div className={`bg-mythic-800 border border-slate-600 rounded-lg p-4 shadow-lg ${className}`}>
      <div className="flex justify-between items-center border-b border-slate-600 pb-2 mb-3">
        <h3 className="text-mythic-gold font-serif text-lg font-bold">Character Sheet</h3>
        <div className="text-xs text-amber-500 font-mono">Rep: {reputation}</div>
      </div>
      
      <div className="space-y-4">
        {/* HP & XP */}
        <div>
           <div className="flex justify-between text-slate-300 text-xs mb-1">
             <span>Lvl {stats.level}</span>
             <span>XP: {stats.xp}</span>
           </div>
           <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden mb-2">
             <div className="h-full bg-blue-500" style={{ width: `${(stats.xp % 100)}%` }} />
           </div>

           <div className="flex justify-between items-end">
             <span className="text-slate-400 font-mono text-xs">HP</span>
             <span className="text-white font-bold">{stats.hp} / {stats.maxHp}</span>
           </div>
           <ProgressBar value={stats.hp} max={stats.maxHp} colorClass="bg-red-600" />
        </div>

        {/* 6 Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
            <StatBox label="STR" value={stats.strength} bonus={getBonus('strength')} />
            <StatBox label="DEX" value={stats.dexterity} bonus={getBonus('dexterity')} />
            <StatBox label="CON" value={stats.constitution} bonus={getBonus('constitution')} />
            <StatBox label="INT" value={stats.intelligence} bonus={getBonus('intelligence')} />
            <StatBox label="WIS" value={stats.wisdom} bonus={getBonus('wisdom')} />
            <StatBox label="CHA" value={stats.charisma} bonus={getBonus('charisma')} />
        </div>

        {/* Derived Stats */}
        <div className="flex justify-between items-center bg-slate-900 p-2 rounded">
             <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-500 uppercase">AC</span>
                 <span className="font-bold text-white">{stats.ac + getBonus('ac')}</span>
             </div>
             <div className="h-6 w-px bg-slate-700"></div>
             <div className="flex flex-col items-center">
                 <span className="text-[10px] text-slate-500 uppercase">Supplies</span>
                 <span className={`${stats.supplies < 3 ? 'text-red-400' : 'text-emerald-400'} font-bold`}>{stats.supplies}</span>
             </div>
        </div>
      </div>
    </div>
  );
};