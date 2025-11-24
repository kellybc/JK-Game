import React from 'react';
import { Coordinates, TileType, WorldMap } from '../types';

interface MapDisplayProps {
    position: Coordinates;
    mapData: WorldMap;
}

const TILE_SIZE = 40; // px
const VIEW_RADIUS = 2; // How many tiles to show in each direction (5x5 grid)

const tileColors: Record<TileType, string> = {
    [TileType.TOWN]: 'bg-amber-900/40 border-amber-700',
    [TileType.FOREST]: 'bg-emerald-900/40 border-emerald-800',
    [TileType.MOUNTAIN]: 'bg-slate-600/40 border-slate-500',
    [TileType.DUNGEON]: 'bg-purple-900/40 border-purple-800',
    [TileType.PLAINS]: 'bg-yellow-900/20 border-yellow-800',
    [TileType.WATER]: 'bg-blue-900/40 border-blue-700',
    [TileType.UNKNOWN]: 'bg-black/50 border-slate-800',
};

const tileIcons: Record<TileType, string> = {
    [TileType.TOWN]: '🏠',
    [TileType.FOREST]: '🌲',
    [TileType.MOUNTAIN]: '⛰️',
    [TileType.DUNGEON]: '💀',
    [TileType.PLAINS]: '🌾',
    [TileType.WATER]: '🌊',
    [TileType.UNKNOWN]: '☁️',
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ position, mapData }) => {
    // Generate the 5x5 grid relative to player
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
        <div className="bg-mythic-800 border border-slate-600 rounded-lg p-4 shadow-lg mb-4 flex flex-col items-center">
            <div className="flex justify-between w-full border-b border-slate-600 pb-2 mb-3">
                 <h3 className="text-mythic-gold font-serif text-lg font-bold">Overhead Map</h3>
                 <span className="font-mono text-xs text-slate-500">
                    Pos: {position.x}, {position.y}
                 </span>
            </div>
            
            <div 
                className="grid grid-cols-5 gap-1 bg-slate-950 p-2 rounded border border-slate-800"
                style={{ width: 'fit-content' }}
            >
                {grid.map((cell) => {
                    const isPlayer = cell.x === position.x && cell.y === position.y;
                    const tileData = cell.data || { type: TileType.UNKNOWN, visited: false };
                    // If we haven't visited it, it's Fog of War (Unknown), unless it's adjacent? 
                    // Let's keep it simple: if it's in the mapData, show it. If not, show Unknown.
                    
                    return (
                        <div 
                            key={`${cell.x},${cell.y}`}
                            className={`
                                w-10 h-10 flex items-center justify-center text-lg rounded-sm border
                                ${tileColors[tileData.type]}
                                ${isPlayer ? 'ring-2 ring-white shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10' : ''}
                                transition-all duration-500
                            `}
                            title={`(${cell.x}, ${cell.y}) ${tileData.type}`}
                        >
                            {isPlayer ? (
                                <span className="animate-pulse">🧙</span>
                            ) : (
                                <span className="opacity-70 grayscale hover:grayscale-0 transition-all">
                                    {tileIcons[tileData.type]}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-slate-500 italic">
                North is Up (+Y)
            </div>
        </div>
    );
};