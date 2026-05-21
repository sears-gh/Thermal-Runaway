import { useEffect, useRef } from 'react';
import { FLASHOVER_THRESHOLD, GRAPH_LEN } from '../game/constants';

interface Props {
  graphPH: number[];
  graphCool: number[];
}

export default function Graph({ graphPH, graphCool }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = (canvas.width = canvas.offsetWidth || 300);
    const H = (canvas.height = 110);

    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...graphPH, ...graphCool, FLASHOVER_THRESHOLD * 0.05, 1);
    const sy = (v: number) => H - (v / maxVal) * H * 0.88 - H * 0.06;
    const sx = (i: number) => (i / (GRAPH_LEN - 1)) * W;

    // Flashover threshold line
    const ty = sy(FLASHOVER_THRESHOLD);
    if (ty >= 0 && ty <= H) {
      ctx.strokeStyle = 'rgba(255,107,53,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(W, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cooling curve
    ctx.strokeStyle = 'var(--cool, #4ecdc4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    graphCool.forEach((v, i) => {
      const x = sx(i), y = sy(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // PH curve
    ctx.strokeStyle = 'var(--accent2, #ffd166)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    graphPH.forEach((v, i) => {
      const x = sx(i), y = sy(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  });

  return (
    <div className="section">
      <div className="section-title">◈ PH vs Cooling</div>
      <canvas ref={canvasRef} className="graph-canvas" />
    </div>
  );
}
