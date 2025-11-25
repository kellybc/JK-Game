import React, { useReducer, useState, useCallback, useEffect } from 'react';
import { GameState, LogEntry, Item, CharacterStats, Quest, ItemType, TileType, CombatState } from './types';
import { generateGameTurn } from './services/geminiService';
import { StatusCard } from './components/StatusCard';
import { Inventory } from './components/Inventory';
import { GameLog } from './components/GameLog';
import { MapDisplay } from './components/MapDisplay';
import { CombatView } from './components/CombatView';
import { AmbientSound } from './components/AmbientSound';

// --- INITIAL STATE GENERATOR ---
const createInitialState = (characterName: string): GameState => ({
  id: Date.now().toString(),
  player: {
    name: characterName,
    stats: { hp: 20, maxHp: 20, xp: 0, level: 1, strength: 10, defense: 10, supplies: 5 },
    inventory: [
      { id: '1', name: 'Rusted Dagger', description: 'Rusty but sharp.', type: ItemType.WEAPON, quantity: 1, weight: 1.0, slot: 'hand', effect: { stat: 'strength', value: 2 }, equipped: true },
      { id: '2', name: 'Torn Tunic', description: 'Better than naked.', type: ItemType.ARMOR, quantity: 1, weight: 1.5, slot: 'body', effect: { stat: 'defense', value: 1 }, equipped: true },
      { id: '3', name: 'Dried Biscuit', description: 'Hard as a rock.', type: ItemType.CONSUMABLE, quantity: 2, weight: 0.1 }
    ],
    companions: [],
    activeQuests: [],
    position: { x: 0, y: 0 }
  },
  world: {
    locationName: "Crossroads of Echoes",
    locationDescription: "A foggy intersection. A signpost points North to the Whispering Woods.",
    timeOfDay: "Dusk",
    dangerLevel: 1,
    npcMemory: {},
    mapData: {
        tiles: {
            "0,0": { type: TileType.PLAINS, visited: true }
        }
    }
  },
  combat: {
      isActive: false
  },
  gameLog: [{
    id: 'init',
    sender: 'dm',
    content: `Welcome, ${characterName}. You stand at the Crossroads of Echoes (0,0). To the North, the Whispering Woods await.`,
    timestamp: Date.now()
  }],
  turnCount: 0,
  isGameOver: false
});

// --- REDUCER ---
type Action = 
  | { type: 'LOAD_STATE'; payload: GameState }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'UPDATE_STATS'; payload: Partial<CharacterStats> }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'REMOVE_ITEM'; payload: string } 
  | { type: 'DROP_ITEM'; payload: string } 
  | { type: 'EQUIP_ITEM'; payload: string }
  | { type: 'UNEQUIP_ITEM'; payload: string }
  | { type: 'SET_LOCATION'; payload: { name: string; desc: string } }
  | { type: 'UPDATE_NPC_MEMORY'; payload: Record<string, string> }
  | { type: 'UPDATE_MAP'; payload: { direction: string; terrain: TileType } }
  | { type: 'START_COMBAT'; payload: { name: string; hp: number; desc: string } }
  | { type: 'UPDATE_COMBAT'; payload: { damage: number } }
  | { type: 'END_COMBAT' }
  | { type: 'GAME_OVER' }
  | { type: 'RESTART' };

