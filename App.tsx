import React, { useReducer, useState, useCallback, useEffect } from 'react';
import { GameState, LogEntry, Item, CharacterStats, Quest, ItemType, TileType } from './types';
import { generateGameTurn } from './services/geminiService';
import { StatusCard } from './components/StatusCard';
import { Inventory } from './components/Inventory';
import { GameLog } from './components/GameLog';
import { MapDisplay } from './components/MapDisplay';

// --- INITIAL STATE ---
const INITIAL_STATS: CharacterStats = {
  hp: 20, maxHp: 20, xp: 0, level: 1, strength: 10, defense: 10, supplies: 5
};

const INITIAL_STATE: GameState = {
  player: {
    name: "Traveler",
    stats: INITIAL_STATS,
    inventory: [
      { id: '1', name: 'Rusted Dagger', description: 'Better than nothing.', type: ItemType.WEAPON, quantity: 1 },
      { id: '2', name: 'Dried Biscuit', description: 'Hard as a rock.', type: ItemType.CONSUMABLE, quantity: 2 }
    ],
    companions: [],
    activeQuests: [],
    position: { x: 0, y: 0 }
  },
  world: {
    locationName: "Crossroads of Echoes",
    locationDescription: "A foggy intersection of old dirt roads.",
    timeOfDay: "Dusk",
    dangerLevel: 1,
    npcMemory: {},
    mapData: {
        tiles: {
            "0,0": { type: TileType.PLAINS, visited: true }
        }
    }
  },
  gameLog: [{
    id: 'init',
    sender: 'dm',
    content: "You stand at the Crossroads of Echoes (0,0). A cold wind bites at your skin. To the North lies the Whispering Woods. To the South, the village. What will you do?",
    timestamp: Date.now()
  }],
  turnCount: 0,
  isGameOver: false
};

// --- REDUCER ---
type Action = 
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'UPDATE_STATS'; payload: Partial<CharacterStats> }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'REMOVE_ITEM'; payload: string } 
  | { type: 'DROP_ITEM'; payload: string } 
  | { type: 'SET_LOCATION'; payload: { name: string; desc: string } }
  | { type: 'UPDATE_NPC_MEMORY'; payload: Record<string, string> }
  | { type: 'UPDATE_MAP'; payload: { direction: string; terrain: TileType } }
  | { type: 'GAME_OVER' };

const gameReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'ADD_LOG':
      return { ...state, gameLog: [...state.gameLog, action.payload] };
    
    case 'UPDATE_STATS':
      return {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, ...action.payload }
        }
      };
      
    case 'ADD_ITEM': {
      const existingItemIndex = state.player.inventory.findIndex(i => i.name === action.payload.name);
      let newInventory = [...state.player.inventory];
      if (existingItemIndex >= 0) {
        newInventory[existingItemIndex].quantity += action.payload.quantity;
      } else {
        newInventory.push(action.payload);
      }
      return { ...state, player: { ...state.player, inventory: newInventory } };
    }

    case 'REMOVE_ITEM': {
      const targetIndex = state.player.inventory.findIndex(i => i.name === action.payload);
      if (targetIndex === -1) return state; 
      
      let newInv = [...state.player.inventory];
      if (newInv[targetIndex].quantity > 1) {
        newInv[targetIndex].quantity -= 1;
      } else {
        newInv.splice(targetIndex, 1);
      }
      return { ...state, player: { ...state.player, inventory: newInv } };
    }

    case 'DROP_ITEM': {
      const targetIndex = state.player.inventory.findIndex(i => i.name === action.payload);
      if (targetIndex === -1) return state;
      
      let newInv = [...state.player.inventory];
      const droppedItem = newInv[targetIndex];
      
      // Completely remove item stack when dropped
      newInv.splice(targetIndex, 1);

      // Add a log entry for the drop
      const dropLog: LogEntry = {
          id: Date.now().toString(),
          sender: 'system',
          content: `You dropped ${droppedItem.quantity}x ${droppedItem.name}.`,
          timestamp: Date.now()
      };

      return { 
          ...state, 
          gameLog: [...state.gameLog, dropLog],
          player: { ...state.player, inventory: newInv } 
      };
    }

    case 'SET_LOCATION':
      return {
        ...state,
        world: {
          ...state.world,
          locationName: action.payload.name,
          locationDescription: action.payload.desc
        }
      };

    case 'UPDATE_NPC_MEMORY':
      return {
        ...state,
        world: {
          ...state.world,
          npcMemory: { ...state.world.npcMemory, ...action.payload }
        }
      };

    case 'UPDATE_MAP': {
        const { direction, terrain } = action.payload;
        let { x, y } = state.player.position;

        if (direction === 'NORTH') y += 1;
        if (direction === 'SOUTH') y -= 1;
        if (direction === 'EAST') x += 1;
        if (direction === 'WEST') x -= 1;

        const newKey = `${x},${y}`;
        const newTiles = { ...state.world.mapData.tiles };
        
        // Always update the terrain type of the location we just moved to/are at
        newTiles[newKey] = { type: terrain, visited: true };

        return {
            ...state,
            player: { ...state.player, position: { x, y } },
            world: {
                ...state.world,
                mapData: { tiles: newTiles }
            }
        };
    }

    case 'GAME_OVER':
      return { ...state, isGameOver: true };

    default:
      return state;
  }
};

