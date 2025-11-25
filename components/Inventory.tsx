import React, { useState } from 'react';
import { Item, ItemType } from '../types';

interface InventoryProps {
  items: Item[];
  maxWeight: number;
  currentWeight: number;
  onDropItem: (itemName: string) => void;
  onEquipItem: (itemName: string) => void;
  onUnequipItem: (itemName: string) => void;
}

const typeIcons: Record<ItemType, string> = {
  [ItemType.WEAPON]: '⚔️',
  [ItemType.ARMOR]: '🛡️',
  [ItemType.CONSUMABLE]: '🧪',
  [ItemType.KEY]: '🔑',
  [ItemType.ARTIFACT]: '🔮',
  [ItemType.TOOL]: '🛠️',
};

// --- MODAL COMPONENT ---
const ItemModal = ({ item, onClose, onDrop, onEquip, onUnequip }: { 
    item: Item; 
    onClose: () => void; 
    onDrop: () => void;
    onEquip: () => void;
    onUnequip: () => void;
}) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-mythic-800 border-2 border-mythic-gold rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
                <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-white">✕</button>
                
                <div className="text-center mb-4">
                    <span className="text-4xl block mb-2">{typeIcons[item.type]}</span>
                    <h2 className="text-xl font-serif font-bold text-mythic-gold">{item.name}</h2>
                    {item.equipped && <span className="bg-emerald-900 text-emerald-300 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold">Equipped</span>}
                    <div className="text-xs uppercase text-slate-500 tracking-widest mt-1">{item.type} {item.slot ? `• ${item.slot}` : ''}</div>
                </div>
                
                <p className="text-slate-300 text-sm italic mb-6 border-y border-slate-700 py-3 leading-relaxed">"{item.description}"</p>
                
                <div className="grid grid-cols-2 gap-2 text-sm mb-6">
                    <div className="bg-slate-900 p-2 rounded">
                        <span className="block text-slate-500 text-xs">Weight</span>
                        <span className="font-mono text-white">{item.weight}</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded">
                        <span className="block text-slate-500 text-xs">Effect</span>
                        <span className="font-mono text-white">{item.effect ? `+${item.effect.value} ${item.effect.stat.substring(0,3).toUpperCase()}` : '-'}</span>
                    </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    {item.slot && item.slot !== 'none' && (
                        item.equipped ? (
                            <button onClick={() => { onUnequip(); onClose(); }} className="w-full bg-slate-600 hover:bg-slate-500 text-white py-2 rounded">Unequip</button>
                        ) : (
                            <button onClick={() => { onEquip(); onClose(); }} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-2 rounded">Equip</button>
                        )
                    )}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded">Close</button>
                        <button onClick={() => { onDrop(); onClose(); }} className="flex-1 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-100 py-2 rounded">Drop</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Inventory: React.FC<InventoryProps> = ({ items, maxWeight, currentWeight, onDropItem, onEquipItem, onUnequipItem }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const isOverencumbered = currentWeight > maxWeight;

  return (
    <>
        <div className="bg-mythic-800 border border-slate-600 rounded-lg p-4 shadow-lg h-full overflow-hidden flex flex-col relative">
        <h3 className="text-mythic-gold font-serif text-lg font-bold border-b border-slate-600 pb-2 mb-3 flex justify-between">
            <span>Inventory</span>
            <span className={`text-xs font-mono self-end ${isOverencumbered ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                {currentWeight.toFixed(1)} / {maxWeight} kg
            </span>
        </h3>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide pr-1">
            {items.length === 0 ? (
            <p className="text-slate-500 italic text-center text-sm py-4">Your satchel is empty.</p>
            ) : (
            <ul className="space-y-2">
                {items.map((item, idx) => (
                <li 
                    key={`${item.id}-${idx}`} 
                    onClick={() => setSelectedItem(item)}
                    className={`
                        p-2 rounded border flex items-start cursor-pointer transition-all
                        ${item.equipped ? 'bg-emerald-900/20 border-emerald-700/50' : 'bg-mythic-900/50 border-slate-700 hover:bg-slate-800 hover:border-mythic-gold'}
                    `}
                >
                    <span className="text-xl mr-3 select-none">{typeIcons[item.type]}</span>
                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                        <span className={`font-medium truncate ${item.equipped ? 'text-emerald-300' : 'text-slate-200'}`}>
                            {item.name} {item.equipped && ' (E)'}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">x{item.quantity}</span>
                    </div>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>
        </div>

        {selectedItem && (
            <ItemModal 
                item={selectedItem} 
                onClose={() => setSelectedItem(null)} 
                onDrop={() => onDropItem(selectedItem.name)}
                onEquip={() => onEquipItem(selectedItem.name)}
                onUnequip={() => onUnequipItem(selectedItem.name)}
            />
        )}
    </>
  );
};