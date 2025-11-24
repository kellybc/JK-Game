import React, { useState } from 'react';
import { Item, ItemType } from '../types';

interface InventoryProps {
  items: Item[];
  onDropItem: (itemName: string) => void;
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
const ItemModal = ({ item, onClose, onDrop }: { item: Item; onClose: () => void; onDrop: () => void }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-mythic-800 border-2 border-mythic-gold rounded-lg p-6 max-w-sm w-full shadow-2xl relative">
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-400 hover:text-white"
                >
                    ✕
                </button>
                
                <div className="text-center mb-4">
                    <span className="text-4xl block mb-2">{typeIcons[item.type]}</span>
                    <h2 className="text-xl font-serif font-bold text-mythic-gold">{item.name}</h2>
                    <span className="text-xs uppercase text-slate-500 tracking-widest">{item.type}</span>
                </div>
                
                <p className="text-slate-300 text-sm italic mb-6 border-y border-slate-700 py-3 leading-relaxed">
                    "{item.description}"
                </p>
                
                <div className="flex justify-between items-center text-sm mb-4">
                    <span className="text-slate-400">Quantity Held:</span>
                    <span className="font-mono text-white text-lg">{item.quantity}</span>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={onClose}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition-colors"
                    >
                        Close
                    </button>
                    <button 
                        onClick={() => { onDrop(); onClose(); }}
                        className="flex-1 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-100 py-2 rounded transition-colors"
                    >
                        Drop Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export const Inventory: React.FC<InventoryProps> = ({ items, onDropItem }) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  return (
    <>
        <div className="bg-mythic-800 border border-slate-600 rounded-lg p-4 shadow-lg h-full overflow-hidden flex flex-col relative">
        <h3 className="text-mythic-gold font-serif text-lg font-bold border-b border-slate-600 pb-2 mb-3 flex justify-between">
            <span>Inventory</span>
            <span className="text-xs font-sans font-normal text-slate-500 self-end">Click for details</span>
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
                    className="bg-mythic-900/50 p-2 rounded border border-slate-700 flex items-start cursor-pointer hover:bg-slate-800 hover:border-mythic-gold transition-all"
                >
                    <span className="text-xl mr-3 select-none" role="img" aria-label={item.type}>
                    {typeIcons[item.type] || '📦'}
                    </span>
                    <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                        <span className="text-slate-200 font-medium truncate">{item.name}</span>
                        <span className="text-xs text-slate-500 ml-2">x{item.quantity}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                        {item.description}
                    </p>
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
            />
        )}
    </>
  );
};