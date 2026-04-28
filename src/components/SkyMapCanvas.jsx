import { useRef, useEffect } from 'react';

const SQRT2 = Math.SQRT2;

function mollweide(raDeg, decDeg) {
  const ra = (raDeg > 180 ? raDeg - 360 : raDeg) * Math.PI / 180;
  const dec = decDeg * Math.PI / 180;
  let theta = dec;
  for (let i = 0; i < 8; i++) {
    const num = 2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(dec);
    const den = 2 + 2 * Math.cos(2 * theta);
    if (Math.abs(den) < 1e-10) break;
    theta -= num / den;
  }
  const x = (2 * SQRT2 / Math.PI) * ra * Math.cos(theta);
  const y = SQRT2 * Math.sin(theta);
  return { x: x / 2, y: -y / SQRT2 }; // normalised to (-1, 1)
}

// Refs are used for all mutable state so the RAF loop never restarts on prop changes.
export default function SkyMapCanvas({ skyPoints = [], currentRow, enabledClasses, classColors }) {
  const canvasRef = useRef(null);
  const pointDataRef = useRef([]);
  const enabledRef = useRef(enabledClasses);
  const colorsRef = useRef(classColors);
  const rowRef = useRef(currentRow);

  useEffect(() => { enabledRef.current = enabledClasses; }, [enabledClasses]);
  useEffect(() => { colorsRef.current = classColors; }, [classColors]);
  useEffect(() => { rowRef.current = currentRow; }, [currentRow]);

  // Stable per-point twinkle parameters — recomputed only when skyPoints array changes.
  useEffect(() => {
    let s = 1234;
    const next = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    pointDataRef.current = skyPoints.map((p) => ({
      ra: p.ra, dec: p.dec, cls: p.cls,
      phase: next() * Math.PI * 2,
      speed: 0.6 + next() * 1.6,
      base: 0.45 + next() * 0.5,
    }));
  }, [skyPoints]);

  // Single RAF loop — started once, reads mutable refs for dynamic data.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const draw = (ts) => {
      const t = ts / 1000;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (W === 0 || H === 0) { raf = requestAnimationFrame(draw); return; }

      const PAD = 24;
      const cx = W / 2;
      const cy = H / 2;
      // Mollweide is a 2:1 ellipse. Fit it correctly: pick the scale that
      // keeps the full ellipse inside the canvas, then set RX = 2 * RY.
      const RY = Math.min(H / 2 - PAD, (W / 2 - PAD) / 2);
      const RX = 2 * RY;

      // mollweide() returns m.x ∈ [-√2, √2] and m.y ∈ [-1, 1].
      // Dividing by √2 maps the x boundary exactly to ±RX.
      const proj = (ra, dec) => {
        const m = mollweide(ra, dec);
        return { x: cx + m.x * (RX / SQRT2), y: cy + m.y * RY };
      };

      ctx.clearRect(0, 0, W, H);

      // Grid — dec parallels
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 0.6;
      for (let d = -60; d <= 60; d += 30) {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const p = proj(-180 + i * 6 + 180, d);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      // Grid — RA meridians
      for (let ra = 0; ra <= 360; ra += 60) {
        ctx.beginPath();
        for (let i = 0; i <= 45; i++) {
          const p = proj(ra, -90 + i * 4);
          i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Ellipse outline
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(cx, cy, RX, RY, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Points
      const points = pointDataRef.current;
      const enabled = enabledRef.current;
      const colors = colorsRef.current || {};
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (enabled && !enabled.has(p.cls)) continue;
        const { x, y } = proj(p.ra, p.dec);
        const tw = 0.5 + Math.sin(t * p.speed + p.phase) * 0.5;
        ctx.globalAlpha = p.base * (0.4 + tw * 0.85);
        ctx.fillStyle = colors[p.cls] || '#88a4d8';
        ctx.beginPath();
        ctx.arc(x, y, 0.95 * (0.85 + tw * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Selected star
      const row = rowRef.current;
      const sra = row?.gaia_dr3_ra;
      const sdec = row?.gaia_dr3_dec;
      if (sra != null && sdec != null) {
        const { x, y } = proj(sra, sdec);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 22);
        grd.addColorStop(0, 'rgba(255,247,194,0.95)');
        grd.addColorStop(0.6, 'rgba(255,247,194,0.18)');
        grd.addColorStop(1, 'rgba(255,247,194,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff7c2';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 9, y); ctx.lineTo(x - 4, y);
        ctx.moveTo(x + 4, y); ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 4);
        ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 9);
        ctx.stroke();
        ctx.fillStyle = '#fff7c2';
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dec labels — RA 180.001° maps to the left edge (lambda ≈ −π)
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'right';
      for (const d of [-60, -30, 0, 30, 60]) {
        const m = mollweide(180.001, d);
        const lx = cx + m.x * (RX / SQRT2);
        const ly = cy + m.y * RY;
        ctx.fillText(d > 0 ? `+${d}°` : `${d}°`, lx - 4, ly + 3);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
