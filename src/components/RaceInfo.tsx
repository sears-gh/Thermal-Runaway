import type { GamePhase, Snapshot } from '../game/types';
import { fmtNum, fmtTime } from '../game/utils';

interface Props {
  snap: Snapshot | null;
  phase: GamePhase;
}

export default function RaceInfo({ snap, phase }: Props) {
  const phaseLabel = (() => {
    if (!snap || phase === 'idle') return <span className="info-val">—</span>;
    if (phase === 'paused') return <span className="info-val" style={{ color: 'var(--dim)' }}>PAUSED</span>;
    if (snap.t < snap.n_eff) return <span className="info-val" style={{ color: 'var(--cool)' }}>蓄熱中</span>;
    if (snap.PH >= snap.cool) return <span className="info-val info-val--ok">成長中</span>;
    return (
      <span className="info-val info-val--danger">
        危機 {snap.belowTimer.toFixed(1)}s
      </span>
    );
  })();

  return (
    <div className="section race-grid">
      <div className="info-row">
        <span className="info-label">Phlogiston</span>
        <span className="info-val info-val--ph">{snap ? fmtNum(snap.PH) : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Cooling</span>
        <span className="info-val info-val--cool">{snap ? fmtNum(snap.cool) : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Passive /tick</span>
        <span className="info-val">{snap ? fmtNum(snap.passiveOutput) : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Tick Speed</span>
        <span className="info-val">{snap ? snap.v.toFixed(2) + '/s' : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Race Time</span>
        <span className="info-val">{snap ? fmtTime(snap.t) : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Multiplier</span>
        <span className="info-val">×{snap ? snap.mult.toFixed(2) : '1.00'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">k_eff</span>
        <span className="info-val">{snap ? snap.k_eff.toFixed(4) : '—'}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Status</span>
        {phaseLabel}
      </div>
    </div>
  );
}
