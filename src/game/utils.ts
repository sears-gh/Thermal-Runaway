export function fmtNum(n: number): string {
  if (!isFinite(n)) return '∞';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(1);
}

export function fmtTime(secs: number): string {
  return secs.toFixed(1) + 's';
}
