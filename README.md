# Vanishing Clouds
## Mapping the Hidden Decline of Colombia's Páramo Ecosystems

Vanishing Clouds is an interactive GIS storytelling website exploring the accelerating decline of Colombia's páramo ecosystems — rare high-altitude biomes found primarily in the tropical Andes that act as natural water towers, cloud forests, and refugia for hundreds of endemic species found nowhere else on Earth. The project combines biodiversity occurrence data, land cover change analysis, fire detection records, and conservation urgency indices to tell a data-driven story about one of the planet's most imperiled and least-known biomes.

The site is a fully static prototype deployable on GitHub Pages, using Leaflet.js for interactive maps, Chart.js for data visualizations, and vanilla JavaScript with no build step or framework required. All spatial data is stored as GeoJSON in the repository, making it fully reproducible, forkable, and adaptable for research or environmental journalism.

---

## Features

- **5 interactive Leaflet maps** — páramo boundaries, elevation zones, species occurrences through time, multi-layer threats, and conservation urgency hexagons
- **Species explorer** — filterable grid of 20 endemic species with modal detail view, statistics, and per-species mini-map
- **Time-series toggle** — filter species occurrence records by era (pre-1980 through 2021–present) with color-coded map updates
- **Threats map** — toggleable layers for agriculture expansion, fire alerts, urban pressure, and mining zones
- **Conservation urgency index** — hexagonal choropleth with composite urgency scores and at-risk profile cards
- **Chart.js visualizations** — records-by-decade bar chart and urgency-class donut chart
- **Fully responsive** — works on mobile and desktop with touch-friendly maps

---

## Running Locally

```bash
# Option 1 — Open directly in browser
# Simply open index.html in any modern browser (Chrome, Firefox, Edge, Safari)
# Note: GeoJSON files load via fetch(), so a local server is recommended

# Option 2 — Local server (recommended)
npx serve .
# Then open http://localhost:3000

# Option 3 — Python server
python -m http.server 8000
# Then open http://localhost:8000
```

---

## Deploying to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under *Source*, select **Deploy from a branch**
4. Select **main** branch, **/ (root)** folder
5. Click **Save**

Your site will be live at `https://[your-username].github.io/[repo-name]/` within a few minutes.

---

## Data Sources

| Dataset | Source | Description | License |
|---------|--------|-------------|---------|
| Páramo Boundaries | [Instituto Humboldt (IAvH)](https://www.humboldt.org.co) | Official páramo complex delineations (2012–2023) | CC BY 4.0 |
| Species Occurrences | [GBIF](https://www.gbif.org) / [iNaturalist](https://www.inaturalist.org) | Georeferenced species records from multiple data providers | CC BY 4.0 |
| Land Cover Change | [MapBiomas Colombia](https://colombia.mapbiomas.org) | Annual land cover classifications from Landsat, 1985–2023 | CC BY 4.0 |
| Fire Alerts | [NASA FIRMS / VIIRS](https://firms.modaps.eosdis.nasa.gov) | Near-real-time fire detections from VIIRS 375m sensor | Public Domain |
| Conservation Urgency | Derived composite index | Scores combining species richness, threat layers, protection status | CC BY 4.0 |

> **Note:** All GeoJSON data in this repository is sample/prototype data generated to reflect realistic geographic patterns. For production use, replace with official datasets from the sources above.

---

## File Structure

```
vanishing-clouds/
├── index.html                       # Main single-page site (7 sections)
├── styles/
│   └── main.css                     # All styles, responsive breakpoints, animations
├── js/
│   ├── main.js                      # Navigation, scroll effects, stat counters
│   ├── maps.js                      # All 5 Leaflet map initializations
│   ├── species.js                   # Species explorer grid, filtering, modal
│   ├── charts.js                    # Chart.js visualizations (bar + donut)
│   └── timeslider.js                # Time-period filter UI wiring
├── data/
│   ├── paramos_boundaries.geojson   # 12 páramo complex polygons (Colombia)
│   ├── species_occurrences.geojson  # 150+ species occurrence points
│   ├── species_profiles.json        # 20 endemic species profiles
│   ├── land_cover_change.geojson    # Land cover change polygons
│   ├── fire_alerts.geojson          # Fire alert points (VIIRS-style)
│   └── urgency_index.geojson        # Conservation urgency hexagons
└── README.md
```

---

## Tech Stack

- **Maps:** [Leaflet.js](https://leafletjs.com) 1.9.4 (via CDN)
- **Charts:** [Chart.js](https://www.chartjs.org) 4.4 (via CDN)
- **Basemap:** [CartoDB Positron](https://carto.com/basemaps/) (no API key required)
- **Data format:** GeoJSON (stored locally in `/data/`)
- **Fonts:** [Google Fonts](https://fonts.google.com) — Playfair Display + Inter
- **Deployment:** GitHub Pages (static, no build step)

---

## License

Content and code licensed under **CC BY 4.0**.

Please attribute as:
> *Vanishing Clouds: Mapping the Hidden Decline of Colombia's Páramo Ecosystems*, 2024. Data sources: GBIF (CC BY 4.0), Instituto Humboldt, MapBiomas Colombia, NASA FIRMS.
