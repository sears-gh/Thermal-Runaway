import { fmtNum } from '../game/utils';

interface Props {
  peakPH: number;
  ash: number;
  onContinue: () => void;
}

export default function FlashoverScreen({ peakPH, ash, onContinue }: Props) {
  return (
    <div className="flashover-overlay">
      <div className="flashover-box">
        <div className="flashover-title">⚡ FLASHOVER ⚡</div>
        <div className="flashover-label">Peak Phlogiston</div>
        <div className="flashover-ph">{fmtNum(peakPH)}</div>
        <div>
          Ash gained:{' '}
          <span className="flashover-ash">+{ash}</span>
        </div>
        <button className="primary" onClick={onContinue}>
          炉床へ続ける
        </button>
      </div>
    </div>
  );
}
