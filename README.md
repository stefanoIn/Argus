## Argus — Urban Heat Islands (D3.js storytelling website)

Interactive, narrative-driven website exploring **Urban Heat Islands (UHI)** using satellite imagery and public datasets, built with **HTML + CSS + JavaScript + D3.js**.

### Live website (GitHub Pages)
- **Live demo**: `https://stefanoIn.github.io/Argus/`
- **Repository**: `https://github.com/stefanoIn/Argus`

### Tech stack (course requirements)
- **Frontend**: HTML, CSS, JavaScript
- **Visualization**: D3.js v7 (loaded via CDN in `index.html`)
- **No build step**: served as static files (compatible with GitHub Pages)

## Folder structure (where things live)

```
Argus/
  index.html                 # Main website (story + methodology)
  css/style.css              # Global styles (light/dark theme)
  js/                        # D3 visualizations + page logic
  data/
    json/                    # Web-ready datasets used by visualizations (loaded via fetch)
    processed/               # Derived artifacts (e.g., GeoTIFF outputs used in the Genoa case study)
    raw/                     # Raw inputs (when stored)
    eurostat_chdd/           # HDD/CDD inputs + preprocessing notebook + outputs
    electricity_consumption_italy/  # Terna Excel + preprocessing notebook + outputs
    average_monthly_temperature_ERA5/ # ERA5 notebook + outputs
    heat_and_health/         # Lancet Countdown CSV + conversion script + JSON
```

### What the website loads
All D3 charts load data from **`data/json/`** using `fetch(...)`. This folder contains the exact JSON files used at runtime.

## Run the website locally (reproducibility)

Because the site loads local JSON via `fetch()`, you must run a local server (opening `index.html` via `file://` won’t work).

From the repository root:

```bash
python3 -m http.server 8000
```

Then open:
- `http://localhost:8000/`

## Data sources (with references)

### Satellite & land cover (Genoa case study)
- **Landsat 8–9 TIRS (thermal, LST target)**  
  Downloaded programmatically via custom **USGS M2M** client: `https://github.com/stefanoIn/USGS-m2m-client`
- **Sentinel‑2 (optical predictors: NDVI/NDBI/NDWI)**  
  Downloaded via custom **Copernicus Data Space Ecosystem (CDSE)** client: `https://github.com/stefanoIn/CDSE-api`
- **ESA WorldCover 2021 (land cover)**: `https://esa-worldcover.org/en`
- **DEM (topography)**: used for elevation/slope/aspect predictors (10m; local file in `data/processed/`)

### Climate & energy (Italy)
- **ERA5 Reanalysis (temperature)**: Copernicus Climate Data Store `https://cds.climate.copernicus.eu/`
- **Eurostat HDD/CDD (CHDD)** dataset `nrg_chdd_m`  
  Data browser: `https://ec.europa.eu/eurostat/databrowser/view/nrg_chdd_m`  
  API: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_chdd_m`
- **Terna (Italy electricity consumption)**: official monthly reports (Excel files stored in `data/electricity_consumption_italy/`)

### Heat & health (global)
- **Lancet Countdown 2025** (sleep loss, heat-related mortality, potential work hours lost, vulnerable-population exposure):  
  `https://www.lancetcountdown.org/`

### Urban population (global)
- **World Bank WDI** (urban population): `https://data.worldbank.org/`

## Preprocessing (how the data was generated)

This repo includes both **notebooks** and **Python scripts** used to download/clean/transform data into the JSON files used by the website.

### 1) Italy electricity consumption (Terna → JSON)
- **Notebook**: `data/electricity_consumption_italy/electricity_italy_2021_2025.ipynb`
- **Inputs**: `data/electricity_consumption_italy/electricity_italy_202*.xlsx`
- **Output (used by site)**: `data/electricity_consumption_italy/electricity_italy_monthly_consumption_mwh_2021_2025.json` (and/or aggregated JSON in `data/json/`)

### 2) Italy temperature (ERA5 → JSON)
- **Notebook**: `data/average_monthly_temperature_ERA5/avg_monthly_temperature_italy_era5.ipynb`
- **Output (used by site)**: `data/average_monthly_temperature_ERA5/italy_monthly_avg_temperature_c_2021_2025.json`

### 3) HDD / CDD (Eurostat CHDD → JSON)
- **Notebook**: `data/eurostat_chdd/preprocessing_estat_chdd.ipynb`
- **Input**: `data/eurostat_chdd/estat_nrg_chdd_m.tsv`
- **Outputs (used by site)**:
  - `data/eurostat_chdd/hdd_italy_by_year.json`, `data/eurostat_chdd/cdd_italy_by_year.json`
  - `data/eurostat_chdd/hdd_italy_by_month.json`, `data/eurostat_chdd/cdd_italy_by_month.json`

### 4) Heat & health indicators (Lancet Countdown CSV → JSON)
- **Script**: `data/heat_and_health/preprocess_to_json.py`
- **Inputs**: CSV files in `data/heat_and_health/`
- **Outputs**: JSON files next to the CSVs (and mirrored into `data/json/` for the website)

Run from the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install pandas
python3 data/heat_and_health/preprocess_to_json.py
```

### 5) Additional pipeline scripts (optional)
These are included for completeness and can be run from inside `data/` (they create `raw/`, `processed/`, `json/` relative to the current working directory):

```bash
cd data
python3 fetch_heat_consequences_data.py
python3 create_heat_consequences_plots.py
python3 download_and_preprocess_heat_data.py
```

## Methodology (in the website)

The site includes a dedicated **Methodology** section (see `#methodology` in `index.html`) covering:
- data sources + links
- cleaning/imputation
- processing pipeline (including LST downscaling concept)
- limitations + uncertainty notes
- interaction and performance choices

## Team
- **Stefano Infusini** — data preprocessing, D3 implementation, storytelling + web development

