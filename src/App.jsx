import { useEffect, useState, useRef, useMemo, Component } from 'react';
import { createDataSource } from './data';
import { DATASETS } from './datasets.js';
import SkyMapCanvas from './components/SkyMapCanvas.jsx';
import LightCurveChart from './components/LightCurveChart.jsx';
import { buildBandColors, groupBandsBySurvey } from './bands.js';

// ── Design tokens ─────────────────────────────────────────────

const GLASS = {
  background: 'rgba(11,15,28,0.72)',
  border: '1px solid rgba(125,169,255,0.18)',
  boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(160,190,255,0.08)',
  backdropFilter: 'blur(18px) saturate(140%)',
  borderRadius: 12,
  color: '#e8ecf6',
};

const KICKER = {
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
  fontSize: 14,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: 'rgba(232,236,246,0.55)',
};

const ACCENT = '#7da9ff';

// Known class name → colour hints. Unknown classes get FALLBACK colours by index.
// These are purely cosmetic defaults — the actual class list always comes from the data.
const CLASS_COLOR_HINTS = {
  EW: '#7da9ff', RRC: '#9c8cff', EA: '#f0a02b', RRAB: '#ff8a72',
  RS: '#3bbd8e', RRD: '#c45ad8', LPV: '#ffd166', EB: '#5dd6e6',
  DSCT: '#9c8cff', PCEB: '#e8c77a',
};
const FALLBACK_COLORS = [
  '#7da9ff', '#f0a02b', '#3bbd8e', '#c45ad8',
  '#ffd166', '#5dd6e6', '#ff8a72', '#9c8cff', '#e8c77a', '#a4c9b0',
];
function buildClassColors(classCounts) {
  if (!classCounts) return {};
  const colors = {};
  let fi = 0;
  for (const cls of Object.keys(classCounts)) {
    colors[cls] = CLASS_COLOR_HINTS[cls] ?? FALLBACK_COLORS[fi++ % FALLBACK_COLORS.length];
  }
  return colors;
}

function randomIdx(classIndices, enabledClasses) {
  const entries = Object.entries(classIndices).filter(
    ([cls]) => !enabledClasses || enabledClasses.has(cls)
  );
  const total = entries.reduce((s, [, idxs]) => s + idxs.length, 0);
  if (!total) return null;
  let r = Math.floor(Math.random() * total);
  for (const [, idxs] of entries) {
    if (r < idxs.length) return idxs[r];
    r -= idxs.length;
  }
  return null;
}

// ── Error boundary ─────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11, color: '#ff8a72' }}>
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main App ───────────────────────────────────────────────────

