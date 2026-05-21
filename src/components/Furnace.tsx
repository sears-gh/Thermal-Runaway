import { useRef } from 'react';
import type { Snapshot } from '../game/types';
import { CARD_DEFS } from '../game/cards';
import { FLASHOVER_THRESHOLD } from '../game/constants';

interface Props {
  snap: Snapshot | null;
}

export default function Furnace({ snap }: Props) {
  const prevHeadRef = useRef(-1);
  const firedIdRef = useRef<string | null>(null);

  const deck = snap?.deck ?? [];
  const head = snap?.head ?? 0;
  const phRatio = snap ? Math.min(1, snap.PH / FLASHOVER_THRESHOLD) : 0;

  // Track just-fired card
  if (snap && head !== prevHeadRef.current) {
    const prevHead = (head - 1 + Math.max(deck.length, 1)) % Math.max(deck.length, 1);
    firedIdRef.current = deck[prevHead]?.instanceId ?? null;
    prevHeadRef.current = head;
  }
  if (!snap) { firedIdRef.current = null; prevHeadRef.current = -1; }

  return (
    <div className="card-area">
      <div className="card-area-header">
        <span className="card-area-title">◈ CYCLING FURNACE</span>
        <div style={{ flex: 1, marginLeft: 16, marginRight: 16, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${phRatio * 100}%`, height: '100%', background: 'linear-gradient(90deg,var(--accent),var(--accent2))', transition: 'width .1s linear' }} />
        </div>
        <span className="card-area-hint" style={{ whiteSpace: 'nowrap' }}>T=1M</span>
      </div>
      <div className="card-row">
        {deck.map((card, i) => {
          const def = CARD_DEFS[card.defId];
          const isActive = i === head;
          const isFired = card.instanceId === firedIdRef.current && !isActive;
          const rarity = def?.rarity ?? 'common';

          let cls = `card-tile rarity-${rarity}`;
          if (isActive) cls += ' card-tile--active';
          else if (isFired) cls += ' card-tile--fired';

          return (
            <div key={card.instanceId} className={cls}>
              <span className="card-tile-index">{i + 1}</span>
              {isActive && <span className="card-tile-playhead">▶</span>}
              <span className="card-tile-name">{def?.name ?? card.defId}</span>
              <span className="card-tile-desc">{def?.desc ?? ''}</span>
              {card.charges !== undefined && (
                <span className="card-tile-charge">⚡ ×{card.charges}</span>
              )}
              <span className={`rarity-text-${rarity}`}>{rarity}</span>
            </div>
          );
        })}
        {deck.length === 0 && (
          <div className="card-area-idle">— カードなし —</div>
        )}
      </div>
    </div>
  );
}
