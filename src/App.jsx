import { useEffect, useState, useMemo } from "react";
import { createDataSource } from "./data";
import { config } from "./config";
import LightCurvePlot from "./components/LightCurvePlot.jsx";

const PAGE_SIZE = 20;

export default function App() {
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const ds = createDataSource();
    Promise.all([ds.getInfo(), ds.getRows({ offset: 0, length: 200 })])
      .then(([info, rows]) => {
        if (cancelled) return;
        setInfo(info);
        setRows(rows);
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
  }, []);

  const filteredRows = useMemo(() => {
    const q = classFilter.trim().toUpperCase();
    return rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => !q || row.class_str?.toUpperCase().includes(q));
  }, [rows, classFilter]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedRow = selectedIdx !== null ? rows[selectedIdx] : null;

  if (loading) return <div className="app"><p>Loading…</p></div>;
  if (error) return <div className="app"><p className="error">Error: {error}</p></div>;

  return (
    <div className="app">
      <header>
        <h1>StarEmbed Explorer</h1>
        <p className="meta">
          Source: <code>{config.dataSource}</code>
          {" · "}
          {info?.numRows ?? rows.length} total sources
          {" · "}
          g_PTF + R_PTF bands
        </p>
      </header>

      <div className="explorer-layout">
        <section className="source-panel">
          <div className="panel-toolbar">
            <input
              className="search-input"
              type="search"
              placeholder="Filter by class (EW, RR, CEP…)"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(0);
              }}
            />
            <span className="count-badge">{filteredRows.length}</span>
            <button
              className="random-btn"
              onClick={() => setSelectedIdx(Math.floor(Math.random() * rows.length))}
              title="Jump to a random source"
            >
              ⚄ Random
            </button>
          </div>

          <div className="table-scroll">
            <table className="source-table">
              <thead>
                <tr>
                  <th>Source ID</th>
                  <th>Class</th>
                  <th>Period (d)</th>
                  <th>g</th>
                  <th>R</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ row, idx }) => (
                  <tr
                    key={row.sourceid}
                    className={idx === selectedIdx ? "selected" : ""}
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <td className="mono">{row.sourceid}</td>
                    <td>
                      <span className="class-badge">{row.class_str ?? "—"}</span>
                    </td>
                    <td>{row.period != null ? row.period.toFixed(4) : "—"}</td>
                    <td>{row.lightcurve.g_PTF?.length ?? 0}</td>
                    <td>{row.lightcurve.R_PTF?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ←
              </button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </section>

        <section className="detail-panel">
          {selectedRow ? (
            <SourceDetail row={selectedRow} />
          ) : (
            <p className="empty-hint">← Select a source to explore its light curve.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function SourceDetail({ row }) {
  const g = row.lightcurve.g_PTF;
  const R = row.lightcurve.R_PTF;
  const gGood = g?.goodflag?.filter((f) => f === 1).length ?? 0;
  const RGood = R?.goodflag?.filter((f) => f === 1).length ?? 0;

  return (
    <div className="detail-inner">
      <div className="detail-titlebar">
        <h2 className="mono">{row.sourceid}</h2>
        <span className="class-badge large">{row.class_str ?? "—"}</span>
      </div>

      <div className="meta-grid">
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
        <MetaItem label="Gaia DR3 ID" value={row.gaia_dr3_source_id} mono />
        <MetaItem label="g obs (good)" value={`${g?.length ?? 0} (${gGood})`} />
        <MetaItem label="R obs (good)" value={`${R?.length ?? 0} (${RGood})`} />
      </div>

      <div className="plot-row">
        <div className="plot-col">
          <p className="plot-label">Raw</p>
          <LightCurvePlot row={row} mode="raw" />
        </div>
        <div className="plot-col">
          <p className="plot-label">Phase-folded {row.period ? `(P = ${row.period.toFixed(4)} d)` : ""}</p>
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