const gameReducer = (state: GameState, action: Action): GameState => {
  let newState = state;

  switch (action.type) {
    case 'LOAD_STATE':
        return action.payload;

    case 'RESTART':
        return state; 

    case 'ADD_LOG':
      newState = { ...state, gameLog: [...state.gameLog, action.payload] };
      break;
    
    case 'UPDATE_STATS':
      newState = {
        ...state,
        player: {
          ...state.player,
          stats: { ...state.player.stats, ...action.payload }
        }
      };
      break;
      
    case 'ADD_ITEM': {
      const existingItemIndex = state.player.inventory.findIndex(i => i.name === action.payload.name);
      let newInventory = [...state.player.inventory];
      if (existingItemIndex >= 0) {
        newInventory[existingItemIndex].quantity += action.payload.quantity;
      } else {
        newInventory.push({ ...action.payload, equipped: false });
      }
      newState = { ...state, player: { ...state.player, inventory: newInventory } };
      break;
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
      newState = { ...state, player: { ...state.player, inventory: newInv } };
      break;
    }

    case 'DROP_ITEM': {
      const targetIndex = state.player.inventory.findIndex(i => i.name === action.payload);
      if (targetIndex === -1) return state;
      let newInv = [...state.player.inventory];
      const droppedItem = newInv[targetIndex];
      newInv.splice(targetIndex, 1);
      const dropLog: LogEntry = { id: Date.now().toString(), sender: 'system', content: `You dropped ${droppedItem.quantity}x ${droppedItem.name}.`, timestamp: Date.now() };
      newState = { ...state, gameLog: [...state.gameLog, dropLog], player: { ...state.player, inventory: newInv } };
      break;
    }

    case 'EQUIP_ITEM': {
        const idx = state.player.inventory.findIndex(i => i.name === action.payload);
        if (idx === -1) return state;
        const item = state.player.inventory[idx];
        if (!item.slot) return state;

        // Unequip current item in same slot
        const newInv = state.player.inventory.map(i => 
            (i.slot === item.slot && i.equipped) ? { ...i, equipped: false } : i
        );
        newInv[idx].equipped = true;
        
        newState = { ...state, player: { ...state.player, inventory: newInv } };
        break;
    }

    case 'UNEQUIP_ITEM': {
        const idx = state.player.inventory.findIndex(i => i.name === action.payload);
        if (idx === -1) return state;
        const newInv = [...state.player.inventory];
        newInv[idx].equipped = false;
        newState = { ...state, player: { ...state.player, inventory: newInv } };
        break;
    }

    case 'SET_LOCATION':
      newState = { ...state, world: { ...state.world, locationName: action.payload.name, locationDescription: action.payload.desc } };
      break;

    case 'UPDATE_NPC_MEMORY':
      newState = { ...state, world: { ...state.world, npcMemory: { ...state.world.npcMemory, ...action.payload } } };
      break;

    case 'UPDATE_MAP': {
        const { direction, terrain } = action.payload;
        let { x, y } = state.player.position;
        if (direction === 'NORTH') y += 1;
        if (direction === 'SOUTH') y -= 1;
        if (direction === 'EAST') x += 1;
        if (direction === 'WEST') x -= 1;
        const newKey = `${x},${y}`;
        const newTiles = { ...state.world.mapData.tiles };
        newTiles[newKey] = { type: terrain, visited: true };
        newState = { ...state, player: { ...state.player, position: { x, y } }, world: { ...state.world, mapData: { tiles: newTiles } } };
        break;
    }

    case 'START_COMBAT':
        newState = { ...state, combat: { isActive: true, enemyName: action.payload.name, enemyHp: action.payload.hp, enemyMaxHp: action.payload.hp, enemyDescription: action.payload.desc, roundLog: [] } };
        break;

    case 'UPDATE_COMBAT':
        if (!state.combat.isActive || !state.combat.enemyHp) return state;
        const newEnemyHp = Math.max(0, state.combat.enemyHp - action.payload.damage);
        newState = { ...state, combat: { ...state.combat, enemyHp: newEnemyHp } };
        break;

    case 'END_COMBAT':
        newState = { ...state, combat: { isActive: false } };
        break;

    case 'GAME_OVER':
      newState = { ...state, isGameOver: true };
      break;
  }

  // Auto-save logic
  if (action.type !== 'GAME_OVER') {
      const saves = JSON.parse(localStorage.getItem('aetheria_saves') || '{}');
      if (newState.id) {
          saves[newState.id] = newState;
          localStorage.setItem('aetheria_saves', JSON.stringify(saves));
      }
  }

  return newState;
};

