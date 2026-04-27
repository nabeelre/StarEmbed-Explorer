import { useEffect, useState, useRef, Component } from "react";
import { createDataSource } from "./data";
import { DATASETS } from "./datasets.js";
import LightCurvePlot from "./components/LightCurvePlot.jsx";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <p className="error">Render error: {this.state.error.message}</p>;
    }
    return this.props.children;
  }
}

export default function App() {
  const [datasets, setDatasets] = useState(DATASETS);
  const [dataset, setDataset] = useState(DATASETS[0]);
  const [info, setInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [enabledClasses, setEnabledClasses] = useState(null); // null = all
  const [totalRows, setTotalRows] = useState(0);
  const [currentRow, setCurrentRow] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const dsRef = useRef(null);
  const dirInputRef = useRef(null);

  // Load dataset info then fetch a random first row
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCurrentRow(null);
    setInfo(null);
    setSummary(null);
    setEnabledClasses(null);
    setTotalRows(0);

    const ds = createDataSource(dataset);
    dsRef.current = ds;

    (async () => {
      try {
        const [info, summary] = await Promise.all([
          ds.getInfo(),
          ds.getSummary(),
        ]);
        if (cancelled) return;
        setInfo(info);
        setSummary(summary);
        const total = info.numRows ?? 0;
        setTotalRows(total);
        // Enable all classes by default
        if (summary?.classCounts) {
          setEnabledClasses(new Set(Object.keys(summary.classCounts)));
        }
        if (total > 0) {
          const idx = summary?.classIndices
            ? randomIndexFromClasses(summary.classIndices, null)
            : Math.floor(Math.random() * total);
          const rows = await ds.getRows({ offset: idx, length: 1 });
          if (!cancelled && rows[0]) setCurrentRow(rows[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
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
        ? randomIndexFromClasses(summary.classIndices, enabledClasses)
        : Math.floor(Math.random() * totalRows);
      if (idx === null) return; // no enabled classes with rows
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

  const toggleMany = (classes, on) =>
    setEnabledClasses((prev) => {
      const next = new Set(prev);
      for (const cls of classes) on ? next.add(cls) : next.delete(cls);
      return next;
    });

  const toggleAll = (on) =>
    setEnabledClasses(
      on ? new Set(Object.keys(summary.classCounts)) : new Set()
    );

  const handleDirChange = (e) => {
    const fileArray = Array.from(e.target.files);
    e.target.value = "";
    if (fileArray.length === 0) return;
    const dirName =
      fileArray[0]?.webkitRelativePath?.split("/")[0] ?? fileArray[0]?.name ?? "dataset";
    const descriptor = {
      id: `hf-disk::${dirName}`,
      label: dirName,
      source: "hf-disk",
      files: fileArray,
    };
    setDatasets((prev) => {
      const without = prev.filter((d) => d.id !== descriptor.id);
      return [...without, descriptor];
    });
    setDataset(descriptor);
  };

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <div>
            <h1>StarEmbed Explorer</h1>
            <p className="meta">
              {info
                ? `${totalRows.toLocaleString()} sources · ${dataset.source === "hf" ? dataset.dataset : (info.path ?? dataset.label)}`
                : " "}
            </p>
          </div>
          <div className="header-controls">
            <select
              className="dataset-select"
              value={dataset.id}
              onChange={(e) =>
                setDataset(datasets.find((d) => d.id === e.target.value))
              }
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              className="browse-btn"
              onClick={() => dirInputRef.current.click()}
              title="Open an HF dataset directory (Arrow shards)"
            >
              Open HF dataset…
            </button>
            <input
              ref={dirInputRef}
              type="file"
              webkitdirectory=""
              style={{ display: "none" }}
              onChange={handleDirChange}
            />
            <button
              className="random-btn"
              onClick={pickRandom}
              disabled={loading || totalRows === 0}
            >
              ⚄ Random star
            </button>
          </div>
        </div>
      </header>

      {loading && <p className="status-msg">Loading…</p>}
      {error && <p className="error">Error: {error}</p>}
      {summary && (
        <DatasetSummary
          summary={summary}
          enabledClasses={enabledClasses}
          onToggle={toggleClass}
          onToggleMany={toggleMany}
          onToggleAll={toggleAll}
        />
      )}
      {!loading && !error && currentRow && (
        <ErrorBoundary key={currentRow.sourceid ?? currentRow.gaia_dr3_source_id}>
          <SourceDetail row={currentRow} />
        </ErrorBoundary>
      )}
    </div>
  );
}

function DatasetSummary({ summary, enabledClasses, onToggle, onToggleMany, onToggleAll }) {
  const { totalRows, classCounts, bands } = summary;
  const allEntries = Object.entries(classCounts);
  const top = allEntries.slice(0, 10);
  const otherEntries = allEntries.slice(10);
  const otherCount = otherEntries.reduce((sum, [, n]) => sum + n, 0);
  const displayed = otherCount > 0 ? [...top, ["Other", otherCount]] : top;
  const maxCount = displayed[0]?.[1] ?? 1;

  const allOn = enabledClasses && allEntries.every(([c]) => enabledClasses.has(c));
  const allOff = enabledClasses && allEntries.every(([c]) => !enabledClasses.has(c));

  return (
    <div className="dataset-summary">
      <div className="summary-top">
        <span className="summary-stat">
          <span className="summary-stat-value">{totalRows.toLocaleString()}</span>
          <span className="summary-stat-label">stars</span>
        </span>
        <span className="summary-stat">
          <span className="summary-stat-value">{allEntries.length}</span>
          <span className="summary-stat-label">classes</span>
        </span>
        {bands.length > 0 && (
          <span className="summary-stat">
            <span className="summary-stat-label">bands&nbsp;</span>
            <span className="summary-stat-value">{bands.join(", ")}</span>
          </span>
        )}
      </div>

      {displayed.length > 0 && (
        <>
          <div className="class-chart-header">
            <span className="class-chart-label">Class filter</span>
            <button className="toggle-all-btn" onClick={() => onToggleAll(!allOn)}>
              {allOn ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="class-chart">
            {displayed.map(([cls, count]) => {
              const isOther = cls === "Other";
              const checked = isOther
                ? otherEntries.some(([c]) => enabledClasses?.has(c))
                : enabledClasses?.has(cls) ?? true;
              const indeterminate = isOther &&
                !otherEntries.every(([c]) => enabledClasses?.has(c)) &&
                otherEntries.some(([c]) => enabledClasses?.has(c));
              return (
                <label key={cls} className={`class-row${checked ? "" : " class-row-off"}`}>
                  <input
                    type="checkbox"
                    className="class-checkbox"
                    checked={checked}
                    ref={el => { if (el) el.indeterminate = indeterminate; }}
                    onChange={() => {
                      if (isOther) {
                        const otherClasses = otherEntries.map(([c]) => c);
                        const anyOn = otherClasses.some((c) => enabledClasses?.has(c));
                        onToggleMany(otherClasses, !anyOn);
                      } else {
                        onToggle(cls);
                      }
                    }}
                  />
                  <span className={`class-name${isOther ? " class-other" : ""}`}>{cls}</span>
                  <div className="class-bar-track">
                    <div
                      className={`class-bar-fill${isOther ? " class-bar-other" : ""}`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="class-count">{count.toLocaleString()}</span>
                  <span className="class-pct">
                    {((count / totalRows) * 100).toFixed(1)}%
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function SourceDetail({ row }) {
  const bands = Object.entries(row.lightcurve ?? {});

  return (
    <div className="star-section">
      <div className="star-header">
        <div className="star-id-block">
          <span className="star-id-label">Gaia DR3</span>
          <span className="star-id-value mono">{row.gaia_dr3_source_id}</span>
        </div>
        <span className="class-badge large">{row.class_str ?? "—"}</span>
      </div>

      <div className="meta-grid">
        <MetaItem label="PTF source ID" value={row.sourceid} mono />
        <MetaItem label="Period" value={row.period != null ? `${row.period.toFixed(6)} d` : null} />
        <MetaItem label="RA" value={row.gaia_dr3_ra?.toFixed(6)} />
        <MetaItem label="Dec" value={row.gaia_dr3_dec?.toFixed(6)} />
        <MetaItem
          label="Parallax"
          value={
            row.parallax != null
              ? `${row.parallax.toFixed(3)} ± ${row.parallax_error?.toFixed(3)} mas`
              : null
          }
        />
        <MetaItem
          label="PM (RA, Dec)"
          value={
            row.pmra != null
              ? `${row.pmra.toFixed(2)}, ${row.pmdec?.toFixed(2)} mas/yr`
              : null
          }
        />
        <MetaItem
          label="Radial vel."
          value={row.radial_velocity != null ? `${row.radial_velocity.toFixed(2)} km/s` : null}
        />
        {bands.map(([bandKey, bandData]) => {
          const good = bandData?.goodflag?.filter((f) => f === 1).length ?? 0;
          return (
            <MetaItem
              key={bandKey}
              label={`${bandKey} obs (good)`}
              value={`${bandData?.length ?? 0} (${good})`}
            />
          );
        })}
      </div>

      <div className="plot-row">
        <div className="plot-col">
          <p className="plot-label">Raw</p>
          <LightCurvePlot row={row} mode="raw" />
        </div>
        <div className="plot-col">
          <p className="plot-label">
            Phase-folded{row.period ? ` — P = ${row.period.toFixed(4)} d` : ""}
          </p>
          <LightCurvePlot row={row} mode="folded" />
        </div>
      </div>
    </div>
  );
}

// Pick a random global row index from enabled classes.
// null = all classes enabled (no filtering).
function randomIndexFromClasses(classIndices, enabledClasses) {
  const entries = Object.entries(classIndices).filter(
    ([cls]) => !enabledClasses || enabledClasses.has(cls)
  );
  const total = entries.reduce((sum, [, idxs]) => sum + idxs.length, 0);
  if (total === 0) return null;
  let r = Math.floor(Math.random() * total);
  for (const [, idxs] of entries) {
    if (r < idxs.length) return idxs[r];
    r -= idxs.length;
  }
  return null;
}

function MetaItem({ label, value, mono = false }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={`meta-value${mono ? " mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
