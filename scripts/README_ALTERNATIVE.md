# Alternative Approach: Calculate Heat Indices (No Terabytes!)

## The Problem

The full ERA5-CHI dataset is **terabytes** of data:
- Each monthly file: **6-7 GB**
- Full dataset (1950-2024): **~6+ TB**
- Not feasible to download and process

## The Solution

**Calculate heat indices from your existing temperature data!**

Instead of downloading terabytes, we calculate heat indices using standard formulas from the temperature data you already have.

## What We Calculate

From your existing temperature data (from energy consumption dataset), we calculate:

1. **Apparent Temperature (AT)** - "Feels like" temperature
   - Formula: Steadman's model
   - Uses: Temperature + Humidity

2. **Heat Index (HI)** - US National Weather Service standard
   - Formula: Rothfusz equation
   - Uses: Temperature + Humidity
   - Only valid above 26.7°C (80°F)

3. **Wet-Bulb Temperature (Twb)** - Critical for heat stress
   - Formula: Stull's approximation (2011)
   - Uses: Temperature + Humidity + Pressure

4. **UTCI Approximation** - Simplified Universal Thermal Climate Index
   - Uses: Temperature + Humidity + Wind + Solar radiation
   - Note: Full UTCI requires complex Fiala model, this is simplified

## How to Use

### Step 1: Calculate Indices

```bash
cd scripts
python3 calculate_heat_indices.py
```

This reads your existing temperature data from:
- `data/processed/energy/italy_energy_monthly.csv`

And creates:
- `data/processed/era5-chi/calculated_heat_indices_monthly.csv`

### Step 2: Use in Explorer

The Data Explorer automatically uses calculated indices! No download needed.

## Advantages

✅ **No download required** - Uses data you already have  
✅ **Small file size** - Just a few KB instead of TB  
✅ **Fast processing** - Seconds instead of hours  
✅ **Same visualizations** - Works with explorer page  
✅ **Based on real data** - Uses your actual temperature measurements  

## Limitations

⚠️ **Simplified formulas** - Not as comprehensive as full ERA5-CHI  
⚠️ **Requires humidity data** - Uses default 65% if not available  
⚠️ **UTCI is approximation** - Full UTCI needs complex model  
⚠️ **No spatial variation** - Uses average temperature for region  

## If You Need Full ERA5-CHI Later

If you later need the full dataset:
1. Use **Copernicus CDS API** to download only **regional subsets** (Europe/Italy)
2. This reduces files from 7GB to ~500MB per month
3. Still large, but manageable for specific years (e.g., 2020-2024)

## Current Status

✅ Heat indices calculated from existing data  
✅ Explorer page ready to use them  
✅ No terabytes to download!  
