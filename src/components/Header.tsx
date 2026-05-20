import type { MetaState } from '../game/types';

interface Props {
  meta: MetaState;
  reignMult: number;
}

export default function Header({ meta, reignMult }: Props) {
  return (
    <header className="header">
      <span className="header-title">THERMAL RUNAWAY</span>
      <div className="stat-group">
        <div className="stat">
          <span className="stat-label">Flashovers</span>
          <span className="stat-value">{meta.flashoverCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Ash</span>
          <span className="stat-value">{meta.ash}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Reign×</span>
          <span className="stat-value">×{reignMult.toFixed(2)}</span>
        </div>
      </div>
    </header>
  );
}
