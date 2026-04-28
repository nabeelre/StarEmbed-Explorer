import { useMemo } from 'react';

function niceLinearTicks(lo, hi, target) {
  const range = hi - lo;
  if (range === 0) return [lo];
  const rough = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = nice * mag;
  const start = Math.ceil(lo / step) * step;
  const ticks = [];
  for (let v = start; v <= hi + step * 0.01; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

function formatMJD(v) {
  return v >= 10000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0);
}

const AXIS = 'rgba(255,255,255,0.5)';
const AXIS_LINE = 'rgba(255,255,255,0.2)';
const GRID = 'rgba(255,255,255,0.07)';
const MONO = 'JetBrains Mono, ui-monospace, monospace';

// Converts row.lightcurve dict into a flat obs array, filtering to good flags.
function buildObs(lightcurve) {
  const obs = [];
  for (const [band, data] of Object.entries(lightcurve ?? {})) {
    const { mjd, mag, mag_unc, goodflag } = data ?? {};
    if (!mjd?.length) continue;
    for (let i = 0; i < mjd.length; i++) {
      if (goodflag && goodflag[i] !== 1) continue;
      obs.push({ band, mjd: mjd[i], mag: mag?.[i] ?? 0, err: mag_unc?.[i] ?? 0 });
    }
  }
  return obs;
}

export default function LightCurveChart({ row, mode = 'raw', bandColors = {}, activeBands }) {
  const period = row?.period;

  const obs = useMemo(() => buildObs(row?.lightcurve), [row]);

  const data = useMemo(() => {
    const filtered = activeBands ? obs.filter((o) => activeBands.has(o.band)) : obs;
    if (mode !== 'phase' || !period) return filtered;
    return filtered.map((o) => ({
      ...o,
      phase: (((o.mjd % period) + period) % period) / period,
    }));
  }, [obs, activeBands, mode, period]);

  const empty = (msg) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: MONO, fontSize: 11,
      color: 'rgba(232,236,246,0.3)',
    }}>{msg}</div>
  );

  if (mode === 'phase' && !period) return empty('No period');
  if (!data.length) return empty('No observations');

  const PAD = { l: 40, r: 12, t: 10, b: 34 };
  const W = 420, H = 200;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xKey = mode === 'phase' ? 'phase' : 'mjd';
  const xs = data.map((d) => d[xKey]);
  const ys = data.map((d) => d.mag);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xPadding = (xMax - xMin) * 0.03 || 0.05;
  const yPadding = (yMax - yMin) * 0.1 || 0.1;
  const xLo = xMin - xPadding, xHi = xMax + xPadding;
  const yLo = yMin - yPadding, yHi = yMax + yPadding;

  // Smaller mag = brighter = top of chart
  const sx = (v) => PAD.l + ((v - xLo) / (xHi - xLo)) * innerW;
  const sy = (v) => PAD.t + ((v - yLo) / (yHi - yLo)) * innerH;

  const xTicks = mode === 'phase'
    ? [0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => ({ v, l: v.toFixed(1) }))
    : niceLinearTicks(xLo, xHi, 5).map((v) => ({ v, l: formatMJD(v) }));
  const yTicks = niceLinearTicks(yLo, yHi, 4).map((v) => ({ v, l: v.toFixed(1) }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%"
      preserveAspectRatio="none" style={{ display: 'block' }}>

      {/* Gridlines */}
      <g>
        {yTicks.map((t, i) => (
          <line key={i} x1={PAD.l} x2={W - PAD.r} y1={sy(t.v)} y2={sy(t.v)}
            stroke={GRID} strokeWidth="0.6" />
        ))}
        {xTicks.map((t, i) => (
          <line key={i} x1={sx(t.v)} x2={sx(t.v)} y1={PAD.t} y2={H - PAD.b}
            stroke={GRID} strokeWidth="0.6" />
        ))}
      </g>

      {/* Axes */}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b}
        stroke={AXIS_LINE} strokeWidth="0.8" />
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b}
        stroke={AXIS_LINE} strokeWidth="0.8" />

      {/* Y ticks */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l - 3} x2={PAD.l} y1={sy(t.v)} y2={sy(t.v)}
            stroke={AXIS_LINE} strokeWidth="0.8" />
          <text x={PAD.l - 5} y={sy(t.v) + 3} fontSize="9" fill={AXIS}
            fontFamily={MONO} textAnchor="end">{t.l}</text>
        </g>
      ))}

      {/* X ticks */}
      {xTicks.map((t, i) => (
        <g key={i}>
          <line x1={sx(t.v)} x2={sx(t.v)} y1={H - PAD.b} y2={H - PAD.b + 3}
            stroke={AXIS_LINE} strokeWidth="0.8" />
          <text x={sx(t.v)} y={H - PAD.b + 13} fontSize="9" fill={AXIS}
            fontFamily={MONO} textAnchor="middle">{t.l}</text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={PAD.l + innerW / 2} y={H - 2} fontSize="9.5" fill={AXIS}
        fontFamily={MONO} textAnchor="middle">
        {mode === 'phase' ? 'Phase' : 'MJD'}
      </text>
      <text x={9} y={PAD.t + innerH / 2} fontSize="9.5" fill={AXIS}
        fontFamily={MONO} textAnchor="middle"
        transform={`rotate(-90 9 ${PAD.t + innerH / 2})`}>Mag</text>

      {/* Points */}
      {data.map((d, i) => {
        const x = sx(d[xKey]);
        const y = sy(d.mag);
        const c = bandColors[d.band] || '#7da9ff';
        return (
          <g key={i}>
            {d.err > 0 && (
              <line x1={x} x2={x} y1={sy(d.mag - d.err)} y2={sy(d.mag + d.err)}
                stroke={c} strokeOpacity="0.38" strokeWidth="0.7" />
            )}
            <circle cx={x} cy={y} r="1.7" fill={c} opacity="0.9" />
          </g>
        );
      })}
    </svg>
  );
}
