"""
Calculate heat indices from existing temperature data
Instead of downloading terabytes of ERA5-CHI data, we calculate heat indices
from temperature data you already have.

This script:
1. Reads your existing temperature/meteorological data
2. Calculates various heat indices using standard formulas
3. Saves as CSV for visualization

Heat Indices Calculated:
- Apparent Temperature (AT) - from temperature and humidity
- Heat Index (HI) - from temperature and humidity  
- UTCI approximation - simplified version
- Wet-bulb temperature - from temperature and humidity
"""

import csv
import math
from datetime import datetime

def calculate_apparent_temperature(temp_c, humidity_percent):
    """
    Calculate Apparent Temperature (AT) - "feels like" temperature
    Formula based on Steadman's model
    
    Args:
        temp_c: Temperature in Celsius
        humidity_percent: Relative humidity (0-100)
    
    Returns:
        Apparent temperature in Celsius
    """
    # Convert to Kelvin for calculations
    temp_k = temp_c + 273.15
    
    # Calculate vapor pressure
    e = (humidity_percent / 100.0) * 6.105 * math.exp((17.27 * temp_c) / (237.7 + temp_c))
    
    # Apparent temperature formula (simplified Steadman)
    at = temp_c + 0.33 * e - 0.70 * (temp_c * 0.1) - 4.0
    
    return round(at, 2)

def calculate_heat_index(temp_f, humidity_percent):
    """
    Calculate Heat Index (HI) - used by US National Weather Service
    Only valid for temperatures above 80°F (26.7°C) and humidity > 40%
    
    Args:
        temp_f: Temperature in Fahrenheit
        humidity_percent: Relative humidity (0-100)
    
    Returns:
        Heat index in Fahrenheit (convert to Celsius if needed)
    """
    if temp_f < 80 or humidity_percent < 40:
        return temp_f  # Not applicable, return original temp
    
    # Heat Index formula (Rothfusz equation)
    hi = (-42.379 + 
          2.04901523 * temp_f +
          10.14333127 * humidity_percent -
          0.22475541 * temp_f * humidity_percent -
          6.83783e-3 * temp_f * temp_f -
          5.481717e-2 * humidity_percent * humidity_percent +
          1.22874e-3 * temp_f * temp_f * humidity_percent +
          8.5282e-4 * temp_f * humidity_percent * humidity_percent -
          1.99e-6 * temp_f * temp_f * humidity_percent * humidity_percent)
    
    return round(hi, 2)

def calculate_wet_bulb_temperature(temp_c, humidity_percent, pressure_hpa=1013.25):
    """
    Calculate Wet-bulb temperature approximation
    Uses Stull's method (2011) - accurate to within 1°C
    
    Args:
        temp_c: Temperature in Celsius
        humidity_percent: Relative humidity (0-100)
        pressure_hpa: Atmospheric pressure in hPa (default sea level)
    
    Returns:
        Wet-bulb temperature in Celsius
    """
    # Convert to Kelvin
    temp_k = temp_c + 273.15
    
    # Calculate vapor pressure
    e_sat = 6.112 * math.exp((17.67 * temp_c) / (temp_c + 243.5))
    e = (humidity_percent / 100.0) * e_sat
    
    # Stull's approximation
    twb = temp_c * math.atan(0.151977 * math.sqrt(humidity_percent + 8.313659)) + \
          math.atan(temp_c + humidity_percent) - \
          math.atan(humidity_percent - 1.676331) + \
          0.00391838 * (humidity_percent ** 1.5) * math.atan(0.023101 * humidity_percent) - 4.686035
    
    return round(twb, 2)

def calculate_utci_approximation(temp_c, humidity_percent, wind_speed_ms=2.0, solar_rad=0):
    """
    Simplified UTCI approximation
    Full UTCI requires complex calculations - this is a simplified version
    For accurate UTCI, use the full Fiala model
    
    Args:
        temp_c: Temperature in Celsius
        humidity_percent: Relative humidity (0-100)
        wind_speed_ms: Wind speed in m/s (default 2.0 = light breeze)
        solar_rad: Solar radiation in W/m² (default 0 = no direct sun)
    
    Returns:
        Approximate UTCI in Celsius
    """
    # Simplified UTCI approximation
    # Full UTCI would require: mean radiant temp, wind, humidity, activity level
    
    # Base UTCI from temperature
    utci = temp_c
    
    # Adjust for humidity (high humidity increases heat stress)
    if temp_c > 20:
        humidity_factor = (humidity_percent - 50) * 0.1
        utci += humidity_factor
    
    # Adjust for wind (wind reduces heat stress in hot conditions)
    if temp_c > 25:
        wind_factor = -wind_speed_ms * 0.5
        utci += wind_factor
    
    # Adjust for solar radiation
    solar_factor = solar_rad * 0.01
    utci += solar_factor
    
    return round(utci, 2)

def process_temperature_data(input_csv, output_csv):
    """
    Process temperature data and calculate heat indices
    
    Args:
        input_csv: Path to input CSV with temperature data
        output_csv: Path to output CSV with calculated indices
    """
    # Read existing data (assuming it has temperature and optionally humidity)
    data = []
    
    try:
        with open(input_csv, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                data.append(row)
    except FileNotFoundError:
        print(f"Input file not found: {input_csv}")
        print("Creating sample data from energy consumption dataset...")
        # Fallback: use energy data which has temperature
        try:
            with open('../data/processed/energy/italy_energy_monthly.csv', 'r') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    data.append({
                        'date': row['date'],
                        'temperature': row['avg_temperature'],
                        'humidity': '65'  # Default humidity if not available
                    })
        except:
            print("Could not find temperature data. Please provide a CSV with 'date' and 'temperature' columns.")
            return
    
    # Calculate heat indices
    results = []
    
    for row in data:
        try:
            temp_c = float(row.get('temperature', row.get('avg_temperature', 20)))
            humidity = float(row.get('humidity', row.get('humidity_percent', 65)))  # Default 65%
            
            # Calculate indices
            at = calculate_apparent_temperature(temp_c, humidity)
            temp_f = (temp_c * 9/5) + 32
            hi_f = calculate_heat_index(temp_f, humidity)
            hi_c = (hi_f - 32) * 5/9
            twb = calculate_wet_bulb_temperature(temp_c, humidity)
            utci = calculate_utci_approximation(temp_c, humidity)
            
            results.append({
                'date': row.get('date', ''),
                'temperature_c': round(temp_c, 2),
                'humidity_percent': round(humidity, 1),
                'apparent_temperature': at,
                'heat_index': round(hi_c, 2),
                'wet_bulb_temperature': twb,
                'utci_approximation': utci
            })
        except (ValueError, KeyError) as e:
            print(f"Error processing row: {e}")
            continue
    
    # Save results
    with open(output_csv, 'w', newline='') as f:
        if results:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
            print(f"Calculated heat indices for {len(results)} data points")
            print(f"Saved to: {output_csv}")
        else:
            print("No data to save")

if __name__ == '__main__':
    import sys
    
    # Default: process energy data (which has temperature)
    input_file = '../data/processed/energy/italy_energy_monthly.csv'
    output_file = '../data/processed/era5-chi/calculated_heat_indices_monthly.csv'
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    print("Calculating heat indices from existing temperature data...")
    print(f"Input: {input_file}")
    print(f"Output: {output_file}")
    print("\nThis avoids downloading terabytes of ERA5-CHI data!")
    print("=" * 60)
    
    process_temperature_data(input_file, output_file)
