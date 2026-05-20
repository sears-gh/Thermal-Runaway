import { useEffect, useRef } from 'react';
import type { Snapshot } from '../game/types';
import { CARD_DEFS } from '../game/cards';
import { FLASHOVER_THRESHOLD } from '../game/constants';

interface Props {
  snap: Snapshot | null;
}

export default function Furnace({ snap }: Props) {
  const prevHeadRef = useRef(-1);
  const firedRef = useRef<string | null>(null);

  const deck = snap?.deck ?? [];
  const head = snap?.head ?? 0;
  const phRatio = snap ? Math.min(1, snap.PH / FLASHOVER_THRESHOLD) : 0;

  // Track which instanceId just fired for the flash animation
  const prevHead = (head - 1 + Math.max(deck.length, 1)) % Math.max(deck.length, 1);
  if (snap && prevHead !== prevHeadRef.current) {
    firedRef.current = deck[prevHead]?.instanceId ?? null;
    prevHeadRef.current = prevHead;
  }
  if (!snap) firedRef.current = null;

  return (
    <div className="section furnace-section">
      <div className="section-title">◈ Cycling Furnace</div>
      <div className="deck-display">
        {deck.map((card, i) => {
          const def = CARD_DEFS[card.defId];
          const isActive = i === head;
          const isFired = card.instanceId === firedRef.current && !isActive;
          const rarity = def?.rarity ?? 'common';

          let cls = 'card-chip';
          if (isActive) cls += ' card-chip--active';
          else if (isFired) cls += ' card-chip--fired';
          if (rarity === 'rare') cls += ' card-chip--rare';
          if (rarity === 'challenge') cls += ' card-chip--challenge';
          if (card.isWeakCopy) cls += ' card-chip--weak';

          return (
            <div key={card.instanceId} className={cls}>
              {def?.name ?? card.defId}
              {card.charges !== undefined && (
                <span className="charge-badge">[{card.charges}]</span>
              )}
            </div>
          );
        })}
        {deck.length === 0 && (
          <span style={{ color: 'var(--dim)', fontSize: 11 }}>—</span>
        )}
      </div>
      <div className="ph-bar-wrap">
        <div className="ph-bar" style={{ width: `${phRatio * 100}%` }} />
      </div>
    </div>
  );
}
