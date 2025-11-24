import React from 'react';
import { Coordinates, TileType, WorldMap } from '../types';

interface MapDisplayProps {
    position: Coordinates;
    mapData: WorldMap;
}

const VIEW_RADIUS = 4; // 4 radius = 9x9 grid
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

export const MapDisplay: React.FC<MapDisplayProps> = ({ position, mapData }) => {
    // Generate grid relative to player
    const grid: { x: number; y: number; data: { type: TileType; visited: boolean } | null }[] = [];

    for (let dy = VIEW_RADIUS; dy >= -VIEW_RADIUS; dy--) {
        for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
            const tx = position.x + dx;
            const ty = position.y + dy;
            const key = `${tx},${ty}`;
            grid.push({
                x: tx,
                y: ty,
                data: mapData.tiles[key] || null
            });
        }
    }

    return (
        <div className="relative group my-8">
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-mythic-gold/50 text-xs font-serif tracking-widest uppercase">
                North
            </div>
            
            <div 
                className="grid gap-1 p-3 rounded-lg border-2 border-slate-700 bg-slate-950 shadow-2xl relative"
                style={{ 
                    gridTemplateColumns: `repeat(${VIEW_RADIUS * 2 + 1}, minmax(0, 1fr))` 
                }}
            >
                {/* Compass details */}
                <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">
                    X:{position.x} Y:{position.y}
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
                            {isPlayer ? (
                                <span className="animate-pulse drop-shadow-md">🧙‍♂️</span>
                            ) : (
                                <span className="opacity-90">
                                    {tileIcons[tileData.type]}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-slate-700 text-xs font-serif tracking-widest uppercase">
                South
            </div>
        </div>
    );
};