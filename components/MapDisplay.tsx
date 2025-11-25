import React, { useState } from 'react';
import { Coordinates, TileType, WorldMap } from '../types';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MapPin, Eye, Footprints } from 'lucide-react';

interface MapDisplayProps {
    position: Coordinates;
    mapData: WorldMap;
    onMove: (direction: string) => void;
    disabled?: boolean;
}

const VIEW_RADIUS = 4; 
const TILE_SIZE_CLASS = "w-8 h-8 md:w-10 md:h-10";

const tileColors: Record<TileType, string> = {
    [TileType.TOWN]: 'bg-amber-900/60 border-amber-600 shadow-[inset_0_0_10px_rgba(251,191,36,0.2)]',
    [TileType.FOREST]: 'bg-emerald-900/60 border-emerald-700 shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]',
    [TileType.MOUNTAIN]: 'bg-slate-700/60 border-slate-500 shadow-[inset_0_0_10px_rgba(148,163,184,0.2)]',
    [TileType.DUNGEON]: 'bg-purple-950/80 border-purple-800 shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]',
    [TileType.PLAINS]: 'bg-yellow-900/30 border-yellow-800',
    [TileType.WATER]: 'bg-blue-900/50 border-blue-600',
    [TileType.UNKNOWN]: 'bg-black border-slate-900',
};

