import Plot from "./Plot.jsx";

const PALETTE = [
  "#3a7cbf", "#d95f3b", "#2ca02c", "#9467bd",
  "#e7ba52", "#17becf", "#e377c2", "#8c564b",
];

function buildTrace(bandKey, bandData, mode, period, color) {
  if (!bandData?.mjd?.length) return null;

  const { mjd, mag, mag_unc, goodflag } = bandData;
  const idx = mjd.map((_, i) => i).filter((i) => !goodflag || goodflag[i] === 1);
  if (!idx.length) return null;

  const x =
    mode === "folded" && period > 0
      ? idx.map((i) => (((mjd[i] % period) + period) % period) / period)
      : idx.map((i) => mjd[i]);

  return {
    x,
    y: idx.map((i) => mag[i]),
    error_y: {
      type: "data",
      array: idx.map((i) => mag_unc[i]),
      visible: true,
      width: 0,
      thickness: 1.2,
    },
    type: "scatter",
    mode: "markers",
    name: bandKey,
    marker: { color, size: 8, opacity: 0.8 },
  };
}

export default function LightCurvePlot({ row, mode = "raw" }) {
  if (!row) return null;

  const traces = Object.keys(row.lightcurve).map((bandKey, i) =>
    buildTrace(bandKey, row.lightcurve[bandKey], mode, row.period, PALETTE[i % PALETTE.length])
  ).filter(Boolean);

  if (!traces.length) {
    return <p className="no-data">No good-flag observations in any band.</p>;
  }

  return (
    <Plot
      data={traces}
      layout={{
        margin: { t: 16, r: 16, b: 56, l: 60 },
        xaxis: { title: { text: mode === "folded" ? "Phase" : "MJD" } },
        yaxis: { title: { text: "Magnitude" }, autorange: "reversed" },
        legend: { orientation: "h", y: -0.2 },
        hovermode: "closest",
        paper_bgcolor: "transparent",
        plot_bgcolor: "#f7f8fa",
      }}
      style={{ width: "100%", height: "380px" }}
      config={{ responsive: true, displaylogo: false }}
      useResizeHandler
    />
  );
}