export default function App() {
  const [datasets, setDatasets] = useState(DATASETS);
  const [dataset, setDataset] = useState(DATASETS[0]);
  const [info, setInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [enabledClasses, setEnabledClasses] = useState(null);
  const [totalRows, setTotalRows] = useState(0);
  const [currentRow, setCurrentRow] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(true);
  const [bottomH, setBottomH] = useState(504);
  const [activeBands, setActiveBands] = useState(null);

  const containerRef = useRef(null);
  const dsRef = useRef(null);
  const dirInputRef = useRef(null);

  // Reset activeBands whenever a new dataset summary arrives.
  useEffect(() => {
    if (summary?.bands) setActiveBands(new Set(summary.bands));
  }, [summary]);

  // Load dataset — fetch summary + first random star.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentRow(null);
    setInfo(null);
    setEnabledClasses(null);
    setTotalRows(0);

    const ds = createDataSource(dataset);
    dsRef.current = ds;

    (async () => {
      try {
        const [info, summary] = await Promise.all([ds.getInfo(), ds.getSummary()]);
        if (cancelled) return;
        setInfo(info);
        setSummary(summary);
        const total = info.numRows ?? 0;
        setTotalRows(total);
        if (summary?.classCounts) {
          setEnabledClasses(new Set(Object.keys(summary.classCounts)));
        }
        if (total > 0) {
          const idx = summary?.classIndices
            ? randomIdx(summary.classIndices, null)
            : Math.floor(Math.random() * total);
          const rows = await ds.getRows({ offset: idx, length: 1 });
          if (!cancelled && rows[0]) setCurrentRow(rows[0]);
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); setSummary(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [dataset]);

  const pickRandom = async () => {
    if (!dsRef.current || totalRows === 0) return;
    setLoading(true);
    setError(null);
    try {
      const idx = summary?.classIndices
        ? randomIdx(summary.classIndices, enabledClasses)
        : Math.floor(Math.random() * totalRows);
      if (idx === null) return;
      const rows = await dsRef.current.getRows({ offset: idx, length: 1 });
      if (rows[0]) setCurrentRow(rows[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleClass = (cls) =>
    setEnabledClasses((prev) => {
      const next = new Set(prev);
      next.has(cls) ? next.delete(cls) : next.add(cls);
      return next;
    });

  const toggleAllClasses = (on) =>
    setEnabledClasses(on ? new Set(Object.keys(summary.classCounts)) : new Set());

  const toggleBand = (b) =>
    setActiveBands((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });

  const handleDirChange = (e) => {
    const fileArray = Array.from(e.target.files);
    e.target.value = '';
    if (!fileArray.length) return;
    const dirName =
      fileArray[0]?.webkitRelativePath?.split('/')[0] ?? fileArray[0]?.name ?? 'dataset';
    const descriptor = { id: `hf-disk::${dirName}`, label: dirName, source: 'hf-disk', files: fileArray };
    setDatasets((prev) => [...prev.filter((d) => d.id !== descriptor.id), descriptor]);
    setDataset(descriptor);
  };

  const onResizeStart = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = bottomH;
    const move = (ev) => {
      const maxH = (containerRef.current?.clientHeight ?? 900) - 120;
      setBottomH(Math.max(150, Math.min(maxH, startH + (startY - ev.clientY))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Derived display data — all dynamic, nothing hardcoded.
  const classColors = useMemo(() => buildClassColors(summary?.classCounts), [summary]);
  const bandColors = useMemo(() => buildBandColors(summary?.bands), [summary]);
  const bandGroups = useMemo(() => groupBandsBySurvey(summary?.bands ?? []), [summary]);

  const classes = useMemo(() => {
    if (!summary?.classCounts) return [];
    const total = summary.totalRows || 1;
    return Object.entries(summary.classCounts).map(([id, count]) => ({
      id, count, pct: (count / total) * 100,
    }));
  }, [summary]);

  const allClassesOn = enabledClasses != null && classes.length > 0 &&
    classes.every((c) => enabledClasses.has(c.id));

  const maxClassCount = classes[0]?.count ?? 1;
  const bands = summary?.bands ?? [];
  const row = currentRow;
  const cls = row?.class_str ?? '—';
  const clsColor = classColors[cls] || ACCENT;

  const datasetName = info?.path ?? dataset.label;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 30% 15%, #14213d 0%, #060814 70%)',
        color: '#e8ecf6',
        fontFamily: "'Inter Tight', 'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Layer 1: Sky map (top 2/3 of viewport) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '66.6667vh', zIndex: 1 }}>
        <SkyMapCanvas
          skyPoints={summary?.skyPoints ?? []}
          currentRow={row}
          enabledClasses={enabledClasses}
          classColors={classColors}
        />
      </div>

      {/* ── Header ── */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 22px',
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 44, letterSpacing: -0.2, color: ACCENT }}>
            StarEmbed Explorer
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 19,
            color: ACCENT, opacity: 0.7, letterSpacing: 1.2,
          }}>SEE</span>
        </div>

        {/* Dataset controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={dataset.id}
            onChange={(e) => setDataset(datasets.find((d) => d.id === e.target.value))}
            style={{
              padding: '9px 17px', borderRadius: 9,
              border: '1px solid rgba(125,169,255,0.2)',
              background: 'rgba(125,169,255,0.08)',
              color: '#e8ecf6', fontSize: 18, cursor: 'pointer',
              fontFamily: "'Inter Tight', system-ui, sans-serif",
            }}
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id} style={{ background: '#0e1428' }}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => dirInputRef.current.click()}
            style={{
              padding: '9px 17px', borderRadius: 9,
              border: '1px solid rgba(232,236,246,0.15)',
              background: 'transparent', color: '#e8ecf6',
              fontSize: 18, cursor: 'pointer',
            }}
          >
            Open HF dataset ↗
          </button>
          <input
            ref={dirInputRef} type="file" webkitdirectory=""
            style={{ display: 'none' }} onChange={handleDirChange}
          />
        </div>
      </header>

      {/* ── Dataset card (top-left) ── */}
      {summary && (
        <div style={{
          position: 'absolute', top: 100, left: 22, zIndex: 5,
          ...GLASS, padding: '14px 18px', minWidth: 286,
        }}>
          <div style={KICKER}>Dataset</div>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4,
            marginTop: 2, marginBottom: 12, wordBreak: 'break-all' }}>
            {datasetName}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <StatBlock n={summary.totalRows.toLocaleString()} l="STARS" />
            <StatBlock n={classes.length} l="CLASSES" />
          </div>
          {bandGroups.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                letterSpacing: 1.4, textTransform: 'uppercase',
                color: 'rgba(232,236,246,0.35)', marginBottom: 5,
              }}>Bands</div>
              {bandGroups.map(({ survey, bands: surveyBands }) => (
                <div key={survey} style={{
                  display: 'flex', alignItems: 'baseline',
                  gap: 8, marginBottom: 3,
                }}>
                  <span style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                    letterSpacing: 1.2, textTransform: 'uppercase',
                    color: '#e8ecf6', minWidth: 30, flexShrink: 0,
                  }}>{survey}</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {surveyBands.map((b) => (
                      <span key={b.key} style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                        letterSpacing: 0.4, color: b.color,
                      }}>{b.label}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Class filter + Random (top-right) ── */}
      {classes.length > 0 && (
        <div style={{
          position: 'absolute', top: 100, right: 22, zIndex: 5,
          display: 'flex', flexDirection: 'column', gap: 10,
          width: 340,
        }}>
        <div style={{
          ...GLASS,
          padding: filterOpen ? '14px 16px' : '10px 14px',
          transition: 'width 0.18s',
        }}>
          {/* Header row */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: filterOpen ? 8 : 0,
          }}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              style={{
                ...KICKER, border: 'none', background: 'transparent',
                cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" style={{
                transform: filterOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.18s', flexShrink: 0,
              }}>
                <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.4"
                  fill="none" strokeLinecap="round" />
              </svg>
              Class filter · {enabledClasses?.size ?? 0}/{classes.length}
            </button>
            {filterOpen && (
              <button
                onClick={() => toggleAllClasses(!allClassesOn)}
                style={{
                  border: 'none', background: 'transparent', color: ACCENT,
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 15,
                  letterSpacing: 1.1, textTransform: 'uppercase', cursor: 'pointer', padding: 0,
                }}
              >
                {allClassesOn ? 'Clear' : 'All'}
              </button>
            )}
          </div>

          {/* Class rows */}
          {filterOpen && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              maxHeight: 300, overflowY: 'auto',
            }}>
              {classes.map((c) => {
                const isOn = enabledClasses?.has(c.id) ?? true;
                const color = classColors[c.id] || ACCENT;
                const barPct = (c.count / maxClassCount) * 100;
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '16px 1fr 1fr 76px 60px',
                      alignItems: 'center', gap: 8,
                      border: 'none', background: 'transparent',
                      padding: '3px 0', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'JetBrains Mono, monospace', fontSize: 17,
                      color: '#e8ecf6', opacity: isOn ? 1 : 0.42,
                      transition: 'opacity 0.15s',
                    }}
                  >
                    {/* Checkbox */}
                    <span style={{
                      width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                      border: `1px solid ${isOn ? color : 'rgba(255,255,255,0.3)'}`,
                      background: isOn ? color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isOn && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4.2L3.2 5.8L6.5 2" stroke="#0a0e1a"
                            strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {/* Class name */}
                    <span style={{
                      fontWeight: 600, letterSpacing: 0.3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.id}</span>
                    {/* Bar */}
                    <span style={{
                      height: 4, background: 'rgba(255,255,255,0.08)',
                      borderRadius: 2, position: 'relative', overflow: 'hidden',
                    }}>
                      <span style={{
                        position: 'absolute', top: 0, left: 0, height: '100%',
                        width: `${barPct}%`, background: color, borderRadius: 2,
                      }} />
                    </span>
                    {/* Count */}
                    <span style={{
                      textAlign: 'right', color: 'rgba(232,236,246,0.5)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{c.count.toLocaleString()}</span>
                    {/* Pct */}
                    <span style={{
                      textAlign: 'right', color: 'rgba(232,236,246,0.5)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{c.pct.toFixed(1)}%</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={pickRandom}
          disabled={loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 10,
            padding: '14px 20px', borderRadius: 12, border: 'none',
            background: `linear-gradient(180deg, ${ACCENT} 0%, #5a8aff 100%)`,
            color: '#0a0e1a',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 18,
            fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
            boxShadow: '0 8px 28px rgba(125,169,255,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
            transition: 'opacity 0.15s, transform 0.08s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 13 13" fill="none"
            stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3.5h3l5 6h3M2 9.5h3l1.5-1.8M9 8.5l3 1L11 12.5" />
          </svg>
          Random star
        </button>
      </div>
      )}

      {/* ── Band toggle pill (floating above drawer, grouped by survey) ── */}
      {bandGroups.length > 0 && (
        <div style={{
          position: 'absolute', bottom: bottomH + 28,
          left: 22,
          zIndex: 6, display: 'flex', alignItems: 'stretch', gap: 0,
          padding: '4px 6px',
          ...GLASS, borderRadius: 999,
        }}>
          {bandGroups.map(({ survey, bands: surveyBands }, gi) => (
            <div key={survey} style={{ display: 'contents' }}>
              {gi > 0 && (
                <div style={{
                  width: 1, background: 'rgba(125,169,255,0.18)',
                  margin: '4px 6px', alignSelf: 'stretch',
                }} />
              )}
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2, padding: '2px 4px',
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 14,
                  letterSpacing: 1.4, textTransform: 'uppercase',
                  color: '#e8ecf6', lineHeight: 1,
                }}>{survey}</span>
                <div style={{ display: 'flex', gap: 2 }}>
                  {surveyBands.map((b) => {
                    const isOn = !activeBands || activeBands.has(b.key);
                    return (
                      <button
                        key={b.key}
                        onClick={() => toggleBand(b.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 999, border: 'none',
                          background: isOn ? b.color + '22' : 'transparent',
                          color: '#e8ecf6', opacity: isOn ? 1 : 0.35,
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                          fontWeight: 600, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          transition: 'opacity 0.15s, background 0.15s',
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: 3,
                          background: b.color, flexShrink: 0,
                        }} />
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom drawer ── */}
      <div style={{
        position: 'absolute', bottom: 18, left: 22, right: 22, zIndex: 5,
        ...GLASS, padding: 0, height: bottomH,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Resize grip */}
        <ResizeGrip onPointerDown={onResizeStart} />

        {row ? (
          <div style={{
            flex: 1, padding: '20px 24px',
            display: 'grid', gridTemplateColumns: '300px 1fr 1fr',
            gap: 24, minHeight: 0, overflow: 'hidden',
          }}>
            {/* ── Metadata column ── */}
            <div style={{
              borderRight: '1px solid rgba(125,169,255,0.12)',
              paddingRight: 22,
              display: 'flex', flexDirection: 'column',
              minWidth: 0, overflowY: 'auto',
            }}>
              {/* Header: kicker + class chip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
              }}>
                <span style={KICKER}>Gaia DR3</span>
                <span style={{
                  fontSize: 16, padding: '3px 10px', borderRadius: 4,
                  background: clsColor, color: '#0b0f1c',
                  fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, letterSpacing: 0.4,
                }}>{cls}</span>
              </div>

              {/* Star ID */}
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 24,
                fontWeight: 500, letterSpacing: -0.3,
                wordBreak: 'break-all', lineHeight: 1.3, marginBottom: 14,
              }}>
                {row.gaia_dr3_source_id ?? row.sourceid ?? '—'}
              </div>

              {/* KV grid — columns determined by available data fields */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '10px 16px',
              }}>
                <KV l="PERIOD"
                  v={row.period != null ? row.period.toFixed(4) + ' d' : '—'} />
                <KV l="PARALLAX"
                  v={row.parallax != null ? row.parallax.toFixed(3) + ' mas' : '—'} />
                <KV l="RA"
                  v={row.gaia_dr3_ra?.toFixed(4) ?? '—'} />
                <KV l="DEC"
                  v={row.gaia_dr3_dec?.toFixed(4) ?? '—'} />
                <KV l="PM RA"
                  v={row.pmra != null ? row.pmra.toFixed(2) + ' mas/yr' : '—'} />
                <KV l="PM Dec"
                  v={row.pmdec != null ? row.pmdec.toFixed(2) + ' mas/yr' : '—'} />
                <KV l="RV"
                  v={row.radial_velocity != null
                    ? row.radial_velocity.toFixed(2) + ' km/s' : '—'} />
                <KV l={`${datasetName} ID`} v={row.sourceid ?? '—'} />
              </div>
            </div>

            {/* ── Chart columns ── */}
            <ChartCol title="Raw observations">
              <ErrorBoundary key={`raw-${row.gaia_dr3_source_id ?? row.sourceid}`}>
                <LightCurveChart
                  row={row} mode="raw"
                  bandColors={bandColors} activeBands={activeBands}
                />
              </ErrorBoundary>
            </ChartCol>

            <ChartCol title={`Phase-folded${row.period ? ` · P=${row.period.toFixed(4)} d` : ''}`}>
              <ErrorBoundary key={`phase-${row.gaia_dr3_source_id ?? row.sourceid}`}>
                <LightCurveChart
                  row={row} mode="phase"
                  bandColors={bandColors} activeBands={activeBands}
                />
              </ErrorBoundary>
            </ChartCol>
          </div>
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {error ? (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: '#ff8a72' }}>{error}</span>
            ) : (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: 'rgba(232,236,246,0.35)', letterSpacing: 1.4 }}>
                {loading ? 'LOADING…' : 'NO DATA'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Subtle loading pulse in the header area when fetching a new star */}
      {loading && row && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: 'rgba(232,236,246,0.45)', letterSpacing: 1.8, pointerEvents: 'none',
        }}>
          LOADING
        </div>
      )}
    </div>
  );
}

// ── Small presentational components ────────────────────────────

function ResizeGrip({ onPointerDown }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute', top: -10, left: 0, right: 0, height: 18,
        cursor: 'ns-resize', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10,
      }}
    >
      <div
        style={{
          width: 44, height: 5, borderRadius: 3,
          background: hover ? 'rgba(125,169,255,0.7)' : 'rgba(125,169,255,0.35)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      />
    </div>
  );
}

function StatBlock({ n, l }) {
  return (
    <div>
      <div style={{
        fontSize: 20, fontWeight: 600, color: '#e8ecf6',
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'JetBrains Mono, monospace',
      }}>{n}</div>
      <div style={{
        fontSize: 12, letterSpacing: 1.3, color: 'rgba(232,236,246,0.5)',
        textTransform: 'uppercase', marginTop: 2,
        fontFamily: 'JetBrains Mono, monospace',
      }}>{l}</div>
    </div>
  );
}

function KV({ l, v }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14, letterSpacing: 1.2, color: 'rgba(232,236,246,0.45)',
        textTransform: 'uppercase',
      }}>{l}</div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 18, color: '#e8ecf6', fontVariantNumeric: 'tabular-nums',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{v}</div>
    </div>
  );
}

function ChartCol({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      <div style={{ ...KICKER, color: 'rgba(232,236,246,0.7)', marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
