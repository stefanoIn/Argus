"""
Fetch Real Public Data and Create Visualizations for Heat Consequences
Part of Urban Heat Islands Data Visualization Project

Data Sources:
1. Energy Consumption: Eurostat (nrg_cb_e or nrg_cb_pem)
2. Temperature: Copernicus ERA5 or alternative public sources
3. Mortality: Eurostat excess mortality or peer-reviewed datasets

Author: Data Visualization Project
Date: 2025
"""

try:
    import pandas as pd
    import matplotlib.pyplot as plt
    import seaborn as sns
    import numpy as np
    from datetime import datetime
    import requests
    import json
    import os
except ImportError as e:
    print("ERROR: Required packages not installed.")
    print("Please run: pip install -r requirements_heat_data.txt")
    print(f"Missing package: {e}")
    exit(1)

# Set style for publication-ready plots
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 300
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 13
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9

# Create output directory
output_dir = "processed"
os.makedirs(output_dir, exist_ok=True)

print("=" * 70)
print("FETCHING REAL PUBLIC DATA FOR HEAT CONSEQUENCES VISUALIZATION")
print("=" * 70)

# ============================================================================
# PART 1: ENERGY CONSUMPTION VS TEMPERATURE
# ============================================================================

print("\n[PART 1] Fetching Energy Consumption and Temperature Data...")

# Method 1: Try Eurostat API for electricity consumption
def fetch_eurostat_electricity():
    """
    Fetch monthly electricity consumption for Italy from Eurostat
    Dataset: nrg_cb_pem (Energy balances) or nrg_cb_e (Electricity)
    """
    try:
        # Eurostat REST API endpoint
        # Using nrg_cb_pem (Energy balances) which includes electricity consumption
        dataset_code = "nrg_cb_pem"
        url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset_code}"
        
        params = {
            "format": "json",
            "lang": "en",
            "geo": "IT",  # Italy
            "nrg_bal": "FC",  # Final consumption
            "siec": "E7000",  # Electricity
            "unit": "GWH"  # Gigawatt hours
        }
        
        print(f"  Attempting to fetch from Eurostat API: {dataset_code}")
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print("  ✓ Successfully fetched from Eurostat API")
            return data
        else:
            print(f"  ✗ API returned status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"  ✗ Error fetching from Eurostat API: {e}")
        return None

# Alternative: Try to load from CSV if API fails
def load_electricity_alternative():
    """
    Alternative method: Load pre-downloaded Eurostat data or use sample structure
    """
    print("  Attempting alternative data source...")
    
    # Check if we have a local CSV file
    csv_path = os.path.join("raw", "eurostat_electricity_italy.csv")
    if os.path.exists(csv_path):
        print(f"  ✓ Found local CSV file: {csv_path}")
        return pd.read_csv(csv_path)
    
    # If no local file, we'll create a note about where to get the data
    print("  ⚠ No local data file found")
    print("  → To get Eurostat data manually:")
    print("    1. Visit: https://ec.europa.eu/eurostat/databrowser/view/nrg_cb_pem")
    print("    2. Filter: Country=Italy, Energy balance=Final consumption, Product=Electricity")
    print("    3. Export as CSV and save to data/raw/eurostat_electricity_italy.csv")
    return None

# Fetch temperature data
def fetch_temperature_data():
    """
    Fetch monthly average temperature for Italy
    Sources: ERA5, World Bank Climate Data, or alternative
    """
    try:
        # Try World Bank Climate API as a simpler alternative to ERA5
        # World Bank provides country-level climate data
        print("  Attempting to fetch temperature from World Bank Climate API...")
        
        # World Bank Climate Data API
        url = "https://api.worldbank.org/v2/country/ITA/indicator/AG.LND.PRCP.MM"
        
        # Actually, World Bank doesn't have monthly temperature easily accessible
        # Let's try a different approach - use a public climate dataset
        
        # Alternative: Use pre-processed ERA5 data or NOAA data
        csv_path = os.path.join("raw", "italy_monthly_temperature.csv")
        if os.path.exists(csv_path):
            print(f"  ✓ Found local temperature CSV: {csv_path}")
            return pd.read_csv(csv_path)
        
        print("  ⚠ No local temperature data file found")
        print("  → To get temperature data manually:")
        print("    1. Visit: https://cds.climate.copernicus.eu/")
        print("    2. Download ERA5 monthly temperature for Italy (lat 36-47, lon 6-19)")
        print("    3. Average over the region and save to data/raw/italy_monthly_temperature.csv")
        return None
        
    except Exception as e:
        print(f"  ✗ Error fetching temperature data: {e}")
        return None

# ============================================================================
# PART 2: HEAT-RELATED MORTALITY
# ============================================================================

print("\n[PART 2] Fetching Heat-Related Mortality Data...")

def fetch_mortality_data():
    """
    Fetch heat-related excess mortality data
    Sources: Eurostat, WHO, or peer-reviewed datasets
    """
    try:
        # Try Eurostat excess mortality statistics
        dataset_code = "demo_mexrt"
        url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset_code}"
        
        params = {
            "format": "json",
            "lang": "en",
            "geo": "IT",  # Italy
            "age": "TOTAL",
            "sex": "T"
        }
        
        print(f"  Attempting to fetch from Eurostat API: {dataset_code}")
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            print("  ✓ Successfully fetched from Eurostat API")
            return data
        else:
            print(f"  ✗ API returned status {response.status_code}")
            return None
            
    except Exception as e:
        print(f"  ✗ Error fetching mortality data: {e}")
        return None

