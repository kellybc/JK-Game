import React, { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LogEntry, Item, CharacterStats, Quest, ItemType, TileType, CombatState } from './types';
import { generateGameTurn } from './services/geminiService';
import { StatusCard } from './components/StatusCard';
import { Inventory } from './components/Inventory';
import { GameLog } from './components/GameLog';
import { MapDisplay } from './components/MapDisplay';
import { CombatView } from './components/CombatView';
import { AmbientSound } from './components/AmbientSound';
import { JournalModal } from './components/JournalModal';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { User } from '@supabase/supabase-js';
import { Cloud, Save, LogIn, CheckCircle, Book } from 'lucide-react';

// --- INITIAL STATE GENERATOR ---
const createInitialState = (characterName: string): GameState => ({
  id: Date.now().toString(),
  player: {
    name: characterName,
    class: 'Adventurer',
    reputation: 0,
    gold: 10,
    stats: { 
        hp: 12, maxHp: 12, xp: 0, level: 1, 
        strength: 12, dexterity: 12, constitution: 12, 
        intelligence: 10, wisdom: 10, charisma: 10,
        ac: 11, supplies: 3 
    },
    inventory: [
      { id: '1', name: 'Iron Shortsword', description: 'Standard issue.', type: ItemType.WEAPON, quantity: 1, weight: 2.0, slot: 'hand', effect: { stat: 'strength', value: 0 }, equipped: true },
      { id: '2', name: 'Leather Jerkin', description: 'Stiff but sturdy.', type: ItemType.ARMOR, quantity: 1, weight: 5.0, slot: 'body', effect: { stat: 'ac', value: 1 }, equipped: true },
      { id: '3', name: 'Quest Log', description: 'Empty pages waiting for glory.', type: ItemType.TOOL, quantity: 1, weight: 0.5 }
    ],
    companions: [],
    activeQuests: [],
    journal: ["Arrived at the Gilded Griffin Inn."],
    position: { x: 0, y: 0 }
  },
  world: {
    locationName: "The Gilded Griffin Inn",
    locationDescription: "A warm, bustling tavern smelling of roasted boar and ale.",
    timeOfDay: "Evening",
    dangerLevel: 0,
    npcMemory: { "Barnaby": "Friendly", "Stranger": "Watchful" },
    mapData: {
        tiles: {
            "0,0": { type: TileType.INN, visited: true }
        }
    }
  },
  combat: { isActive: false },
  gameLog: [{
    id: 'init',
    sender: 'dm',
    content: `Welcome to the Gilded Griffin Inn, ${characterName}. You’ve arrived looking for work and glory.`,
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
  | { type: 'UPDATE_GOLD'; payload: number }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'REMOVE_ITEM'; payload: string } 
  | { type: 'DROP_ITEM'; payload: string } 
  | { type: 'EQUIP_ITEM'; payload: string }
  | { type: 'UNEQUIP_ITEM'; payload: string }
  | { type: 'SET_LOCATION'; payload: { name: string; desc: string } }
  | { type: 'UPDATE_NPC_MEMORY'; payload: Record<string, string> }
  | { type: 'UPDATE_REPUTATION'; payload: number }
  | { type: 'ADD_JOURNAL'; payload: string }
  | { type: 'UPDATE_QUESTS'; payload: { new?: Quest, completedId?: string } }
  | { type: 'UPDATE_MAP'; payload: { direction: string; terrain: TileType } }
  | { type: 'START_COMBAT'; payload: { name: string; hp: number; desc: string; type?: string } }
  | { type: 'UPDATE_COMBAT'; payload: { damage: number } }
  | { type: 'END_COMBAT' }
  | { type: 'GAME_OVER' }
  | { type: 'RESTART' };

const gameReducer = (state: GameState, action: Action): GameState => {
  let newState = state;
  switch (action.type) {
    case 'LOAD_STATE':
        const defaultState = createInitialState(action.payload.player.name || "Hero");
        return {
            ...defaultState,
            ...action.payload,
            player: {
                ...defaultState.player,
                ...action.payload.player,
                gold: action.payload.player.gold || 0,
                journal: action.payload.player.journal || [],
                stats: { ...defaultState.player.stats, ...action.payload.player.stats }
            },
            world: { ...defaultState.world, ...action.payload.world }
        };
    case 'RESTART': return state; 
    case 'ADD_LOG': newState = { ...state, gameLog: [...state.gameLog, action.payload] }; break;
    case 'UPDATE_STATS': newState = { ...state, player: { ...state.player, stats: { ...state.player.stats, ...action.payload } } }; break;
    case 'UPDATE_GOLD': newState = { ...state, player: { ...state.player, gold: Math.max(0, state.player.gold + action.payload) } }; break;
    
    case 'ADD_ITEM': {
      const idx = state.player.inventory.findIndex(i => i.name === action.payload.name);
      let newInventory = [...state.player.inventory];
      if (idx >= 0) newInventory[idx].quantity += action.payload.quantity;
      else newInventory.push({ ...action.payload, equipped: false });
      newState = { ...state, player: { ...state.player, inventory: newInventory } };
      break;
    }
    case 'REMOVE_ITEM': {
      const idx = state.player.inventory.findIndex(i => i.name === action.payload);
      if (idx === -1) return state; 
      let newInv = [...state.player.inventory];
      if (newInv[idx].quantity > 1) newInv[idx].quantity -= 1; else newInv.splice(idx, 1);
      newState = { ...state, player: { ...state.player, inventory: newInv } };
      break;
    }
    case 'DROP_ITEM': {
      const idx = state.player.inventory.findIndex(i => i.name === action.payload);
      if (idx === -1) return state;
      let newInv = [...state.player.inventory];
      newInv.splice(idx, 1);
      newState = { ...state, player: { ...state.player, inventory: newInv } };
      break;
    }
    case 'EQUIP_ITEM': {
        const idx = state.player.inventory.findIndex(i => i.name === action.payload);
        if (idx === -1) return state;
        const item = state.player.inventory[idx];
        if (!item.slot) return state;
        const newInv = state.player.inventory.map(i => (i.slot === item.slot && i.equipped) ? { ...i, equipped: false } : i);
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
    case 'SET_LOCATION': newState = { ...state, world: { ...state.world, locationName: action.payload.name, locationDescription: action.payload.desc } }; break;
    case 'UPDATE_NPC_MEMORY': newState = { ...state, world: { ...state.world, npcMemory: { ...state.world.npcMemory, ...action.payload } } }; break;
    case 'UPDATE_REPUTATION': newState = { ...state, player: { ...state.player, reputation: (state.player.reputation || 0) + action.payload } }; break;
    case 'ADD_JOURNAL': newState = { ...state, player: { ...state.player, journal: [...state.player.journal, action.payload] } }; break;
    
    case 'UPDATE_QUESTS': {
        let newQuests = [...state.player.activeQuests];
        if (action.payload.new) newQuests.push(action.payload.new);
        if (action.payload.completedId) {
            newQuests = newQuests.map(q => q.id === action.payload.completedId ? { ...q, completed: true } : q);
        }
        newState = { ...state, player: { ...state.player, activeQuests: newQuests } };
        break;
    }

    case 'UPDATE_MAP': {
        const { direction, terrain } = action.payload;
        let { x, y } = state.player.position;
        if (direction === 'NORTH') y += 1;
        if (direction === 'SOUTH') y -= 1;
        if (direction === 'EAST') x += 1;
        if (direction === 'WEST') x -= 1;
        const newTiles = { ...state.world.mapData.tiles };
        newTiles[`${x},${y}`] = { type: terrain, visited: true };
        newState = { ...state, player: { ...state.player, position: { x, y } }, world: { ...state.world, mapData: { tiles: newTiles } } };
        break;
    }

    case 'START_COMBAT': newState = { ...state, combat: { isActive: true, enemyName: action.payload.name, enemyHp: action.payload.hp, enemyMaxHp: action.payload.hp, enemyDescription: action.payload.desc, enemyType: action.payload.type, roundLog: [] } }; break;
    case 'UPDATE_COMBAT': 
        if (!state.combat.isActive || !state.combat.enemyHp) return state;
        const newEnemyHp = Math.max(0, state.combat.enemyHp - action.payload.damage);
        newState = { ...state, combat: { ...state.combat, enemyHp: newEnemyHp } };
        break;
    case 'END_COMBAT': newState = { ...state, combat: { isActive: false } }; break;
    case 'GAME_OVER': newState = { ...state, isGameOver: true }; break;
  }
  
  if (action.type !== 'GAME_OVER') {
      const saves = JSON.parse(localStorage.getItem('aetheria_saves') || '{}');
      if (newState.id) { saves[newState.id] = newState; localStorage.setItem('aetheria_saves', JSON.stringify(saves)); }
  }
  return newState;
};

// --- AUTH & MAIN MENU COMPONENT ---
const MainMenu = ({ onStart, onLoad }: { onStart: (name: string) => void, onLoad: (state: GameState) => void }) => {
    const [name, setName] = useState('');
    const [localSaves, setLocalSaves] = useState<GameState[]>([]);
    const [cloudSaves, setCloudSaves] = useState<any[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authMode, setAuthMode] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
    const [authMessage, setAuthMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const savedData = JSON.parse(localStorage.getItem('aetheria_saves') || '{}');
        setLocalSaves(Object.values(savedData));
        if (supabase) {
            supabase.auth.getUser().then(({ data: { user } }) => { setUser(user); if (user) fetchCloudSaves(); });
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); if (session?.user) fetchCloudSaves(); else setCloudSaves([]); });
            return () => subscription.unsubscribe();
        }
    }, []);

    const fetchCloudSaves = async () => {
        if (!supabase) return;
        setLoading(true);
        const { data, error } = await supabase.from('game_saves').select('*').order('updated_at', { ascending: false });
        if (!error && data) setCloudSaves(data);
        setLoading(false);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        setAuthMessage('');
        try {
            if (authMode === 'LOGIN') { const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword }); if (error) throw error; } 
            else { const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword }); if (error) throw error; setAuthMessage('Check your email for confirmation!'); }
        } catch (err: any) { setAuthMessage(err.message); }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-mythic-900 text-slate-200 p-4">
            <h1 className="text-4xl md:text-6xl font-serif text-mythic-gold mb-8 tracking-widest text-center">AETHERIA CHRONICLES</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                <div className="space-y-6">
                    <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-white">New Adventure</h2>
                        <input type="text" placeholder="Enter Character Name" className="w-full bg-slate-900 border border-slate-600 p-3 rounded mb-4 text-white outline-none" value={name} onChange={(e) => setName(e.target.value)} />
                        <button onClick={() => name && onStart(name)} disabled={!name} className="w-full bg-mythic-gold hover:bg-amber-400 text-mythic-900 font-bold py-3 rounded transition-colors disabled:opacity-50">Begin Journey</button>
                    </div>
                    {localSaves.length > 0 && (
                        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                            <h2 className="text-xl font-bold mb-4 text-white">Local Saves</h2>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                                {localSaves.map(save => (
                                    <button key={save.id} onClick={() => onLoad(save)} className="w-full text-left bg-slate-700 hover:bg-slate-600 p-3 rounded flex justify-between items-center group transition-colors">
                                        <div><div className="font-bold text-mythic-gold">{save.player.name}</div><div className="text-xs text-slate-400">Level {save.player.stats.level} • {save.world.locationName}</div></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="space-y-6">
                    {!isSupabaseConfigured() ? (
                        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 border-dashed opacity-75"><h2 className="text-xl font-bold mb-2 text-slate-400">Cloud Sync Unavailable</h2><p className="text-sm text-slate-500">Connect Supabase to enable cloud saves.</p></div>
                    ) : !user ? (
                        <div className="bg-slate-800 p-6 rounded-lg border border-slate-700 shadow-xl">
                            <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><LogIn size={20}/> Cloud Login</h2>
                            <form onSubmit={handleAuth} className="space-y-3">
                                <input type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-white" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                                <input type="password" placeholder="Password" className="w-full bg-slate-900 border border-slate-600 p-2 rounded text-white" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
                                <div className="flex gap-2"><button type="submit" onClick={() => setAuthMode('LOGIN')} className="flex-1 bg-slate-600 hover:bg-slate-500 py-2 rounded">Login</button><button type="submit" onClick={() => setAuthMode('SIGNUP')} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded">Sign Up</button></div>
                                {authMessage && <p className="text-xs text-amber-400 mt-2">{authMessage}</p>}
                            </form>
                        </div>
                    ) : (
                        <div className="bg-slate-800 p-6 rounded-lg border border-mythic-gold shadow-xl relative">
                             <button onClick={() => supabase?.auth.signOut()} className="absolute top-4 right-4 text-xs text-slate-500 hover:text-white">Sign Out</button>
                             <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2"><Cloud size={20} className="text-mythic-gold"/> Cloud Saves</h2>
                             <p className="text-xs text-slate-400 mb-4">Logged in as {user.email}</p>
                             {loading ? <p className="text-slate-500">Loading...</p> : (
                                 <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
                                    {cloudSaves.length === 0 ? <p className="text-sm text-slate-500 italic">No cloud saves found.</p> : cloudSaves.map(save => (
                                        <button key={save.id} onClick={() => onLoad(save.game_state)} className="w-full text-left bg-slate-700 hover:bg-slate-600 p-3 rounded flex justify-between items-center group transition-colors border border-slate-600 hover:border-mythic-gold">
                                            <div><div className="font-bold text-emerald-400">{save.character_name}</div><div className="text-xs text-slate-400">Lvl {save.game_state.player.stats.level} • {new Date(save.updated_at).toLocaleDateString()}</div></div>
                                            <Cloud size={16} className="text-slate-500 group-hover:text-white"/>
                                        </button>
                                    ))}
                                 </div>
                             )}
                        </div>
                    )}
                </div>
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
  const [cooldown, setCooldown] = useState(false); 
  const [suggestions, setSuggestions] = useState<string[]>(["Talk to Barkeep", "Look for quests"]);
  const [combatRolling, setCombatRolling] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'IDLE' | 'SAVING' | 'SAVED' | 'ERROR'>('IDLE');
  const [localSaveIndicator, setLocalSaveIndicator] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const userRef = useRef<User | null>(null);

  // Determine if user can interact based on processing, game over, or cooldown state
  const isInteractionDisabled = isProcessing || cooldown || state.isGameOver;

  useEffect(() => { if (supabase) supabase.auth.getUser().then(({ data: { user } }) => { userRef.current = user; }); }, []);

  const startGame = (name: string) => { dispatch({ type: 'LOAD_STATE', payload: createInitialState(name) }); setIsInMenu(false); setSuggestions(["Talk to Barkeep", "Check Inventory"]); };
  const loadGame = (loadedState: GameState) => { dispatch({ type: 'LOAD_STATE', payload: loadedState }); setIsInMenu(false); };

  const handleCloudSave = useCallback(async (isAuto = false) => {
      if (!supabase) return;
      const user = userRef.current || (await supabase.auth.getUser()).data.user;
      if (!user) return;
      if (!isAuto) setSaveStatus('SAVING');
      try {
          const { error } = await supabase.from('game_saves').upsert({ user_id: user.id, save_id: state.id, character_name: state.player.name, game_state: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id, save_id' });
          if (error) throw error;
          if (!isAuto) { setSaveStatus('SAVED'); setTimeout(() => setSaveStatus('IDLE'), 2000); }
      } catch (err) { if (!isAuto) { setSaveStatus('ERROR'); setTimeout(() => setSaveStatus('IDLE'), 3000); } }
  }, [state]);

  const handleAction = async (actionText: string) => {
    if ((!actionText.trim() && !state.combat.isActive) || isProcessing || cooldown || state.isGameOver) return;
    setIsProcessing(true); setSuggestions([]); dispatch({ type: 'ADD_LOG', payload: { id: Date.now().toString(), sender: 'player', content: actionText, timestamp: Date.now() } });

    try {
      const response = await generateGameTurn(state, actionText);
      dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 1).toString(), sender: 'dm', content: response.narrative, timestamp: Date.now() } });
      const newHp = Math.min(state.player.stats.maxHp, Math.max(0, state.player.stats.hp + response.hp_change));
      const newSupplies = Math.max(0, state.player.stats.supplies - response.supplies_consumed);
      const newXp = state.player.stats.xp + response.xp_gained;
      let newLevel = state.player.stats.level;
      let newMaxHp = state.player.stats.maxHp;
      if (newXp >= newLevel * 100) { newLevel++; newMaxHp += 5; dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 2).toString(), sender: 'system', content: `LEVEL UP! Level ${newLevel}.`, timestamp: Date.now() } }); }
      
      dispatch({ type: 'UPDATE_STATS', payload: { hp: newHp, supplies: newSupplies, xp: newXp, level: newLevel, maxHp: newMaxHp } });
      if (response.gold_change) dispatch({ type: 'UPDATE_GOLD', payload: response.gold_change });
      response.items_added?.forEach(item => dispatch({ type: 'ADD_ITEM', payload: item }));
      response.items_removed_names?.forEach(name => dispatch({ type: 'REMOVE_ITEM', payload: name }));
      if (response.new_location_name) dispatch({ type: 'SET_LOCATION', payload: { name: response.new_location_name, desc: response.new_location_description || '' } });
      if (response.movement_direction || response.current_terrain_type) dispatch({ type: 'UPDATE_MAP', payload: { direction: response.movement_direction || 'NONE', terrain: response.current_terrain_type || TileType.UNKNOWN } });
      if (response.updated_npc_memories) dispatch({ type: 'UPDATE_NPC_MEMORY', payload: response.updated_npc_memories });
      if (response.reputation_change) dispatch({ type: 'UPDATE_REPUTATION', payload: response.reputation_change });
      if (response.new_quest || response.quest_completed_id) dispatch({ type: 'UPDATE_QUESTS', payload: { new: response.new_quest, completedId: response.quest_completed_id } });
      if (response.new_journal_entry) dispatch({ type: 'ADD_JOURNAL', payload: response.new_journal_entry });

      if (response.combat_start) dispatch({ type: 'START_COMBAT', payload: { name: response.enemy_name || 'Unknown Enemy', hp: response.enemy_hp || 10, desc: response.enemy_desc || 'A menacing foe.', type: response.enemy_type } });
      if (response.enemy_damage_taken) dispatch({ type: 'UPDATE_COMBAT', payload: { damage: response.enemy_damage_taken } });
      if (response.combat_ended) dispatch({ type: 'END_COMBAT' });

      if (newHp <= 0 || response.is_game_over) { dispatch({ type: 'GAME_OVER' }); dispatch({ type: 'ADD_LOG', payload: { id: (Date.now() + 3).toString(), sender: 'system', content: "GAME OVER.", timestamp: Date.now() } }); }
      else setSuggestions(response.suggested_actions || []);
      
      setLocalSaveIndicator(true); setTimeout(() => setLocalSaveIndicator(false), 2000);
      if (isSupabaseConfigured()) handleCloudSave(true);
    } catch (error) { dispatch({ type: 'ADD_LOG', payload: { id: Date.now().toString(), sender: 'system', content: "API Error.", timestamp: Date.now() } }); }
    finally { setIsProcessing(false); setInput(''); setCombatRolling(false); setCooldown(true); setTimeout(() => setCooldown(false), 6000); }
  };

  const handleCombatRoll = (roll: number) => {
      setCombatRolling(true);
      const equippedWeapon = state.player.inventory.find(i => i.equipped && i.slot === 'hand');
      const weaponName = equippedWeapon?.name || "Fists";
      const strScore = state.player.stats.strength + (equippedWeapon?.effect?.stat === 'strength' ? equippedWeapon.effect.value : 0);
      const strMod = Math.floor((strScore - 10) / 2);
      const totalAttack = roll + strMod + 2; 
      let narrative = "";
      if (roll === 20) narrative = `(NATURAL 20!) Critical Hit! I rolled a perfect 20 with my ${weaponName}.`;
      else if (roll === 1) narrative = `(NATURAL 1!) Critical Miss! I fumbled my attack with ${weaponName}.`;
      else narrative = `[Combat Round] I rolled a ${roll} (Total ${totalAttack} to hit) with my ${weaponName}.`;
      handleAction(narrative);
  };

  const handleDropItem = (name: string) => dispatch({ type: 'DROP_ITEM', payload: name });
  const handleEquipItem = (name: string) => dispatch({ type: 'EQUIP_ITEM', payload: name });
  const handleUnequipItem = (name: string) => dispatch({ type: 'UNEQUIP_ITEM', payload: name });
  const totalWeight = state.player.inventory.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
  const maxWeight = state.player.stats.strength * 5; 
  const currentTerrain = state.world.mapData.tiles[`${state.player.position.x},${state.player.position.y}`]?.type || TileType.INN;

  if (isInMenu) return <MainMenu onStart={startGame} onLoad={loadGame} />;

  return (
    <div className="flex flex-col h-screen w-full max-w-7xl mx-auto md:p-4">
      <div className="scanline"></div>
      <header className="flex-none p-4 md:rounded-t-xl bg-mythic-900 border-b border-slate-700 flex justify-between items-center relative z-20">
        <div className="flex items-center gap-4">
           <button onClick={() => setIsInMenu(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs font-bold transition-colors border border-slate-700">← SAVE & EXIT</button>
           <div className="hidden md:block">
              <h1 className="text-xl md:text-2xl font-serif font-bold text-mythic-gold tracking-wider uppercase">{state.player.name}</h1>
              <p className="text-xs text-slate-500">{state.world.locationName}</p>
           </div>
           <AmbientSound terrain={state.world.mapData.tiles[`${state.player.position.x},${state.player.position.y}`]?.type || TileType.INN} isCombat={state.combat.isActive} />
        </div>
        <div className="flex items-center gap-4 text-right">
            <button onClick={() => setShowJournal(true)} className="text-amber-500 hover:text-amber-400" title="Open Journal"><Book size={24}/></button>
            {localSaveIndicator && <span className="text-[10px] text-emerald-500 uppercase tracking-widest flex items-center gap-1 animate-pulse"><CheckCircle size={10} /> Saved</span>}
            {isSupabaseConfigured() && !state.isGameOver && (
                <button onClick={() => handleCloudSave(false)} disabled={saveStatus !== 'IDLE'} className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${saveStatus === 'SAVED' ? 'bg-emerald-600 text-white' : saveStatus === 'ERROR' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                    <Save size={14} /><span className="hidden sm:inline">{saveStatus === 'SAVING' ? 'Syncing...' : saveStatus === 'SAVED' ? 'Saved' : saveStatus === 'ERROR' ? 'Error' : 'Cloud Save'}</span>
                </button>
            )}
            {state.isGameOver ? <button onClick={() => setIsInMenu(true)} className="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold animate-pulse">RESTART</button> : <div className="hidden md:block"><div className="text-xs text-slate-500 uppercase tracking-widest">Turn</div><div className="font-mono text-xl">{state.gameLog.length}</div></div>}
        </div>
      </header>
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden md:border-x border-slate-700 bg-slate-950 relative z-10">
        <section className="flex-1 flex flex-col min-w-0 order-2 md:order-1 relative z-10 h-full">
          <div className="flex-none p-4 bg-slate-900 border-b border-slate-800 flex justify-center shadow-inner min-h-[400px] md:h-auto md:flex-none">
            {state.combat.isActive ? (
                <CombatView 
                    enemyName={state.combat.enemyName || 'Enemy'} 
                    enemyHp={state.combat.enemyHp || 0} 
                    enemyMaxHp={state.combat.enemyMaxHp || 10} 
                    enemyDesc={state.combat.enemyDescription || ''} 
                    enemyType={state.combat.enemyType}
                    playerHp={state.player.stats.hp} 
                    playerMaxHp={state.player.stats.maxHp}
                    onRoll={handleCombatRoll}
                    isRolling={combatRolling || isProcessing || cooldown}
                />
            ) : (
                <MapDisplay position={state.player.position} mapData={state.world.mapData} onMove={(dir) => handleAction(dir)} disabled={isInteractionDisabled} />
            )}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-950"><GameLog logs={state.gameLog} isThinking={isProcessing} /></div>
          <div className="p-4 bg-mythic-900 border-t border-slate-700">
             {!state.isGameOver && !state.combat.isActive && suggestions.length > 0 && (
               <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                 {suggestions.map((sug, idx) => (<button key={idx} onClick={() => handleAction(sug)} disabled={isInteractionDisabled} className="whitespace-nowrap px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-mythic-gold transition-colors disabled:opacity-50">{sug}</button>))}
               </div>
             )}
             <div className="flex gap-2">
               <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isInteractionDisabled || state.combat.isActive} placeholder={state.combat.isActive ? "Combat Active - Roll to attack!" : "What do you do?"} className="flex-1 bg-slate-950 border border-slate-600 rounded p-3 text-slate-200 focus:outline-none focus:border-mythic-gold transition-colors disabled:opacity-50 font-serif" onKeyDown={(e) => e.key === 'Enter' && handleAction(input)} />
               <button onClick={() => handleAction(input)} disabled={isInteractionDisabled || (!input.trim() && !state.combat.isActive)} className={`font-bold px-6 py-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] ${cooldown ? 'bg-slate-700 text-slate-400' : 'bg-mythic-gold text-mythic-900 hover:bg-amber-400'}`}>{cooldown ? 'Recovering...' : (isProcessing ? 'Thinking...' : 'ACT')}</button>
             </div>
          </div>
        </section>
        <section className="w-full md:w-80 bg-mythic-900 border-l border-slate-700 flex flex-col gap-4 p-4 overflow-y-auto order-1 md:order-2 h-48 md:h-auto border-b md:border-b-0 shadow-xl z-20">
          <StatusCard stats={state.player.stats} inventory={state.player.inventory} reputation={state.player.reputation} gold={state.player.gold} />
          <Inventory items={state.player.inventory} maxWeight={state.player.stats.strength * 5} currentWeight={state.player.inventory.reduce((acc, i) => acc + (i.weight * i.quantity), 0)} onDropItem={(n) => dispatch({ type: 'DROP_ITEM', payload: n })} onEquipItem={(n) => dispatch({ type: 'EQUIP_ITEM', payload: n })} onUnequipItem={(n) => dispatch({ type: 'UNEQUIP_ITEM', payload: n })} />
        </section>
      </main>
      
      {showJournal && <JournalModal quests={state.player.activeQuests} notes={state.player.journal} onClose={() => setShowJournal(false)} />}
    </div>
  );
}