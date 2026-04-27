import { useEffect, useState } from "react";
import { createDataSource } from "./data";
import { config } from "./config";
import Plot from "./components/Plot.jsx";

/**
 * Placeholder UI for the scaffolding phase.
 * Goal: prove that the data pipeline works end-to-end.
 *   - Connects to the configured DataSource
 *   - Shows dataset metadata
 *   - Renders the first row's series in a Plotly chart IF the row looks
 *     like a time series (heuristic: has array fields)
 *   - Shows the raw rows for inspection
 *
 * Real exploration UI lands in the design phase.
 */
export default function App() {
  const [info, setInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ds = createDataSource();
    Promise.all([ds.getInfo(), ds.getRows({ offset: 0, length: 5 })])
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

  if (loading) {
    return (
      <div className="app">
        <p>Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="app">
        <p className="error">Error loading data: {error}</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Time Series Explorer</h1>
        <p className="meta">
          Source: <code>{config.dataSource}</code>
          {" · "}
          Rows: {info.numRows ?? "?"}
          {" · "}
          Columns: {info.columns?.length ? info.columns.join(", ") : "?"}
        </p>
      </header>

      <PreviewChart row={rows[0]} />

      <details open>
        <summary>First {rows.length} row(s) (raw)</summary>
        <pre>{JSON.stringify(rows, null, 2)}</pre>
      </details>
    </div>
  );
}

/**
 * Heuristic preview: find the first array-of-numbers field in the row and
 * plot it. If a sibling field looks like timestamps (array of strings or
 * numbers, same length), use it as the x axis.
 *
 * This is intentionally generic — we don't know the schema yet. Once we do,
 * this gets replaced with proper schema-aware components.
 */
function PreviewChart({ row }) {
  if (!row) return null;

  const entries = Object.entries(row);
  const numeric = entries.find(
    ([, v]) => Array.isArray(v) && v.length > 0 && typeof v[0] === "number",
  );
  if (!numeric) return null;
  const [valueKey, values] = numeric;

  const xCandidate = entries.find(
    ([k, v]) => k !== valueKey && Array.isArray(v) && v.length === values.length,
  );
  const x = xCandidate ? xCandidate[1] : values.map((_, i) => i);
  const xLabel = xCandidate ? xCandidate[0] : "index";

  const seriesId =
    row.id || row.item_id || row.series_id || row.name || "series 0";

  return (
    <Plot
      data={[
        {
          x,
          y: values,
          type: "scatter",
          mode: "lines",
          name: String(seriesId),
        },
      ]}
      layout={{
        title: { text: `Preview: ${seriesId}` },
        margin: { t: 40, r: 20, b: 40, l: 50 },
        xaxis: { title: { text: xLabel }, rangeslider: { visible: true } },
        yaxis: { title: { text: valueKey } },
      }}
      style={{ width: "100%", height: "420px" }}
      config={{ responsive: true, displaylogo: false }}
      useResizeHandler
    />
  );
}
