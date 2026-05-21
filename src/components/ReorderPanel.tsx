import { useState } from 'react';
import type { CardInstance } from '../game/types';
import { CARD_DEFS } from '../game/cards';

interface Props {
  initialDeck: CardInstance[];
  reignCount: number;
  onReorder: (deck: CardInstance[]) => void;
  onConfirm: () => void;
}

export default function ReorderPanel({ initialDeck, reignCount, onReorder, onConfirm }: Props) {
  const [deck, setDeck] = useState<CardInstance[]>(() => [...initialDeck]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const handleDragStart = (i: number) => {
    setDragIdx(i);
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setOverIdx(i);
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const next = [...deck];
    const [removed] = next.splice(dragIdx, 1);
    next.splice(i, 0, removed);
    setDeck(next);
    onReorder(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div className="card-area">
      <div className="card-area-header">
        <span className="card-area-title">◈ DECK ORDER — Reign #{reignCount}</span>
        <span className="card-area-hint">ドラッグで並び替え</span>
        <button className="primary" onClick={onConfirm} style={{ marginLeft: 'auto', padding: '4px 14px', fontSize: 12 }}>
          IGNITE ▶
        </button>
      </div>
      <div className="card-row">
        {deck.map((card, i) => {
          const def = CARD_DEFS[card.defId];
          const rarity = def?.rarity ?? 'common';
          let cls = `card-tile card-tile--draggable rarity-${rarity}`;
          if (dragIdx === i) cls += ' card-tile--dragging';
          if (overIdx === i && dragIdx !== i) cls += ' card-tile--drag-over';

          return (
            <div
              key={card.instanceId}
              className={cls}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={e => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
            >
              <span className="card-tile-index">{i + 1}</span>
              <span className="card-tile-drag-handle">⠿</span>
              <span className="card-tile-name">{def?.name ?? card.defId}</span>
              <span className="card-tile-desc">{def?.desc ?? ''}</span>
              {card.charges !== undefined && (
                <span className="card-tile-charge">⚡ ×{card.charges}</span>
              )}
              <span className={`rarity-text-${rarity}`}>{rarity}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
