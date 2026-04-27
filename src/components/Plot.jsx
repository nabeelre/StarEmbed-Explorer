// Use the factory + dist-min build instead of plain `react-plotly.js` so we
// don't bundle the full Plotly source (~3MB). Swap to `plotly.js-basic-dist-min`
// later if we only need a subset of chart types.
import createPlotlyComponent from "react-plotly.js/factory";
import Plotly from "plotly.js-dist-min";

const Plot = createPlotlyComponent(Plotly);

export default Plot;