// --- MAIN COMPONENT ---
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(["Look around", "Check supplies", "Walk North"]);

  const handleAction = async (actionText: string) => {
    if (!actionText.trim() || isProcessing || state.isGameOver) return;
    
    setIsProcessing(true);
    setSuggestions([]);

    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: Date.now().toString(),
        sender: 'player',
        content: actionText,
        timestamp: Date.now()
      }
    });

    try {
      const response = await generateGameTurn(state, actionText);

      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: (Date.now() + 1).toString(),
          sender: 'dm',
          content: response.narrative,
          timestamp: Date.now()
        }
      });

      const newHp = Math.min(state.player.stats.maxHp, Math.max(0, state.player.stats.hp + response.hp_change));
      const newSupplies = Math.max(0, state.player.stats.supplies - response.supplies_consumed);
      const newXp = state.player.stats.xp + response.xp_gained;
      
      let newLevel = state.player.stats.level;
      let newMaxHp = state.player.stats.maxHp;
      if (newXp >= newLevel * 100) {
        newLevel++;
        newMaxHp += 5;
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: (Date.now() + 2).toString(),
            sender: 'system',
            content: `LEVEL UP! You are now level ${newLevel}. Max HP increased.`,
            timestamp: Date.now()
          }
        });
      }

      dispatch({
        type: 'UPDATE_STATS',
        payload: { hp: newHp, supplies: newSupplies, xp: newXp, level: newLevel, maxHp: newMaxHp }
      });

      response.items_added?.forEach(item => dispatch({ type: 'ADD_ITEM', payload: item }));
      response.items_removed_names?.forEach(name => dispatch({ type: 'REMOVE_ITEM', payload: name }));

      if (response.new_location_name) {
        dispatch({
          type: 'SET_LOCATION',
          payload: { name: response.new_location_name, desc: response.new_location_description || '' }
        });
      }

      // Map Update Logic
      if (response.movement_direction || response.current_terrain_type) {
         dispatch({
             type: 'UPDATE_MAP',
             payload: {
                 direction: response.movement_direction || 'NONE',
                 terrain: response.current_terrain_type || TileType.UNKNOWN
             }
         });
      }

      if (response.updated_npc_memories) {
        dispatch({ type: 'UPDATE_NPC_MEMORY', payload: response.updated_npc_memories });
      }

      if (newHp <= 0 || response.is_game_over) {
        dispatch({ type: 'GAME_OVER' });
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: (Date.now() + 3).toString(),
            sender: 'system',
            content: "GAME OVER. The chronicles of your journey end here.",
            timestamp: Date.now()
          }
        });
      } else {
        setSuggestions(response.suggested_actions || []);
      }

    } catch (error) {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          id: Date.now().toString(),
          sender: 'system',
          content: "The connection to the ethereal plane was lost. Please try again.",
          timestamp: Date.now()
        }
      });
    } finally {
      setIsProcessing(false);
      setInput('');
    }
  };

  const handleDropItem = (itemName: string) => {
      dispatch({ type: 'DROP_ITEM', payload: itemName });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAction(input);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full max-w-7xl mx-auto md:p-4">
      <div className="scanline"></div>
      
      <header className="flex-none p-4 md:rounded-t-xl bg-mythic-900 border-b border-slate-700 flex justify-between items-center">
        <div>
           <h1 className="text-2xl md:text-3xl font-serif font-bold text-mythic-gold tracking-wider">AETHERIA</h1>
           <p className="text-xs text-slate-500 hidden md:block">{state.world.locationName} — {state.world.timeOfDay}</p>
        </div>
        <div className="text-right">
           <div className="text-xs text-slate-500 uppercase tracking-widest">Turn</div>
           <div className="font-mono text-xl">{state.gameLog.length}</div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden md:border-x border-slate-700 bg-slate-950">
        
        <section className="flex-1 flex flex-col min-w-0 order-2 md:order-1 relative z-10">
          <GameLog logs={state.gameLog} isThinking={isProcessing} />
          
          <div className="p-4 bg-mythic-900 border-t border-slate-700">
             {!state.isGameOver && suggestions.length > 0 && (
               <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                 {suggestions.map((sug, idx) => (
                   <button
                     key={idx}
                     onClick={() => handleAction(sug)}
                     disabled={isProcessing}
                     className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-mythic-gold transition-colors disabled:opacity-50"
                   >
                     {sug}
                   </button>
                 ))}
               </div>
             )}

             <div className="flex gap-2">
               <input
                 type="text"
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyDown={handleKeyDown}
                 disabled={isProcessing || state.isGameOver}
                 placeholder={state.isGameOver ? "Refresh to restart..." : "What do you do?"}
                 className="flex-1 bg-slate-950 border border-slate-600 rounded p-3 text-slate-200 focus:outline-none focus:border-mythic-gold transition-colors disabled:opacity-50 font-serif"
               />
               <button
                 onClick={() => handleAction(input)}
                 disabled={isProcessing || !input.trim() || state.isGameOver}
                 className="bg-mythic-gold text-mythic-900 font-bold px-6 py-2 rounded hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 ACT
               </button>
             </div>
          </div>
        </section>

        <section className="w-full md:w-80 bg-mythic-900 border-l border-slate-700 flex flex-col gap-4 p-4 overflow-y-auto order-1 md:order-2 h-64 md:h-auto border-b md:border-b-0">
          <MapDisplay position={state.player.position} mapData={state.world.mapData} />
          
          <StatusCard stats={state.player.stats} />
          
          <Inventory items={state.player.inventory} onDropItem={handleDropItem} />
        </section>
        
      </main>
    </div>
  );
}