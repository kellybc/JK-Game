import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GameState, AIResponse, ItemType, TileType } from "../types";

// Helper interface for the raw JSON from Gemini
interface RawAIResponse extends Omit<AIResponse, 'updated_npc_memories'> {
    updated_npc_memories?: { npcName: string; memory: string }[];
}

// Define the response schema
const aiResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    narrative: {
      type: Type.STRING,
      description: "The description of what happens. Vivid RPG language. Max 3 sentences.",
    },
    hp_change: { type: Type.INTEGER },
    xp_gained: { type: Type.INTEGER },
    supplies_consumed: { type: Type.INTEGER },
    gold_change: { type: Type.INTEGER, description: "Gold earned or spent." },
    items_added: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          type: { type: Type.STRING, enum: Object.values(ItemType) },
          quantity: { type: Type.INTEGER },
          weight: { type: Type.NUMBER },
          slot: { type: Type.STRING, enum: ['hand', 'body', 'head', 'accessory', 'none'] },
          effect: { 
              type: Type.OBJECT,
              properties: {
                  stat: { type: Type.STRING, enum: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'hp', 'maxHp', 'ac'] },
                  value: { type: Type.INTEGER }
              }
          }
        },
        required: ["id", "name", "description", "type", "quantity", "weight"]
      }
    },
    items_removed_names: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    new_location_name: { type: Type.STRING },
    new_location_description: { type: Type.STRING },
    updated_npc_memories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
            npcName: { type: Type.STRING },
            memory: { type: Type.STRING }
        },
        required: ["npcName", "memory"]
      }
    },
    reputation_change: { type: Type.INTEGER },
    new_quest: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, enum: ['MINI', 'MAIN', 'WORLD'] },
        completed: { type: Type.BOOLEAN },
      },
    },
    quest_completed_id: { type: Type.STRING },
    new_journal_entry: { type: Type.STRING, description: "Important clue, note, or summary to add to player journal." },
    suggested_actions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    is_game_over: { type: Type.BOOLEAN },
    // MAP FIELDS
    movement_direction: {
      type: Type.STRING,
      enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NONE'],
      description: "Direction the player moved this turn. Infer from narrative if needed."
    },
    current_terrain_type: {
      type: Type.STRING,
      enum: Object.values(TileType),
      description: "The visual terrain type of the CURRENT location."
    },
    // COMBAT FIELDS
    combat_start: { type: Type.BOOLEAN, description: "True if a new fight begins this turn." },
    enemy_name: { type: Type.STRING },
    enemy_desc: { type: Type.STRING },
    enemy_type: { type: Type.STRING, description: "Visual keyword for enemy (e.g. 'orc', 'dragon', 'bandit')" },
    enemy_hp: { type: Type.INTEGER, description: "Starting HP of new enemy." },
    enemy_damage_taken: { type: Type.INTEGER, description: "Damage dealt to enemy this turn." },
    combat_ended: { type: Type.BOOLEAN, description: "True if the enemy is defeated or player fled." }
  },
  required: [
    "narrative",
    "hp_change",
    "xp_gained",
    "supplies_consumed",
    "items_added",
    "items_removed_names",
    "suggested_actions",
    "movement_direction",
    "current_terrain_type"
  ],
};

