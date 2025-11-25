export enum ItemType {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  CONSUMABLE = 'CONSUMABLE',
  KEY = 'KEY',
  ARTIFACT = 'ARTIFACT',
  TOOL = 'TOOL'
}

export type EquipmentSlot = 'hand' | 'body' | 'head' | 'accessory' | 'none';

export interface ItemEffect {
  stat: 'strength' | 'defense' | 'hp' | 'maxHp';
  value: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  quantity: number;
  weight: number;
  slot?: EquipmentSlot;
  effect?: ItemEffect;
  equipped?: boolean;
}

export interface CharacterStats {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  strength: number;
  defense: number;
  supplies: number; // Food/Water
}

export interface Companion {
  name: string;
  role: string;
  status: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

// --- MAP TYPES ---
export enum TileType {
  TOWN = 'TOWN',
  FOREST = 'FOREST',
  MOUNTAIN = 'MOUNTAIN',
  DUNGEON = 'DUNGEON',
  PLAINS = 'PLAINS',
  WATER = 'WATER',
  UNKNOWN = 'UNKNOWN'
}

export interface WorldMap {
  // Key is "x,y" string (e.g. "0,0"), Value is the tile data
  tiles: Record<string, { type: TileType; visited: boolean }>;
}

export interface Coordinates {
  x: number;
  y: number;
}

// --- COMBAT TYPES ---
export interface CombatState {
  isActive: boolean;
  enemyName?: string;
  enemyHp?: number;
  enemyMaxHp?: number;
  enemyDescription?: string;
  roundLog?: string[];
}

// --- STATE ---
export interface GameState {
  id: string; // Unique Save ID
  player: {
    name: string;
    stats: CharacterStats;
    inventory: Item[];
    companions: Companion[];
    activeQuests: Quest[];
    position: Coordinates;
  };
  world: {
    locationName: string;
    locationDescription: string;
    timeOfDay: string;
    dangerLevel: number;
    npcMemory: Record<string, string>;
    mapData: WorldMap;
  };
  combat: CombatState;
  gameLog: LogEntry[];
  turnCount: number;
  isGameOver: boolean;
}

export interface LogEntry {
  id: string;
  sender: 'dm' | 'player' | 'system';
  content: string;
  timestamp: number;
}

// Structure expected from Gemini
export interface AIResponse {
  narrative: string;
  hp_change: number; 
  xp_gained: number;
  supplies_consumed: number;
  items_added: Item[];
  items_removed_names: string[];
  new_location_name?: string;
  new_location_description?: string;
  updated_npc_memories?: Record<string, string>;
  new_quest?: Quest;
  quest_completed_id?: string;
  suggested_actions: string[];
  is_game_over?: boolean;
  // Map Fields
  movement_direction?: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'NONE';
  current_terrain_type?: TileType;
  // Combat Fields
  combat_start?: boolean;
  enemy_name?: string;
  enemy_desc?: string;
  enemy_hp?: number; // Starting HP
  enemy_damage_taken?: number; // Damage enemy took this turn
  combat_ended?: boolean;
}