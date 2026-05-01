// Survey → band registry. Order controls display order everywhere in the UI.
export const SURVEY_LIBRARY = [
  {
    survey: 'ZTF',
    bands: [
      { key: 'g_ZTF',  label: 'g',     color: '#3dc9a0' },
      { key: 'r_ZTF',  label: 'r',     color: '#ff5555' },
      { key: 'i_ZTF',  label: 'i',     color: '#c47eff' },
    ],
  },
  {
    survey: 'PTF',
    bands: [
      { key: 'g_PTF',  label: 'g',     color: '#7da9ff' },
      { key: 'R_PTF',  label: 'R',     color: '#ff8a72' },
    ],
  },
  {
    survey: 'Gaia',
    bands: [
      { key: 'G',      label: 'G',     color: '#a8d0ff' },
      { key: 'G_BP',   label: 'BP',    color: '#9c8cff' },
      { key: 'G_RP',   label: 'RP',    color: '#ff6b6b' },
    ],
  },
  {
    survey: 'CSS',
    bands: [
      { key: 'clear',  label: 'clear', color: '#c8d4e8' },
    ],
  },
];

// Flat lookup: band key → { survey, key, label, color }
const BAND_LOOKUP = Object.fromEntries(
  SURVEY_LIBRARY.flatMap((s) =>
    s.bands.map((b) => [b.key, { survey: s.survey, ...b }])
  )
);

const FALLBACK_COLORS = [
  '#e8c77a', '#a4c9b0', '#f0a02b', '#ffd166', '#5dd6e6', '#3bbd8e',
];

// Returns { survey, key, label, color } for any band key, known or unknown.
export function getBandInfo(key, fallbackIndex = 0) {
  return BAND_LOOKUP[key] ?? {
    survey: 'Other',
    key,
    label: key,
    color: FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length],
  };
}

// { bandKey: color } map consumed by LightCurveChart and SkyMapCanvas.
export function buildBandColors(bandKeys) {
  if (!bandKeys?.length) return {};
  let fi = 0;
  return Object.fromEntries(
    bandKeys.map((k) => {
      const info = getBandInfo(k, fi);
      if (!BAND_LOOKUP[k]) fi++;
      return [k, info.color];
    })
  );
}

// Groups a flat list of band keys by survey, preserving SURVEY_LIBRARY order.
// Returns [{ survey, bands: [{ key, label, color }] }, ...]
// Unknown bands are appended in an 'Other' group.
export function groupBandsBySurvey(bandKeys) {
  if (!bandKeys?.length) return [];
  const keySet = new Set(bandKeys);
  const groups = [];

  for (const { survey, bands } of SURVEY_LIBRARY) {
    const present = bands.filter((b) => keySet.has(b.key));
    if (present.length) groups.push({ survey, bands: present });
  }

  let fi = 0;
  const unknowns = bandKeys
    .filter((k) => !BAND_LOOKUP[k])
    .map((k) => ({
      key: k,
      label: k,
      color: FALLBACK_COLORS[fi++ % FALLBACK_COLORS.length],
    }));
  if (unknowns.length) groups.push({ survey: 'Other', bands: unknowns });

  return groups;
}
