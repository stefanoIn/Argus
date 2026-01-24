# ERA5-CHI Dataset Integration Guide

## Overview

The ERA5 Comprehensive Heat Indices (ERA5-CHI) dataset provides 13 different heat stress indices at high resolution (0.1° × 0.1°) from 1950-2024. This guide explains how to integrate it into the Urban Heat Islands visualization project.

## Dataset Information

**Source:** https://figshare.com/articles/dataset/ERA5-Comprehensive_Heat_Indices_ERA5-CHI_Dataset_v1_0_/30539867

**Available Indices:**
- UTCI (Universal Thermal Climate Index)
- Apparent Temperature
- Lethal Heat Stress Index
- Wet-bulb Temperature
- Mean Radiant Temperature
- Wind Chill
- Heat Index
- And 6 more comprehensive metrics

**Resolution:** 0.1° × 0.1° (approximately 11km)
**Temporal Coverage:** 1950-2024 (hourly data)
**Format:** NetCDF (.nc files)

## Download Instructions

1. Visit the Figshare dataset page
2. Download the NetCDF files for your region of interest
3. For Genoa/Italy focus, download European region files
4. Place downloaded `.nc` files in `data/raw/era5-chi/`

## Processing Steps

### Step 1: Install Dependencies

```bash
pip install netCDF4 numpy pandas
```

### Step 2: Process NetCDF Files

```bash
cd scripts
python3 download_era5_chi.py process utci genoa
```

This will:
- Extract UTCI data for the Genoa region
- Convert to CSV format
- Save to `data/processed/era5-chi/genoa_utci_processed.csv`

### Step 3: Aggregate Data

For web visualization, aggregate to daily/monthly:

```bash
python3 download_era5_chi.py aggregate \
    ../data/processed/era5-chi/genoa_utci_processed.csv \
    ../data/processed/era5-chi/genoa_utci_monthly.csv \
    monthly
```

## Integration with Explorer

The Data Explorer page (`explorer.html`) is set up to:
1. Load processed CSV files from `data/processed/era5-chi/`
2. Display temporal trends
3. Compare multiple indices
4. Show health risk correlations

## File Naming Convention

Processed files should follow this naming:
```
{region}_{index}_{time_range}.csv
```

Examples:
- `genoa_utci_recent.csv` - UTCI for Genoa, 2020-2024
- `genoa_apparent_temp_decade.csv` - Apparent Temperature, 2014-2024
- `italy_lethal_stress_century.csv` - Lethal Heat Stress, 1950-2024

## CSV Format

Processed CSV files should have this structure:
```csv
date,value,index
2020-01-01 00:00:00,15.3,utci
2020-01-01 01:00:00,15.1,utci
...
```

For aggregated data:
```csv
date,value,index
2020-01-01,15.2,utci
2020-02-01,16.1,utci
...
```

## Next Steps

1. Download ERA5-CHI dataset from Figshare
2. Process files for Genoa region
3. Extract multiple indices (UTCI, Apparent Temperature, Lethal Heat Stress)
4. Create correlation visualizations with mortality data
5. Add to Data Explorer page

## Notes

- The full dataset is very large - process only regions/time periods needed
- NetCDF files can be several GB each - ensure sufficient disk space
- Processing may take time for large files - consider processing in batches
- The explorer will show helpful messages if data files are not found
