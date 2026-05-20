import type { LogEntry } from '../game/types';

interface Props {
  entries: LogEntry[];
}

export default function Log({ entries }: Props) {
  return (
    <div className="section">
      <div className="section-title">◈ Event Log</div>
      <div className="log-list">
        {entries.map(e => (
          <div key={e.id} className={`log-entry log-entry--${e.kind}`}>
            [{e.time}] {e.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
