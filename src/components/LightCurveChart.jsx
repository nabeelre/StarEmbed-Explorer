import { useEffect, useMemo, useRef, useState } from 'react';
import Plot from './Plot.jsx';

function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

const MONO = 'JetBrains Mono, ui-monospace, monospace';
const AXIS_FG = 'rgba(232,236,246,0.7)';
const TICK_FG = 'rgba(232,236,246,0.55)';
const GRID = 'rgba(255,255,255,0.07)';
const LINE = 'rgba(255,255,255,0.2)';

function buildTrace(band, bandData, mode, period, color) {
  if (!bandData?.mjd?.length) return null;
  const { mjd, mag, mag_unc, goodflag } = bandData;
  const idx = [];
  for (let i = 0; i < mjd.length; i++) {
    if (goodflag && goodflag[i] !== 1) continue;
    idx.push(i);
  }
  if (!idx.length) return null;

  const x = mode === 'phase' && period > 0
    ? idx.map((i) => (((mjd[i] % period) + period) % period) / period)
    : idx.map((i) => mjd[i]);

  return {
    x,
    y: idx.map((i) => mag[i]),
    error_y: {
      type: 'data',
      array: idx.map((i) => mag_unc?.[i] ?? 0),
      visible: true,
      width: 0,
      thickness: 1,
      color,
    },
    type: 'scatter',
    mode: 'markers',
    name: band,
    marker: { color, size: 6, opacity: 0.85 },
    hovertemplate:
      `<b>${band}</b><br>${mode === 'phase' ? 'phase' : 'MJD'}=%{x:.4f}` +
      `<br>mag=%{y:.3f}<extra></extra>`,
  };
}

export default function LightCurveChart({ row, mode = 'raw', bandColors = {}, activeBands }) {
  const period = row?.period;

  const traces = useMemo(() => {
    if (!row?.lightcurve) return [];
    return Object.entries(row.lightcurve)
      .filter(([band]) => !activeBands || activeBands.has(band))
      .map(([band, data]) =>
        buildTrace(band, data, mode, period, bandColors[band] || '#7da9ff'))
      .filter(Boolean);
  }, [row, mode, period, bandColors, activeBands]);

  const [wrapRef, { w, h }] = useSize();

  const noData = (mode === 'phase' && !period)
    ? 'No period'
    : !traces.length
      ? 'No observations'
      : null;

  const layout = {
    width: w || undefined,
    height: h || undefined,
    autosize: false,
    margin: { t: 10, r: 14, b: 64, l: 78 },
    xaxis: {
      title: {
        text: mode === 'phase' ? 'Phase' : 'MJD',
        font: { color: AXIS_FG, family: MONO, size: 18 },
        standoff: 12,
      },
      tickfont: { color: TICK_FG, family: MONO, size: 16 },
      gridcolor: GRID, zerolinecolor: LINE, linecolor: LINE,
      ...(mode === 'phase'
        ? {}
        : { tickformat: 'd', exponentformat: 'none', separatethousands: false }),
    },
    yaxis: {
      title: {
        text: 'Magnitude',
        font: { color: AXIS_FG, family: MONO, size: 18 },
        standoff: 12,
      },
      tickfont: { color: TICK_FG, family: MONO, size: 16 },
      gridcolor: GRID, zerolinecolor: LINE, linecolor: LINE,
      autorange: 'reversed',
    },
    showlegend: false,
    hovermode: 'closest',
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: AXIS_FG, family: MONO },
    dragmode: 'zoom',
    hoverlabel: {
      bgcolor: 'rgba(11,15,28,0.92)',
      bordercolor: 'rgba(125,169,255,0.35)',
      font: { color: '#e8ecf6', family: MONO, size: 11 },
    },
    modebar: {
      bgcolor: 'rgba(0,0,0,0)',
      color: 'rgba(232,236,246,0.45)',
      activecolor: '#7da9ff',
      orientation: 'h',
    },
  };

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      {noData ? (
        <Empty msg={noData} />
      ) : w > 0 && h > 0 && (
        <Plot
          data={traces}
          layout={layout}
          config={{
            responsive: false,
            displaylogo: false,
            scrollZoom: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
            displayModeBar: 'hover',
          }}
        />
      )}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: MONO, fontSize: 12,
      color: 'rgba(232,236,246,0.3)',
    }}>{msg}</div>
  );
}
