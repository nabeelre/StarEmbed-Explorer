import Plot from "./Plot.jsx";

// RA (0–360°) → longitude (−180–180°) for Plotly's geo projection
const toLon = (ra) => (ra > 180 ? ra - 360 : ra);

export default function SkyPlot({ skyPoints, currentRow }) {
  const hasPoints = skyPoints.length > 0;
  const lon = skyPoints.map((p) => toLon(p.ra));
  const lat = skyPoints.map((p) => p.dec);

  const curRa = currentRow?.gaia_dr3_ra;
  const curDec = currentRow?.gaia_dr3_dec;

  const traces = [
    {
      type: "scattergeo",
      lon,
      lat,
      mode: "markers",
      marker: { color: "#7aafd4", size: 3, opacity: 0.55 },
      hoverinfo: "skip",
      showlegend: false,
    },
  ];

  if (curRa != null && curDec != null) {
    traces.push({
      type: "scattergeo",
      lon: [toLon(curRa)],
      lat: [curDec],
      mode: "markers",
      marker: {
        color: "#e05c3a",
        size: 12,
        symbol: "star",
        line: { color: "#fff", width: 1.5 },
      },
      hovertemplate:
        `RA: ${curRa.toFixed(3)}°  Dec: ${curDec.toFixed(3)}°<extra></extra>`,
      showlegend: false,
    });
  }

  return (
    <Plot
      data={traces}
      layout={{
        margin: { t: 4, r: 4, b: 4, l: 4 },
        geo: {
          projection: { type: "mollweide" },
          showframe: true,
          framecolor: "#c0c8d4",
          bgcolor: "#f0f4f8",
          showcoastlines: false,
          showland: false,
          showocean: false,
          showlakes: false,
          showcountries: false,
          lonaxis: {
            showgrid: true,
            gridcolor: "#c8d4e0",
            gridwidth: 1,
            dtick: 60,
            tick0: 0,
          },
          lataxis: {
            showgrid: true,
            gridcolor: "#c8d4e0",
            gridwidth: 1,
            dtick: 30,
            tick0: 0,
          },
        },
        paper_bgcolor: "transparent",
        showlegend: false,
        hovermode: "closest",
        annotations: hasPoints ? [] : [
          {
            text: "No sky coordinates (RA/Dec) found in this dataset",
            xref: "paper", yref: "paper",
            x: 0.5, y: 0.5,
            xanchor: "center", yanchor: "middle",
            showarrow: false,
            font: { size: 12, color: "#999" },
          },
        ],
      }}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true, displaylogo: false }}
      useResizeHandler
    />
  );
}
