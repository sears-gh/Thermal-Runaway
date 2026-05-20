import type { CardInstance, GamePhase } from '../game/types';
import { CARD_DEFS } from '../game/cards';

interface Props {
  choices: string[];
  deck: CardInstance[];
  phase: GamePhase;
  onPick: (defId: string) => void;
  onRefine: (instanceId: string) => void;
  onSkip: () => void;
  onShowRefine: () => void;
  onCancelRefine: () => void;
}

export default function DraftPanel({
  choices,
  deck,
  phase,
  onPick,
  onRefine,
  onSkip,
  onShowRefine,
  onCancelRefine,
}: Props) {
  if (phase === 'refine') {
    const removable = deck.filter(c => !c.isWeakCopy);
    return (
      <div className="draft-panel">
        <div className="draft-title">✂ カードを選んで除去</div>
        <div className="refine-chips">
          {removable.map(card => {
            const def = CARD_DEFS[card.defId];
            return (
              <button
                key={card.instanceId}
                className="refine-chip"
                onClick={() => onRefine(card.instanceId)}
              >
                {def?.name ?? card.defId}
                {card.charges !== undefined && ` [${card.charges}]`}
              </button>
            );
          })}
          {removable.length === 0 && (
            <span style={{ color: 'var(--dim)', fontSize: 11 }}>除去できるカードがありません</span>
          )}
        </div>
        <button onClick={onCancelRefine}>← 戻る</button>
      </div>
    );
  }

  return (
    <div className="draft-panel">
      <div className="draft-title">🔥 再点火 — ドラフト</div>
      <div className="draft-sub">カードを追加 / 精錬 / スキップ</div>
      <div className="draft-cards">
        {choices.map(defId => {
          const def = CARD_DEFS[defId];
          if (!def) return null;
          return (
            <button
              key={defId}
              className="draft-card"
              onClick={() => onPick(defId)}
            >
              <div className="draft-card-name">{def.name}</div>
              <div className="draft-card-desc">{def.desc}</div>
              <div className={`draft-card-rarity draft-card-rarity--${def.rarity}`}>
                {def.rarity}
              </div>
            </button>
          );
        })}
      </div>
      <div className="draft-actions">
        <button onClick={onShowRefine}>✂ 精錬（カード除去）</button>
        <button onClick={onSkip}>→ スキップ（次レース PH+10）</button>
      </div>
    </div>
  );
}
