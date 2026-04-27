import { useEffect, useState } from "react";
import { createDataSource } from "./data";
import { DATASETS } from "./datasets.js";
import LightCurvePlot from "./components/LightCurvePlot.jsx";

export default function App() {
  const [dataset, setDataset] = useState(DATASETS[0]);
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);

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

  const selectedRow = selectedIdx !== null ? rows[selectedIdx] : null;

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <div>
            <h1>StarEmbed Explorer</h1>
            <p className="meta">
              {info
                ? `${info.numRows ?? rows.length} sources · ${dataset.source === "hf" ? dataset.dataset : dataset.path}`
                : " "}
            </p>
          </div>
          <div className="header-controls">
            {DATASETS.length > 1 && (
              <select
                className="dataset-select"
                value={dataset.id}
                onChange={(e) =>
                  setDataset(DATASETS.find((d) => d.id === e.target.value))
                }
              >
                {DATASETS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
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
