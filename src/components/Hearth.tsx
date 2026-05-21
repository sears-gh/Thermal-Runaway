import type { MetaState } from '../game/types';
import { HEARTH_UPGRADES } from '../game/meta';

interface Props {
  meta: MetaState;
  onPurchase: (id: string) => void;
}

export default function Hearth({ meta, onPurchase }: Props) {
  return (
    <div className="section" style={{ flex: 1 }}>
      <div className="section-title">◈ Hearth — 永続アップグレード</div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        <div className="stat">
          <span className="stat-label">Ash</span>
          <span className="stat-value">{meta.ash}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Flashovers</span>
          <span className="stat-value">{meta.flashoverCount}</span>
        </div>
      </div>
      <div className="hearth-grid">
        {HEARTH_UPGRADES.map(upg => {
          const purchased = meta.purchasedUpgrades.has(upg.id);
          const canBuy = !purchased && meta.ash >= upg.cost;
          return (
            <button
              key={upg.id}
              className="hearth-btn"
              disabled={!canBuy}
              onClick={() => onPurchase(upg.id)}
            >
              <span className="hearth-btn-name">
                {purchased ? '✓ ' : ''}{upg.name}
              </span>
              <span className="hearth-btn-desc">{upg.desc}</span>
              {purchased ? (
                <span className="hearth-btn-done">購入済</span>
              ) : (
                <span className="hearth-btn-cost">{upg.cost} Ash</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
