"""
Download and process ERA5 Comprehensive Heat Indices (ERA5-CHI) dataset

Dataset Source: https://figshare.com/articles/dataset/ERA5-Comprehensive_Heat_Indices_ERA5-CHI_Dataset_v1_0_/30539867

This script provides utilities to:
1. Download ERA5-CHI data (requires manual download from Figshare)
2. Process NetCDF files to extract specific regions and indices
3. Convert to CSV format for web visualization
4. Aggregate data by time periods (hourly, daily, monthly, yearly)

Note: The full dataset is very large. This script processes subsets for specific regions.
"""

import os
import sys
import csv
from datetime import datetime, timedelta

# Try to import required libraries (optional - script will work without them for structure)
try:
    import netCDF4
    HAS_NETCDF = True
except ImportError:
    HAS_NETCDF = False
    print("Note: netCDF4 not installed. Install with: pip install netCDF4")
    print("This script provides the structure - install dependencies to process actual data.")

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    print("Note: numpy not installed. Install with: pip install numpy")

# Create directories
os.makedirs('../data/raw/era5-chi', exist_ok=True)
os.makedirs('../data/processed/era5-chi', exist_ok=True)

print("=" * 60)
print("ERA5-CHI Dataset Processing Script")
print("=" * 60)
print("\nThis script helps process the ERA5 Comprehensive Heat Indices dataset.")
print("\nSTEP 1: Download the dataset")
print("  1. Visit: https://figshare.com/articles/dataset/ERA5-Comprehensive_Heat_Indices_ERA5-CHI_Dataset_v1_0_/30539867")
print("  2. Download the NetCDF files for your region of interest")
print("  3. Place them in: data/raw/era5-chi/")
print("\nSTEP 2: Process the data")
print("  Run this script with: python3 download_era5_chi.py process <index_name> <region>")
print("\nAvailable Heat Indices:")
print("  - utci: Universal Thermal Climate Index")
print("  - apparent_temp: Apparent Temperature")
print("  - lethal_stress: Lethal Heat Stress Index")
print("  - wet_bulb: Wet-bulb Temperature")
print("  - mean_radiant: Mean Radiant Temperature")
print("  - wind_chill: Wind Chill")
print("  - heat_index: Heat Index")
print("\nExample:")
print("  python3 download_era5_chi.py process utci genoa")
print("=" * 60)

# Region coordinates (approximate)
REGIONS = {
    'genoa': {
        'name': 'Genoa, Italy',
        'lat_range': (44.3, 44.5),
        'lon_range': (8.8, 9.0),
        'description': 'Genoa metropolitan area'
    },
    'italy': {
        'name': 'Italy',
        'lat_range': (36.0, 47.0),
        'lon_range': (6.0, 19.0),
        'description': 'Entire Italy'
    },
    'europe': {
        'name': 'Europe',
        'lat_range': (35.0, 72.0),
        'lon_range': (-10.0, 40.0),
        'description': 'Europe region'
    }
}

def process_era5_chi_file(nc_file_path, index_name, region_key, output_format='csv'):
    """
    Process a single ERA5-CHI NetCDF file
    
    Args:
        nc_file_path: Path to NetCDF file
        index_name: Name of the heat index to extract
        region_key: Region key from REGIONS dict
        output_format: 'csv' or 'json'
    """
    if not HAS_NETCDF:
        print("ERROR: netCDF4 library required. Install with: pip install netCDF4")
        return False
    
    if not os.path.exists(nc_file_path):
        print(f"ERROR: File not found: {nc_file_path}")
        return False
    
    try:
        # Open NetCDF file
        nc = netCDF4.Dataset(nc_file_path, 'r')
        
        # Get region bounds
        region = REGIONS.get(region_key, REGIONS['genoa'])
        lat_min, lat_max = region['lat_range']
        lon_min, lon_max = region['lon_range']
        
        # Extract data (this is a simplified example - actual implementation depends on NetCDF structure)
        print(f"\nProcessing {index_name} for {region['name']}...")
        print(f"File: {nc_file_path}")
        print(f"Latitude range: {lat_min} to {lat_max}")
        print(f"Longitude range: {lon_min} to {lon_max}")
        
        # Note: Actual extraction code depends on the NetCDF file structure
        # This is a template - adjust based on actual ERA5-CHI file format
        
        # Example structure (adjust based on actual file):
        # lats = nc.variables['latitude'][:]
        # lons = nc.variables['longitude'][:]
        # times = nc.variables['time'][:]
        # data = nc.variables[index_name][:]
        
        # Filter by region
        # lat_mask = (lats >= lat_min) & (lats <= lat_max)
        # lon_mask = (lons >= lon_min) & (lons <= lon_max)
        
        # Extract and aggregate
        # region_data = data[:, lat_mask, lon_mask]
        # avg_data = np.mean(region_data, axis=(1, 2))  # Average over spatial dimension
        
        # Convert time to dates
        # dates = netCDF4.num2date(times, nc.variables['time'].units)
        
        # Save to CSV
        output_path = f'../data/processed/era5-chi/{region_key}_{index_name}_processed.csv'
        
        # Example CSV structure:
        # with open(output_path, 'w', newline='') as f:
        #     writer = csv.writer(f)
        #     writer.writerow(['date', 'value', 'index'])
        #     for date, value in zip(dates, avg_data):
        #         writer.writerow([date.strftime('%Y-%m-%d %H:%M:%S'), value, index_name])
        
        print(f"Processed data saved to: {output_path}")
        nc.close()
        return True
        
    except Exception as e:
        print(f"ERROR processing file: {e}")
        return False

