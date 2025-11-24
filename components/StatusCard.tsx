import React from 'react';
import { CharacterStats } from '../types';

interface StatusCardProps {
  stats: CharacterStats;
}

const ProgressBar = ({ value, max, colorClass }: { value: number; max: number; colorClass: string }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-1">
      <div 
        className={`h-full ${colorClass} transition-all duration-500`} 
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export const StatusCard: React.FC<StatusCardProps> = ({ stats }) => {
  return (
    <div className="bg-mythic-800 border border-slate-600 rounded-lg p-4 shadow-lg">
      <h3 className="text-mythic-gold font-serif text-lg font-bold border-b border-slate-600 pb-2 mb-3">
        Character Status
      </h3>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="col-span-2">
           <div className="flex justify-between text-slate-300 mb-1">
             <span>Level {stats.level}</span>
             <span>XP: {stats.xp}</span>
           </div>
           {/* Simple XP bar visual, strictly decorative since max XP logic is hidden */}
           <div className="w-full bg-slate-700 h-1 rounded-full overflow-hidden">
             <div className="h-full bg-blue-500" style={{ width: `${(stats.xp % 100)}%` }} />
           </div>
        </div>

        <div className="col-span-2">
          <div className="flex justify-between items-end">
            <span className="text-slate-400 font-mono text-xs">HP</span>
            <span className="text-white font-bold">{stats.hp} / {stats.maxHp}</span>
          </div>
          <ProgressBar value={stats.hp} max={stats.maxHp} colorClass="bg-red-600" />
        </div>

        <div>
           <span className="block text-slate-400 text-xs uppercase">STR</span>
           <span className="text-xl font-mono text-slate-200">{stats.strength}</span>
        </div>
        <div>
           <span className="block text-slate-400 text-xs uppercase">DEF</span>
           <span className="text-xl font-mono text-slate-200">{stats.defense}</span>
        </div>

        <div className="col-span-2 mt-2 pt-2 border-t border-slate-700 flex justify-between items-center">
          <span className="text-slate-400">Supplies</span>
          <span className={`font-mono font-bold ${stats.supplies < 3 ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats.supplies}
          </span>
        </div>
      </div>
    </div>
  );
};