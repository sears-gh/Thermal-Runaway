import { useEffect, useRef } from 'react';
import { FLASHOVER_THRESHOLD } from '../game/constants';
import { fmtNum } from '../game/utils';

interface Props {
  graphPH: number[];
  graphCool: number[];
  graphT: number[];
}

const PAD_L = 38;
const PAD_B = 18;

export default function Graph({ graphPH, graphCool, graphT }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = (canvas.width = canvas.offsetWidth || 300);
    const H = (canvas.height = canvas.offsetHeight || 150);

    // Fill background
    ctx.fillStyle = '#0b0b12';
    ctx.fillRect(0, 0, W, H);

    const n = graphPH.length;
    const maxVal = Math.max(...graphPH, ...graphCool, 1);
    const logMax = Math.log10(Math.max(maxVal, FLASHOVER_THRESHOLD));

    const sy = (v: number) =>
      (H - PAD_B) * (1 - (Math.log10(Math.max(v, 1)) - 0) / logMax) + 2;

    const sx = (i: number) =>
      PAD_L + (i / Math.max(n - 1, 1)) * (W - PAD_L - 6);

    // Horizontal dashed gridlines
    const gridValues = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 0.5;
    ctx.font = '9px Courier New, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const gv of gridValues) {
      const gy = sy(gv);
      if (gy < 2 || gy > H - PAD_B + 2) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.moveTo(PAD_L, gy);
      ctx.lineTo(W - 6, gy);
      ctx.stroke();
      ctx.fillStyle = 'rgba(107,107,128,0.9)';
      ctx.fillText(fmtNum(gv), PAD_L - 3, gy);
    }

    // Flashover threshold orange dashed line
    const flashY = sy(FLASHOVER_THRESHOLD);
    if (flashY >= 2 && flashY <= H - PAD_B + 2) {
      ctx.strokeStyle = 'rgba(255,107,53,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, flashY);
      ctx.lineTo(W - 6, flashY);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // X axis time labels (~4 labels)
    if (graphT.length >= 2) {
      ctx.fillStyle = 'rgba(107,107,128,0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '9px Courier New, monospace';
      const labelCount = 4;
      for (let li = 0; li <= labelCount; li++) {
        const idx = Math.round((li / labelCount) * (n - 1));
        const x = sx(idx);
        const tVal = graphT[idx] ?? 0;
        ctx.fillText(`${tVal.toFixed(0)}s`, x, H - 1);
      }
    }

    // Cooling curve
    ctx.strokeStyle = '#4ecdc4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let inPath = false;
    for (let i = 0; i < n; i++) {
      const v = graphCool[i];
      if (v <= 0) { inPath = false; continue; }
      const x = sx(i);
      const y = sy(v);
      if (!inPath) { ctx.moveTo(x, y); inPath = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // PH curve
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    inPath = false;
    for (let i = 0; i < n; i++) {
      const v = graphPH[i];
      if (v <= 0) { inPath = false; continue; }
      const x = sx(i);
      const y = sy(v);
      if (!inPath) { ctx.moveTo(x, y); inPath = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Small legend top-right
    const lx = W - 6;
    const ly = 8;
    ctx.font = '9px Courier New, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('PH', lx, ly);
    ctx.fillStyle = '#4ecdc4';
    ctx.fillText('Cool', lx, ly + 13);
  });

  return (
    <div className="section">
      <div className="section-title">◈ PH vs Cooling</div>
      <canvas ref={canvasRef} className="graph-canvas" />
    </div>
  );
}