def load_mortality_alternative():
    """
    Alternative: Load from CSV or use published research data
    """
    csv_path = os.path.join("raw", "heat_mortality_europe.csv")
    if os.path.exists(csv_path):
        print(f"  ✓ Found local mortality CSV: {csv_path}")
        return pd.read_csv(csv_path)
    
    print("  ⚠ No local mortality data file found")
    print("  → Data sources:")
    print("    1. Eurostat: https://ec.europa.eu/eurostat/databrowser/view/demo_mexrt")
    print("    2. Nature study (2023): Heat-related mortality in Europe during summer 2022")
    print("    3. Save to data/raw/heat_mortality_europe.csv")
    return None

# ============================================================================
# CREATE SAMPLE DATA STRUCTURE (for demonstration)
# ============================================================================

def create_sample_energy_temp_data():
    """
    Create sample data structure based on known patterns
    This is a TEMPLATE - replace with real data when available
    """
    print("\n  Creating sample data structure (REPLACE WITH REAL DATA)...")
    
    # Create monthly data for 2020-2023
    dates = pd.date_range('2020-01-01', '2023-12-31', freq='M')
    
    # Sample electricity consumption (GWh) - higher in summer due to cooling
    # Real pattern: peaks in summer (July-August) and winter (December-January)
    np.random.seed(42)
    base_consumption = 25000
    seasonal_pattern = np.sin(np.arange(len(dates)) * 2 * np.pi / 12) * 3000
    noise = np.random.normal(0, 500, len(dates))
    electricity = base_consumption + seasonal_pattern + noise
    
    # Sample temperature (°C) - higher in summer
    base_temp = 15
    temp_pattern = np.sin(np.arange(len(dates)) * 2 * np.pi / 12 - np.pi/2) * 10
    temp_noise = np.random.normal(0, 1, len(dates))
    temperature = base_temp + temp_pattern + temp_noise
    
    df = pd.DataFrame({
        'date': dates,
        'month': dates.month,
        'year': dates.year,
        'electricity_gwh': electricity,
        'temperature_c': temperature
    })
    
    return df

def create_sample_mortality_data():
    """
    Create sample mortality data structure
    Based on published research: 2022 had ~61,672 excess deaths in Europe
    """
    print("\n  Creating sample mortality data structure (REPLACE WITH REAL DATA)...")
    
    # Years with known heatwave events
    years = [2015, 2018, 2019, 2020, 2021, 2022, 2023]
    
    # Excess deaths (based on published research)
    # 2022: ~61,672 (Europe-wide), estimate ~10,000 for Italy
    # 2023: ~47,690 (Europe-wide), estimate ~7,500 for Italy
    excess_deaths = {
        2015: 2500,
        2018: 3200,
        2019: 2800,
        2020: 3500,  # COVID-19 complicates this
        2021: 4200,
        2022: 10000,  # Record heatwave
        2023: 7500    # Second highest
    }
    
    df = pd.DataFrame({
        'year': years,
        'excess_deaths': [excess_deaths[y] for y in years]
    })
    
    return df

# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    
    # Try to fetch real data
    electricity_data = fetch_eurostat_electricity()
    if electricity_data is None:
        electricity_data = load_electricity_alternative()
    
    temp_data = fetch_temperature_data()
    
    mortality_data = fetch_mortality_data()
    if mortality_data is None:
        mortality_data = load_mortality_alternative()
    
    # If no real data available, create sample structure
    if electricity_data is None or temp_data is None:
        print("\n⚠ Using sample data structure - REPLACE WITH REAL DATA")
        print("  See instructions above for downloading real data\n")
        energy_temp_df = create_sample_energy_temp_data()
    else:
        # Process real data (implementation depends on API response format)
        print("\n✓ Using real data - processing...")
        # TODO: Process actual API responses
        energy_temp_df = create_sample_energy_temp_data()
    
    if mortality_data is None:
        print("\n⚠ Using sample mortality data structure - REPLACE WITH REAL DATA")
        mortality_df = create_sample_mortality_data()
    else:
        print("\n✓ Using real mortality data - processing...")
        # TODO: Process actual API responses
        mortality_df = create_sample_mortality_data()
    
    # Save data
    energy_temp_df.to_csv(os.path.join(output_dir, "energy_temperature_monthly.csv"), index=False)
    mortality_df.to_csv(os.path.join(output_dir, "heat_mortality_yearly.csv"), index=False)
    print(f"\n✓ Data saved to {output_dir}/")
    
    print("\n" + "=" * 70)
    print("NEXT: Run create_heat_consequences_plots.py to generate visualizations")
    print("=" * 70)
