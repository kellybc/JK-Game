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
        },
        required: ["id", "name", "description", "type", "quantity"]
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
    // NEW MAP FIELDS
    movement_direction: {
      type: Type.STRING,
      enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'NONE'],
      description: "Direction the player moved this turn. NONE if they stayed in place."
    },
    current_terrain_type: {
      type: Type.STRING,
      enum: Object.values(TileType),
      description: "The visual terrain type of the CURRENT location (after movement)."
    }
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
    console.error("API Key is missing.");
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

  const contextSummary = {
    player: {
      stats: currentState.player.stats,
      inventory: currentState.player.inventory.map(i => `${i.name} (${i.quantity})`),
      position: currentState.player.position, // Send coords so AI knows context
    },
    world: {
      location: currentState.world.locationName,
      desc: currentState.world.locationDescription,
      time: currentState.world.timeOfDay
    },
    recent_history: currentState.gameLog.slice(-5).map(log => `${log.sender}: ${log.content}`).join("\n"),
  };

  const systemPrompt = `
    You are the Dungeon Master for 'Aetheria'. 
    
    RULES:
    1. Narrative: Concise, immersive.
    2. Mechanics: 
       - If player says "Walk North" and it's possible, set 'movement_direction' to 'NORTH'.
       - Assign a 'current_terrain_type' that matches the location description.
    3. Inventory: Manage items logically.
    4. Difficulty: Fair but challenging.
    
    CURRENT CONTEXT:
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

    return {
        ...rawData,
        updated_npc_memories: memoryRecord
    } as AIResponse;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      narrative: `The mists of time obscure your path. (API Error: ${error instanceof Error ? error.message : "Unknown"})`,
      hp_change: 0,
      xp_gained: 0,
      supplies_consumed: 0,
      items_added: [],
      items_removed_names: [],
      suggested_actions: ["Wait"],
      is_game_over: false,
      movement_direction: 'NONE',
      current_terrain_type: TileType.UNKNOWN
    };
  }
};