const tileIcons: Record<TileType, string> = {
    [TileType.TOWN]: '🏰',
    [TileType.FOREST]: '🌲',
    [TileType.MOUNTAIN]: '⛰️',
    [TileType.DUNGEON]: '💀',
    [TileType.PLAINS]: '🌾',
    [TileType.WATER]: '🌊',
    [TileType.UNKNOWN]: '',
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ position, mapData, onMove, disabled = false }) => {
    const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });

    const handlePan = (dx: number, dy: number) => {
        setViewOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    };

    const recenter = () => setViewOffset({ x: 0, y: 0 });

    // Generate grid relative to player + offset
    const grid: { x: number; y: number; data: { type: TileType; visited: boolean } | null }[] = [];
    const centerX = position.x + viewOffset.x;
    const centerY = position.y + viewOffset.y;

    for (let dy = VIEW_RADIUS; dy >= -VIEW_RADIUS; dy--) {
        for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
            const tx = centerX + dx;
            const ty = centerY + dy;
            const key = `${tx},${ty}`;
            grid.push({
                x: tx,
                y: ty,
                data: mapData.tiles[key] || null
            });
        }
    }

    return (
        <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-6 my-2 w-full">
            {/* --- LEFT: MAP GRID --- */}
            <div className="relative group flex-none">
                {/* Compass Labels */}
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-mythic-gold/50 text-xs font-serif tracking-widest uppercase">North</div>
                <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-slate-700 text-xs font-serif tracking-widest uppercase">South</div>
                <div className="absolute top-1/2 -right-6 transform -translate-y-1/2 text-slate-700 text-xs font-serif tracking-widest uppercase rotate-90">East</div>
                <div className="absolute top-1/2 -left-6 transform -translate-y-1/2 text-slate-700 text-xs font-serif tracking-widest uppercase -rotate-90">West</div>
                
                {/* The Map Grid */}
                <div 
                    className="grid gap-1 p-3 rounded-lg border-2 border-slate-700 bg-slate-950 shadow-2xl relative"
                    style={{ gridTemplateColumns: `repeat(${VIEW_RADIUS * 2 + 1}, minmax(0, 1fr))` }}
                >
                     {/* Info Overlay */}
                    <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono z-20 bg-black/50 px-1 rounded pointer-events-none">
                        Pos: {position.x}, {position.y}
                    </div>

                    {grid.map((cell) => {
                        const isPlayer = cell.x === position.x && cell.y === position.y;
                        const tileData = cell.data || { type: TileType.UNKNOWN, visited: false };
                        const isUnknown = tileData.type === TileType.UNKNOWN;

                        return (
                            <div 
                                key={`${cell.x},${cell.y}`}
                                className={`
                                    ${TILE_SIZE_CLASS} flex items-center justify-center text-lg rounded-sm border
                                    ${tileColors[tileData.type]}
                                    ${isPlayer ? 'ring-2 ring-white z-10 shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-110' : ''}
                                    ${!isUnknown && !isPlayer ? 'opacity-80' : ''}
                                    transition-all duration-300
                                `}
                                title={`(${cell.x}, ${cell.y}) ${tileData.type}`}
                            >
                                {isPlayer ? <span className="animate-pulse drop-shadow-md">🧙‍♂️</span> : <span className="opacity-90">{tileIcons[tileData.type]}</span>}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* --- RIGHT: CONTROL PANEL --- */}
            <div className="flex flex-row md:flex-col gap-6 bg-slate-900/50 p-4 rounded-xl border border-slate-800 shadow-xl">
                
                {/* 1. Movement D-PAD */}
                <div className="flex flex-col items-center">
                    <div className="text-[10px] uppercase text-mythic-gold tracking-widest mb-2 flex items-center gap-1">
                        <Footprints size={12} /> Movement
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                        {/* Top Row */}
                        <div />
                        <button 
                            onClick={() => onMove("Walk North")} 
                            disabled={disabled}
                            className={`w-12 h-12 rounded-lg border-2 shadow-lg flex items-center justify-center transition-all group ${
                                disabled 
                                ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-slate-700 active:bg-mythic-gold active:text-black border-slate-600'
                            }`}
                            title="Walk North"
                        >
                            <ArrowUp size={24} className={`text-slate-400 ${!disabled && 'group-hover:text-white group-active:text-black'}`} />
                        </button>
                        <div />

                        {/* Middle Row */}
                        <button 
                            onClick={() => onMove("Walk West")} 
                            disabled={disabled}
                            className={`w-12 h-12 rounded-lg border-2 shadow-lg flex items-center justify-center transition-all group ${
                                disabled 
                                ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-slate-700 active:bg-mythic-gold active:text-black border-slate-600'
                            }`}
                            title="Walk West"
                        >
                            <ArrowLeft size={24} className={`text-slate-400 ${!disabled && 'group-hover:text-white group-active:text-black'}`} />
                        </button>
                        
                        <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800">
                            <span className="text-xs text-slate-600 font-bold">WALK</span>
                        </div>

                        <button 
                            onClick={() => onMove("Walk East")} 
                            disabled={disabled}
                            className={`w-12 h-12 rounded-lg border-2 shadow-lg flex items-center justify-center transition-all group ${
                                disabled 
                                ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-slate-700 active:bg-mythic-gold active:text-black border-slate-600'
                            }`}
                            title="Walk East"
                        >
                            <ArrowRight size={24} className={`text-slate-400 ${!disabled && 'group-hover:text-white group-active:text-black'}`} />
                        </button>

                        {/* Bottom Row */}
                        <div />
                        <button 
                            onClick={() => onMove("Walk South")} 
                            disabled={disabled}
                            className={`w-12 h-12 rounded-lg border-2 shadow-lg flex items-center justify-center transition-all group ${
                                disabled 
                                ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed' 
                                : 'bg-slate-800 hover:bg-slate-700 active:bg-mythic-gold active:text-black border-slate-600'
                            }`}
                            title="Walk South"
                        >
                            <ArrowDown size={24} className={`text-slate-400 ${!disabled && 'group-hover:text-white group-active:text-black'}`} />
                        </button>
                        <div />
                    </div>
                </div>

                <div className="w-px md:w-full h-full md:h-px bg-slate-700/50" />

                {/* 2. Map Panning (Mini Controls) */}
                <div className="flex flex-col items-center justify-center">
                     <span className="text-[10px] uppercase text-slate-500 tracking-widest mb-2 flex items-center gap-1">
                        <Eye size={10}/> Pan Map
                     </span>
                     
                     <div className="grid grid-cols-3 gap-1">
                        <div />
                        <button onClick={() => handlePan(0, 1)} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ArrowUp size={10}/></button>
                        <div />

                        <button onClick={() => handlePan(-1, 0)} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ArrowLeft size={10}/></button>
                        <button onClick={recenter} className="p-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white" title="Recenter Map"><MapPin size={10}/></button>
                        <button onClick={() => handlePan(1, 0)} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ArrowRight size={10}/></button>

                        <div />
                        <button onClick={() => handlePan(0, -1)} className="p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><ArrowDown size={10}/></button>
                        <div />
                     </div>
                </div>

            </div>
        </div>
    );
};