export const generateGameTurn = async (
  currentState: GameState,
  playerAction: string
): Promise<AIResponse> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return {
      narrative: "Configuration Error: API_KEY is missing.",
      hp_change: 0, xp_gained: 0, supplies_consumed: 0, items_added: [], items_removed_names: [], suggested_actions: [], is_game_over: false, movement_direction: 'NONE', current_terrain_type: TileType.UNKNOWN
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Calculate Stat Modifiers for Context
  const getMod = (score: number) => Math.floor((score - 10) / 2);
  const stats = currentState.player.stats;
  const modifiers = {
      STR: getMod(stats.strength),
      DEX: getMod(stats.dexterity),
      CON: getMod(stats.constitution),
      INT: getMod(stats.intelligence),
      WIS: getMod(stats.wisdom),
      CHA: getMod(stats.charisma),
  };

  const totalWeight = currentState.player.inventory.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
  const maxWeight = stats.strength * 5; 

  const contextSummary = {
    player: {
      name: currentState.player.name,
      gold: currentState.player.gold,
      reputation: currentState.player.reputation,
      stats: currentState.player.stats,
      modifiers: modifiers,
      encumbrance: { current: totalWeight, max: maxWeight, is_overencumbered: totalWeight > maxWeight },
      inventory: currentState.player.inventory.map(i => `${i.name} ${i.equipped ? '(Equipped)' : ''} (x${i.quantity})`),
      active_quests: currentState.player.activeQuests.map(q => `${q.title} (${q.type})`),
    },
    world: {
      location: currentState.world.locationName,
      desc: currentState.world.locationDescription,
      time: currentState.world.timeOfDay,
      npcs_nearby: Object.keys(currentState.world.npcMemory),
      map_tile_type: currentState.world.mapData.tiles[`${currentState.player.position.x},${currentState.player.position.y}`]?.type
    },
    combat_active: currentState.combat.isActive,
    enemy_status: currentState.combat.isActive ? {
        name: currentState.combat.enemyName,
        current_hp: currentState.combat.enemyHp,
        type: currentState.combat.enemyType
    } : null,
    recent_history: currentState.gameLog.slice(-5).map(log => `${log.sender}: ${log.content}`).join("\n"),
  };

  const systemPrompt = `
    You are the Dungeon Master for 'Aetheria Chronicles'. 
    
    PACING & QUESTS:
    1. Start the game at an Inn/Tavern with NPCs.
    2. Offer 'MINI' quests (quick jobs, 15m), 'MAIN' quests (chapter goals, 1h), and 'WORLD' events.
    3. REPUTATION: Actions affect reputation. High rep = better prices/info. Low rep = hostility.
    4. MONEY: Award GOLD for quests/loot. Charge GOLD for services/items.
    5. JOURNAL: If the player learns a key clue or accepts a quest, add a 'new_journal_entry'.
    
    COMBAT RULES (D20 System):
    1. Context will provide a ROLL. 
    2. NATURAL 20: Critical Hit (Double Damage) or guaranteed success. Narrate heroically!
    3. NATURAL 1: Critical Miss/Fumble. Narrate a comedic or painful failure.
    4. HIT LOGIC: If (Roll + Modifier) >= Enemy AC (assume 10-15 for mobs), it hits.
    
    STATS:
    Use D&D 5e style stats (STR, DEX, etc.). 
    - Strength: Melee damage/carry.
    - Dexterity: Ranged/Initiative/AC.
    - Constitution: HP.
    - Intelligence/Wisdom: Clues/Magic.
    - Charisma: Persuasion/Prices.
    
    CONTEXT:
    ${JSON.stringify(contextSummary, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: playerAction,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: aiResponseSchema,
        temperature: 0.7, 
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response");
    
    const rawData = JSON.parse(text) as RawAIResponse;
    const memoryRecord: Record<string, string> = {};
    if (rawData.updated_npc_memories) {
        rawData.updated_npc_memories.forEach(item => {
            memoryRecord[item.npcName] = item.memory;
        });
    }

    return { ...rawData, updated_npc_memories: memoryRecord } as AIResponse;

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        return {
            narrative: "You are breathless. The world spins. You must rest. (Rate Limit - Wait 6s)",
            hp_change: 0, xp_gained: 0, supplies_consumed: 0, items_added: [], items_removed_names: [],
            suggested_actions: ["Wait"], is_game_over: false, movement_direction: 'NONE', current_terrain_type: TileType.UNKNOWN
        };
    }

    return {
      narrative: `The Weave is tangled. (Error: ${errorMessage})`,
      hp_change: 0, xp_gained: 0, supplies_consumed: 0, items_added: [], items_removed_names: [],
      suggested_actions: ["Wait"], is_game_over: false, movement_direction: 'NONE', current_terrain_type: TileType.UNKNOWN
    };
  }
};