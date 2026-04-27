import { useEffect, useState, useRef } from "react";
import { createDataSource } from "./data";
import { DATASETS } from "./datasets.js";
import LightCurvePlot from "./components/LightCurvePlot.jsx";

export default function App() {
  const [datasets, setDatasets] = useState(DATASETS);
  const [dataset, setDataset] = useState(DATASETS[0]);
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const fileInputRef = useRef(null);
  const dirInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRows([]);
    setInfo(null);
    setSelectedIdx(null);

    const ds = createDataSource(dataset);
    Promise.all([ds.getInfo(), ds.getRows({ offset: 0, length: 200 })])
      .then(([info, rows]) => {
        if (cancelled) return;
        setInfo(info);
        setRows(rows);
        if (rows.length > 0) {
          setSelectedIdx(Math.floor(Math.random() * rows.length));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataset]);

  const pickRandom = () =>
    setSelectedIdx(Math.floor(Math.random() * rows.length));

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    const descriptor = {
      id: `file::${file.name}`,
      label: file.name,
      source: "file",
      file,
    };
    setDatasets((prev) => {
      const without = prev.filter((d) => d.id !== descriptor.id);
      return [...without, descriptor];
    });
    setDataset(descriptor);
  };

  const handleDirChange = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";
    const dirName =
      files[0]?.webkitRelativePath?.split("/")[0] ?? files[0]?.name ?? "dataset";
    const descriptor = {
      id: `hf-disk::${dirName}`,
      label: dirName,
      source: "hf-disk",
      files: Array.from(files),
    };
    setDatasets((prev) => {
      const without = prev.filter((d) => d.id !== descriptor.id);
      return [...without, descriptor];
    });
    setDataset(descriptor);
  };

  const selectedRow = selectedIdx !== null ? rows[selectedIdx] : null;

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <div>
            <h1>StarEmbed Explorer</h1>
            <p className="meta">
              {info
                ? `${info.numRows ?? rows.length} sources · ${dataset.source === "hf" ? dataset.dataset : (info.path ?? dataset.path ?? dataset.label)}`
                : " "}
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
              className="browse-btn secondary"
              onClick={() => fileInputRef.current.click()}
              title="Open a JSONL file"
            >
              Open JSONL…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.json"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className="random-btn"
              onClick={pickRandom}
              disabled={rows.length === 0}
            >
              ⚄ Random star
            </button>
          </div>
        </div>
      </header>

      {loading && <p className="status-msg">Loading…</p>}
      {error && <p className="error">Error: {error}</p>}
      {!loading && !error && selectedRow && <SourceDetail row={selectedRow} />}
    </div>
  );
}

function SourceDetail({ row }) {
  const g = row.lightcurve.g_PTF;
  const R = row.lightcurve.R_PTF;
  const gGood = g?.goodflag?.filter((f) => f === 1).length ?? 0;
  const RGood = R?.goodflag?.filter((f) => f === 1).length ?? 0;

  return (
    <div>
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
        <MetaItem label="g obs (good)" value={`${g?.length ?? 0} (${gGood})`} />
        <MetaItem label="R obs (good)" value={`${R?.length ?? 0} (${RGood})`} />
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

function MetaItem({ label, value, mono = false }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={`meta-value${mono ? " mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