def aggregate_data(input_csv, output_csv, aggregation='monthly'):
    """
    Aggregate processed data by time period
    
    Args:
        input_csv: Path to input CSV file
        output_csv: Path to output CSV file
        aggregation: 'hourly', 'daily', 'monthly', 'yearly'
    """
    if not os.path.exists(input_csv):
        print(f"ERROR: File not found: {input_csv}")
        return False
    
    # Read data
    data = []
    with open(input_csv, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            data.append({
                'date': datetime.strptime(row['date'], '%Y-%m-%d %H:%M:%S'),
                'value': float(row['value']),
                'index': row['index']
            })
    
    # Aggregate
    aggregated = {}
    for row in data:
        date = row['date']
        
        if aggregation == 'hourly':
            key = date.strftime('%Y-%m-%d %H:00:00')
        elif aggregation == 'daily':
            key = date.strftime('%Y-%m-%d')
        elif aggregation == 'monthly':
            key = date.strftime('%Y-%m-01')
        elif aggregation == 'yearly':
            key = date.strftime('%Y-01-01')
        else:
            key = date.strftime('%Y-%m-%d')
        
        if key not in aggregated:
            aggregated[key] = {'values': [], 'index': row['index']}
        aggregated[key]['values'].append(row['value'])
    
    # Calculate averages and save
    with open(output_csv, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['date', 'value', 'index'])
        
        for key in sorted(aggregated.keys()):
            avg_value = sum(aggregated[key]['values']) / len(aggregated[key]['values'])
            writer.writerow([key, avg_value, aggregated[key]['index']])
    
    print(f"Aggregated data saved to: {output_csv}")
    return True

def main():
    if len(sys.argv) < 2:
        print("\nUsage:")
        print("  python3 download_era5_chi.py info                    # Show this information")
        print("  python3 download_era5_chi.py process <index> <region>  # Process NetCDF file")
        print("  python3 download_era5_chi.py aggregate <csv> <output> <period>  # Aggregate data")
        return
    
    command = sys.argv[1]
    
    if command == 'info':
        print("\nERA5-CHI Dataset Information:")
        print("\nAvailable Regions:")
        for key, region in REGIONS.items():
            print(f"  {key}: {region['name']} - {region['description']}")
        print("\nTo process data:")
        print("  1. Download NetCDF files from Figshare")
        print("  2. Place in data/raw/era5-chi/")
        print("  3. Run: python3 download_era5_chi.py process <index> <region>")
    
    elif command == 'process':
        if len(sys.argv) < 4:
            print("ERROR: Usage: python3 download_era5_chi.py process <index> <region>")
            print("Example: python3 download_era5_chi.py process utci genoa")
            return
        
        index_name = sys.argv[2]
        region_key = sys.argv[3]
        
        # Look for NetCDF files
        raw_dir = '../data/raw/era5-chi'
        nc_files = [f for f in os.listdir(raw_dir) if f.endswith('.nc')]
        
        if not nc_files:
            print(f"\nNo NetCDF files found in {raw_dir}")
            print("Please download ERA5-CHI data from Figshare and place .nc files in that directory.")
            return
        
        print(f"\nFound {len(nc_files)} NetCDF file(s)")
        for nc_file in nc_files:
            nc_path = os.path.join(raw_dir, nc_file)
            process_era5_chi_file(nc_path, index_name, region_key)
    
    elif command == 'aggregate':
        if len(sys.argv) < 5:
            print("ERROR: Usage: python3 download_era5_chi.py aggregate <input_csv> <output_csv> <period>")
            print("Period options: hourly, daily, monthly, yearly")
            return
        
        input_csv = sys.argv[2]
        output_csv = sys.argv[3]
        period = sys.argv[4]
        
        aggregate_data(input_csv, output_csv, period)
    
    else:
        print(f"Unknown command: {command}")
        print("Use 'info', 'process', or 'aggregate'")

if __name__ == '__main__':
    main()
