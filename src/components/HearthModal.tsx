import type { MetaState } from '../game/types';
import Hearth from './Hearth';

interface Props {
  meta: MetaState;
  onPurchase: (id: string) => void;
  onClose: () => void;
}

export default function HearthModal({ meta, onPurchase, onClose }: Props) {
  return (
    <div
      className="modal-overlay"
      onClick={onClose}
    >
      <div
        className="modal-box"
        onClick={e => e.stopPropagation()}
        style={{ overflowY: 'auto', maxHeight: '80vh' }}
      >
        <div className="modal-header">
          <span className="modal-title">🏠 HEARTH — 永続アップグレード</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--dim)', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
        <Hearth meta={meta} onPurchase={onPurchase} />
      </div>
    </div>
  );
}
