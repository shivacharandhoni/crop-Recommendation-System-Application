import os
import numpy as np
import pandas as pd

def generate_multisource_agricultural_dataset(num_samples=2500, random_state=42):
    np.random.seed(random_state)

    states_districts = {
        'Punjab': ['Ludhiana', 'Patiala', 'Amritsar', 'Jalandhar', 'Bhatinda'],
        'Haryana': ['Karnal', 'Hisar', 'Ambala', 'Sirsa', 'Rohtak'],
        'Uttar Pradesh': ['Varanasi', 'Kanpur', 'Lucknow', 'Agra', 'Meerut'],
        'Maharashtra': ['Nashik', 'Pune', 'Nagpur', 'Aurangabad', 'Solapur'],
        'Madhya Pradesh': ['Indore', 'Bhopal', 'Ujjain', 'Gwalior', 'Jabalpur'],
        'Tamil Nadu': ['Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tanjore'],
        'Karnataka': ['Mandya', 'Belagavi', 'Davangere', 'Mysuru', 'Dharwad'],
        'Gujarat': ['Rajkot', 'Ahmedabad', 'Surat', 'Vadodara', 'Junagadh']
    }

    crops = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Pulses', 'Soyabean', 'Groundnut']

    seasons = ['Kharif', 'Rabi', 'Whole Year', 'Zaid']

    soil_types = ['Clay', 'Loam', 'Sandy Loam', 'Black Soil', 'Red Soil', 'Alluvial']

    data = []

    crop_base_yields = {
        'Rice': {'yield': 4.2, 'temp': (22, 35), 'rain': (1000, 2200), 'ph': (5.5, 7.2), 'n': 120, 'p': 60, 'k': 40},
        'Wheat': {'yield': 3.8, 'temp': (12, 25), 'rain': (450, 850), 'ph': (6.0, 7.5), 'n': 100, 'p': 50, 'k': 40},
        'Maize': {'yield': 3.2, 'temp': (18, 30), 'rain': (500, 1100), 'ph': (5.8, 7.0), 'n': 90, 'p': 40, 'k': 30},
        'Cotton': {'yield': 2.5, 'temp': (21, 35), 'rain': (600, 1200), 'ph': (6.0, 8.0), 'n': 80, 'p': 40, 'k': 40},
        'Sugarcane': {'yield': 65.0, 'temp': (20, 38), 'rain': (1200, 2500), 'ph': (6.0, 7.8), 'n': 200, 'p': 80, 'k': 100},
        'Pulses': {'yield': 1.6, 'temp': (15, 28), 'rain': (350, 750), 'ph': (6.0, 7.5), 'n': 30, 'p': 50, 'k': 30},
        'Soyabean': {'yield': 2.1, 'temp': (20, 32), 'rain': (600, 1000), 'ph': (6.0, 7.2), 'n': 40, 'p': 60, 'k': 40},
        'Groundnut': {'yield': 2.4, 'temp': (22, 33), 'rain': (500, 950), 'ph': (5.5, 7.0), 'n': 35, 'p': 50, 'k': 50}
    }

    for i in range(num_samples):
        state = np.random.choice(list(states_districts.keys()))
        district = np.random.choice(states_districts[state])
        crop = np.random.choice(crops)
        season = np.random.choice(seasons)
        soil_type = np.random.choice(soil_types)

        prof = crop_base_yields[crop]

        # Soil parameters
        ph = np.round(np.clip(np.random.normal(prof['ph'][0] + 0.7, 0.6), 4.5, 8.5), 2)
        n = np.round(np.clip(np.random.normal(prof['n'], prof['n'] * 0.25), 10, 280), 1)
        p = np.round(np.clip(np.random.normal(prof['p'], prof['p'] * 0.25), 10, 120), 1)
        k = np.round(np.clip(np.random.normal(prof['k'], prof['k'] * 0.25), 10, 140), 1)

        # Weather parameters
        temp = np.round(np.clip(np.random.normal((prof['temp'][0] + prof['temp'][1])/2, 4.0), 10, 42), 1)
        rain = np.round(np.clip(np.random.normal((prof['rain'][0] + prof['rain'][1])/2, 250.0), 200, 3000), 1)
        humidity = np.round(np.clip(np.random.normal(68.0, 14.0), 30, 95), 1)

        # Farm Area in Hectares
        area = np.round(np.random.uniform(0.5, 25.0), 2)

        # Calculate realistic crop yield using agronomic response equations
        base = prof['yield']

        # NPK suitability multiplier
        n_ratio = min(n / max(prof['n'], 1), 1.3)
        p_ratio = min(p / max(prof['p'], 1), 1.3)
        k_ratio = min(k / max(prof['k'], 1), 1.3)
        npk_factor = 0.5 * n_ratio + 0.3 * p_ratio + 0.2 * k_ratio

        # Temp penalty
        min_t, max_t = prof['temp']
        if min_t <= temp <= max_t:
            temp_factor = 1.0
        else:
            temp_factor = max(0.65, 1.0 - 0.04 * min(abs(temp - min_t), abs(temp - max_t)))

        # Rainfall penalty
        min_r, max_r = prof['rain']
        if min_r <= rain <= max_r:
            rain_factor = 1.0
        else:
            rain_factor = max(0.60, 1.0 - 0.0003 * min(abs(rain - min_r), abs(rain - max_r)))

        # pH penalty
        min_ph, max_ph = prof['ph']
        if min_ph <= ph <= max_ph:
            ph_factor = 1.0
        else:
            ph_factor = max(0.70, 1.0 - 0.12 * min(abs(ph - min_ph), abs(ph - max_ph)))

        noise = np.random.normal(0, 0.08 * base)
        yield_val = np.round(max(0.3, base * npk_factor * temp_factor * rain_factor * ph_factor + noise), 2)

        prev_yield = np.round(max(0.3, yield_val * np.random.uniform(0.85, 1.15)), 2)

        # Generate 4-quarter temporal sequence for weather (used by LSTM)
        # Represents 4 quarters/months of growing season weather
        temp_seq = [
            np.round(temp + np.random.normal(-2, 1), 1),
            np.round(temp + np.random.normal(1, 1), 1),
            np.round(temp + np.random.normal(2, 1), 1),
            np.round(temp + np.random.normal(-1, 1), 1)
        ]
        rain_seq = [
            np.round(rain * 0.2 + np.random.normal(0, 20), 1),
            np.round(rain * 0.4 + np.random.normal(0, 30), 1),
            np.round(rain * 0.3 + np.random.normal(0, 25), 1),
            np.round(rain * 0.1 + np.random.normal(0, 10), 1)
        ]

        data.append({
            'state': state,
            'district': district,
            'crop': crop,
            'season': season,
            'soil_type': soil_type,
            'ph': ph,
            'nitrogen': n,
            'phosphorus': p,
            'potassium': k,
            'temperature': temp,
            'rainfall': rain,
            'humidity': humidity,
            'area': area,
            'previous_yield': prev_yield,
            'temp_q1': temp_seq[0],
            'temp_q2': temp_seq[1],
            'temp_q3': temp_seq[2],
            'temp_q4': temp_seq[3],
            'rain_q1': max(0, rain_seq[0]),
            'rain_q2': max(0, rain_seq[1]),
            'rain_q3': max(0, rain_seq[2]),
            'rain_q4': max(0, rain_seq[3]),
            'yield': yield_val
        })

    df = pd.DataFrame(data)
    return df

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_dir = os.path.join(base_dir, 'data', 'raw')
    os.makedirs(raw_dir, exist_ok=True)

    file_path = os.path.join(raw_dir, 'multisource_agricultural_dataset.csv')
    df = generate_multisource_agricultural_dataset(num_samples=3000, random_state=42)
    df.to_csv(file_path, index=False)
    print(f"Dataset generated successfully at: {file_path}")
    print(f"Shape: {df.shape}")
    print("Sample Columns:", list(df.columns[:10]))
