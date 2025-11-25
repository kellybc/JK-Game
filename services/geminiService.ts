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
                  stat: { type: Type.STRING, enum: ['strength', 'defense', 'hp', 'maxHp'] },
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
    new_quest: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        completed: { type: Type.BOOLEAN },
      },
    },
    quest_completed_id: { type: Type.STRING },
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
      hp_change: 0,
      xp_gained: 0,
      supplies_consumed: 0,
      items_added: [],
      items_removed_names: [],
      suggested_actions: [],
      is_game_over: false,
      movement_direction: 'NONE',
      current_terrain_type: TileType.UNKNOWN
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Calculate equipped stats for context
  const equippedItems = currentState.player.inventory.filter(i => i.equipped);
  const totalStr = currentState.player.stats.strength + equippedItems.reduce((acc, i) => acc + (i.effect?.stat === 'strength' ? i.effect.value : 0), 0);
  const totalDef = currentState.player.stats.defense + equippedItems.reduce((acc, i) => acc + (i.effect?.stat === 'defense' ? i.effect.value : 0), 0);
  
  // Calculate weight
  const totalWeight = currentState.player.inventory.reduce((acc, i) => acc + (i.weight * i.quantity), 0);
  const maxWeight = totalStr * 2;
  const isOverencumbered = totalWeight > maxWeight;

  const contextSummary = {
    player: {
      base_stats: currentState.player.stats,
      effective_combat_stats: { strength: totalStr, defense: totalDef },
      encumbrance: { current: totalWeight, max: maxWeight, is_overencumbered: isOverencumbered },
      inventory: currentState.player.inventory.map(i => `${i.name} ${i.equipped ? '(Equipped)' : ''} (x${i.quantity})`),
      position: currentState.player.position, 
    },
    world: {
      location: currentState.world.locationName,
      desc: currentState.world.locationDescription,
      time: currentState.world.timeOfDay,
      map_tile_type: currentState.world.mapData.tiles[`${currentState.player.position.x},${currentState.player.position.y}`]?.type
    },
    combat_active: currentState.combat.isActive,
    enemy_status: currentState.combat.isActive ? {
        name: currentState.combat.enemyName,
        current_hp: currentState.combat.enemyHp
    } : null,
    recent_history: currentState.gameLog.slice(-5).map(log => `${log.sender}: ${log.content}`).join("\n"),
  };

  const systemPrompt = `
    You are the Dungeon Master for 'Aetheria Chronicles'. 
    
    CAMPAIGN GOAL: Find the "Aether Core" deep in a Dungeon. Start in Plains/Forest.
    
    COMBAT RULES:
    1. If the player attacks an enemy, resolve the round. The player will provide a DICE ROLL (d20). Use it + their Strength to determine hit/damage.
    2. If an enemy appears, set 'combat_start': true, and provide 'enemy_name', 'enemy_hp', 'enemy_desc'.
    3. If the enemy dies, set 'combat_ended': true.
    
    INVENTORY RULES:
    1. If 'is_overencumbered' is true, the player moves slower and has disadvantage in combat (narrate this).
    2. Items should have realistic weights (e.g., Dagger 1.0, Armor 10.0, Potion 0.1).
    
    MAP RULES:
    1. 'movement_direction': If player walks/moves, infer NORTH/SOUTH/EAST/WEST.
    2. 'current_terrain_type': Must match the environment (TOWN, FOREST, DUNGEON, etc.).
    
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
    
    // Improved Error Handling for UI
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for Rate Limits (429)
    if (errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        return {
            narrative: "A sudden wave of exhaustion washes over you. The magical energies of the world are too dense right now. You must catch your breath for a moment. (Rate Limit Reached - Please wait 5 seconds before acting)",
            hp_change: 0, xp_gained: 0, supplies_consumed: 0, items_added: [], items_removed_names: [],
            suggested_actions: ["Wait"], is_game_over: false, movement_direction: 'NONE', current_terrain_type: TileType.UNKNOWN
        };
    }

    return {
      narrative: "The mists of reality swirl chaotically, preventing your action. (The Dungeon Master is confused. Please try again.)",
      hp_change: 0, xp_gained: 0, supplies_consumed: 0, items_added: [], items_removed_names: [],
      suggested_actions: ["Wait"], is_game_over: false, movement_direction: 'NONE', current_terrain_type: TileType.UNKNOWN
    };
  }
};