// --- MAIN MENU COMPONENT ---
const MainMenu = ({ onStart, onLoad }: { onStart: (name: string) => void, onLoad: (id: string) => void }) => {
    const [name, setName] = useState('');
    const [saves, setSaves] = useState<GameState[]>([]);

    useEffect(() => {
        const savedData = JSON.parse(localStorage.getItem('aetheria_saves') || '{}');
        setSaves(Object.values(savedData));
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-mythic-900 text-slate-200 p-4">
            <h1 className="text-4xl md:text-6xl font-serif text-mythic-gold mb-8 tracking-widest text-center">AETHERIA CHRONICLES</h1>
            <div className="w-full max-w-md space-y-8">
                <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                    <h2 className="text-xl font-bold mb-4 text-white">New Adventure</h2>
                    <input type="text" placeholder="Enter Character Name" className="w-full bg-slate-900 border border-slate-600 p-3 rounded mb-4 text-white outline-none" value={name} onChange={(e) => setName(e.target.value)} />
                    <button onClick={() => name && onStart(name)} disabled={!name} className="w-full bg-mythic-gold hover:bg-amber-400 text-mythic-900 font-bold py-3 rounded transition-colors disabled:opacity-50">Begin Journey</button>
                </div>
                {saves.length > 0 && (
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-white">Load Game</h2>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                            {saves.map(save => (
                                <button key={save.id} onClick={() => onLoad(save.id)} className="w-full text-left bg-slate-700 hover:bg-slate-600 p-3 rounded flex justify-between items-center group transition-colors">
                                    <div><div className="font-bold text-mythic-gold">{save.player.name}</div><div className="text-xs text-slate-400">Level {save.player.stats.level} • {save.world.locationName}</div></div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [isInMenu, setIsInMenu] = useState(true);
  const [state, dispatch] = useReducer(gameReducer, createInitialState("Traveler"));
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cooldown, setCooldown] = useState(false); // New Cooldown State
  const [suggestions, setSuggestions] = useState<string[]>(["Look around", "Check supplies"]);
  const [combatRolling, setCombatRolling] = useState(false);

  const startGame = (name: string) => {
      const newState = createInitialState(name);
      dispatch({ type: 'LOAD_STATE', payload: newState });
      setIsInMenu(false);
      setSuggestions(["Look around", "Check Inventory"]);
  };

  const loadGame = (id: string) => {
      const saves = JSON.parse(localStorage.getItem('aetheria_saves') || '{}');
      if (saves[id]) { dispatch({ type: 'LOAD_STATE', payload: saves[id] }); setIsInMenu(false); }
  };

  const handleAction = async (actionText: string) => {
    if ((!actionText.trim() && !state.combat.isActive) || isProcessing || cooldown || state.isGameOver) return;
    setIsProcessing(true);
    setSuggestions([]);

    dispatch({ type: 'ADD_LOG', payload: { id: Date.now().toString(), sender: 'player', content: actionText, timestamp: Date.now() } });

    try {
      const response = await generateGameTurn(state, actionText);

      dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 1).toString(), sender: 'dm', content: response.narrative, timestamp: Date.now() } });

      // Stat Updates
      const newHp = Math.min(state.player.stats.maxHp, Math.max(0, state.player.stats.hp + response.hp_change));
      const newSupplies = Math.max(0, state.player.stats.supplies - response.supplies_consumed);
      const newXp = state.player.stats.xp + response.xp_gained;
      let newLevel = state.player.stats.level;
      let newMaxHp = state.player.stats.maxHp;
      if (newXp >= newLevel * 100) { newLevel++; newMaxHp += 5; dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 2).toString(), sender: 'system', content: `LEVEL UP! Level ${newLevel}.`, timestamp: Date.now() } }); }

      dispatch({ type: 'UPDATE_STATS', payload: { hp: newHp, supplies: newSupplies, xp: newXp, level: newLevel, maxHp: newMaxHp } });

      // Item Updates
      response.items_added?.forEach(item => dispatch({ type: 'ADD_ITEM', payload: item }));
      response.items_removed_names?.forEach(name => dispatch({ type: 'REMOVE_ITEM', payload: name }));

      // Location/Map
      if (response.new_location_name) dispatch({ type: 'SET_LOCATION', payload: { name: response.new_location_name, desc: response.new_location_description || '' } });
      if (response.movement_direction || response.current_terrain_type) {
         dispatch({ type: 'UPDATE_MAP', payload: { direction: response.movement_direction || 'NONE', terrain: response.current_terrain_type || TileType.UNKNOWN } });
      }

      // NPC Memory
      if (response.updated_npc_memories) dispatch({ type: 'UPDATE_NPC_MEMORY', payload: response.updated_npc_memories });

      // Combat State
      if (response.combat_start) dispatch({ type: 'START_COMBAT', payload: { name: response.enemy_name || 'Unknown Enemy', hp: response.enemy_hp || 10, desc: response.enemy_desc || 'A menacing foe.' } });
      if (response.enemy_damage_taken) dispatch({ type: 'UPDATE_COMBAT', payload: { damage: response.enemy_damage_taken } });
      if (response.combat_ended) dispatch({ type: 'END_COMBAT' });

      // Game Over
      if (newHp <= 0 || response.is_game_over) {
        dispatch({ type: 'GAME_OVER' });
        dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 3).toString(), sender: 'system', content: "GAME OVER.", timestamp: Date.now() } });
      } else {
        setSuggestions(response.suggested_actions || []);
      }

    } catch (error) {
      dispatch({ type: 'ADD_LOG', payload: { id: Date.now().toString(), sender: 'system', content: "API Error.", timestamp: Date.now() } });
    } finally {
      setIsProcessing(false);
      setInput('');
      setCombatRolling(false);
      // Initiate Cooldown to prevent hitting Rate Limit (15 RPM)
      setCooldown(true);
      setTimeout(() => setCooldown(false), 6000); 
    }
  };

  const handleCombatRoll = (roll: number) => {
      setCombatRolling(true);
      // Construct combat context for AI
      const weapon = state.player.inventory.find(i => i.equipped && i.slot === 'hand')?.name || "Fists";
      const totalStr = state.player.stats.strength + state.player.inventory.filter(i => i.equipped).reduce((acc, i) => acc + (i.effect?.stat === 'strength' ? i.effect.value : 0), 0);
      const attackTotal = roll + Math.floor(totalStr / 5); // Simple modifier calculation
      const actionText = `[Combat Round] I attack the ${state.combat.enemyName} with ${weapon}. I rolled a ${roll} (Total: ${attackTotal}).`;
      handleAction(actionText);
  };

  const handleDropItem = (itemName: string) => dispatch({ type: 'DROP_ITEM', payload: itemName });
  const handleEquipItem = (itemName: string) => dispatch({ type: 'EQUIP_ITEM', payload: itemName });
  const handleUnequipItem = (itemName: string) => dispatch({ type: 'UNEQUIP_ITEM', payload: itemName });

  const totalWeight = state.player.inventory.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
  const maxWeight = state.player.stats.strength * 2;
  const currentTerrain = state.world.mapData.tiles[`${state.player.position.x},${state.player.position.y}`]?.type || TileType.PLAINS;

  // Combine processing, cooldown, or game over states to disable interaction
  const isInteractionDisabled = isProcessing || cooldown || state.isGameOver;

  if (isInMenu) return <MainMenu onStart={startGame} onLoad={loadGame} />;

  return (
    <div className="flex flex-col h-screen w-full max-w-7xl mx-auto md:p-4">
      <div className="scanline"></div>
      
      <header className="flex-none p-4 md:rounded-t-xl bg-mythic-900 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-4">
           <button onClick={() => setIsInMenu(true)} className="text-xs text-slate-500 hover:text-white transition-colors">← MENU</button>
           <div>
              <h1 className="text-xl md:text-2xl font-serif font-bold text-mythic-gold tracking-wider uppercase">{state.player.name}</h1>
              <p className="text-xs text-slate-500 hidden md:block">{state.world.locationName}</p>
           </div>
           <AmbientSound terrain={currentTerrain} />
        </div>
        <div className="text-right">
            {state.isGameOver ? (
                <button onClick={() => setIsInMenu(true)} className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">RESTART</button>
            ) : (
                <>
                <div className="text-xs text-slate-500 uppercase tracking-widest">Turn</div>
                <div className="font-mono text-xl">{state.gameLog.length}</div>
                </>
            )}
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden md:border-x border-slate-700 bg-slate-950">
        <section className="flex-1 flex flex-col min-w-0 order-2 md:order-1 relative z-10 h-full">
          {/* Viewport: Either Map or Combat */}
          <div className="flex-none p-4 bg-slate-900 border-b border-slate-800 flex justify-center shadow-inner min-h-[400px] md:h-auto md:flex-none">
            {state.combat.isActive ? (
                <CombatView 
                    enemyName={state.combat.enemyName || 'Enemy'} 
                    enemyHp={state.combat.enemyHp || 0} 
                    enemyMaxHp={state.combat.enemyMaxHp || 10} 
                    enemyDesc={state.combat.enemyDescription || ''} 
                    playerHp={state.player.stats.hp} 
                    playerMaxHp={state.player.stats.maxHp}
                    onRoll={handleCombatRoll}
                    isRolling={combatRolling || isProcessing || cooldown}
                />
            ) : (
                <MapDisplay 
                    position={state.player.position} 
                    mapData={state.world.mapData} 
                    onMove={(dir) => handleAction(dir)} 
                    disabled={isInteractionDisabled}
                />
            )}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
            <GameLog logs={state.gameLog} isThinking={isProcessing} />
          </div>
          
          <div className="p-4 bg-mythic-900 border-t border-slate-700">
             {!state.isGameOver && !state.combat.isActive && suggestions.length > 0 && (
               <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                 {suggestions.map((sug, idx) => (
                   <button 
                    key={idx} 
                    onClick={() => handleAction(sug)} 
                    disabled={isInteractionDisabled} 
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
                 disabled={isInteractionDisabled || state.combat.isActive} 
                 placeholder={state.combat.isActive ? "Combat Active - Roll to attack!" : "What do you do?"} 
                 className="flex-1 bg-slate-950 border border-slate-600 rounded p-3 text-slate-200 focus:outline-none focus:border-mythic-gold transition-colors disabled:opacity-50 font-serif" 
                 onKeyDown={(e) => e.key === 'Enter' && handleAction(input)} 
               />
               <button 
                onClick={() => handleAction(input)} 
                disabled={isInteractionDisabled || (!input.trim() && !state.combat.isActive)} 
                className={`
                    font-bold px-6 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]
                    ${cooldown ? 'bg-slate-700 text-slate-400' : 'bg-mythic-gold text-mythic-900 hover:bg-amber-400'}
                `}
               >
                 {cooldown ? 'Recovering...' : (isProcessing ? 'Thinking...' : 'ACT')}
               </button>
             </div>
          </div>
        </section>

        <section className="w-full md:w-80 bg-mythic-900 border-l border-slate-700 flex flex-col gap-4 p-4 overflow-y-auto order-1 md:order-2 h-48 md:h-auto border-b md:border-b-0 shadow-xl z-20">
          <StatusCard stats={state.player.stats} inventory={state.player.inventory} />
          <Inventory 
            items={state.player.inventory} 
            maxWeight={maxWeight} 
            currentWeight={totalWeight} 
            onDropItem={handleDropItem} 
            onEquipItem={handleEquipItem} 
            onUnequipItem={handleUnequipItem} 
          />
        </section>
      </main>
    </div>
  );
}