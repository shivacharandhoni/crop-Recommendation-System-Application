import numpy as np

CROP_REQUIREMENTS = {
    'Rice': {'n': (100, 150), 'p': (40, 80), 'k': (30, 60), 'ph': (5.5, 7.5), 'temp': (20, 38), 'rain': (900, 2500), 'seasons': ['Kharif', 'Whole Year']},
    'Wheat': {'n': (80, 130), 'p': (35, 65), 'k': (30, 50), 'ph': (6.0, 7.8), 'temp': (10, 26), 'rain': (400, 900), 'seasons': ['Rabi']},
    'Maize': {'n': (75, 120), 'p': (30, 55), 'k': (25, 45), 'ph': (5.8, 7.2), 'temp': (18, 32), 'rain': (450, 1150), 'seasons': ['Kharif', 'Rabi', 'Zaid']},
    'Cotton': {'n': (70, 110), 'p': (30, 50), 'k': (30, 60), 'ph': (6.0, 8.2), 'temp': (20, 36), 'rain': (550, 1250), 'seasons': ['Kharif']},
    'Sugarcane': {'n': (160, 240), 'p': (60, 100), 'k': (80, 140), 'ph': (6.0, 8.0), 'temp': (20, 40), 'rain': (1100, 2800), 'seasons': ['Whole Year']},
    'Pulses': {'n': (20, 45), 'p': (40, 70), 'k': (20, 45), 'ph': (6.0, 7.8), 'temp': (15, 30), 'rain': (300, 800), 'seasons': ['Kharif', 'Rabi', 'Zaid']},
    'Soyabean': {'n': (30, 55), 'p': (50, 80), 'k': (30, 55), 'ph': (6.0, 7.5), 'temp': (18, 34), 'rain': (550, 1050), 'seasons': ['Kharif']},
    'Groundnut': {'n': (25, 50), 'p': (40, 65), 'k': (40, 70), 'ph': (5.5, 7.2), 'temp': (20, 35), 'rain': (450, 1000), 'seasons': ['Kharif', 'Zaid']}
}

def recommend_crop(soil_type, nitrogen, phosphorus, potassium, ph, temperature, rainfall, humidity, season):
    scores = {}
    reasons_dict = {}

    for crop, req in CROP_REQUIREMENTS.items():
        sub_scores = []
        reasons = []

        # pH score
        ph_min, ph_max = req['ph']
        if ph_min <= ph <= ph_max:
            sub_scores.append(100)
            reasons.append(f"Soil pH ({ph}) is optimal (range: {ph_min}-{ph_max})")
        else:
            diff = min(abs(ph - ph_min), abs(ph - ph_max))
            score = max(30, 100 - diff * 25)
            sub_scores.append(score)
            reasons.append(f"Soil pH ({ph}) differs slightly from ideal range ({ph_min}-{ph_max})")

        # NPK scores
        n_min, n_max = req['n']
        if n_min <= nitrogen <= n_max:
            sub_scores.append(100)
            reasons.append(f"Nitrogen level ({nitrogen} kg/ha) matches crop requirements")
        else:
            sub_scores.append(max(40, 100 - abs(nitrogen - (n_min + n_max)/2) * 0.4))

        # Temperature score
        t_min, t_max = req['temp']
        if t_min <= temperature <= t_max:
            sub_scores.append(100)
            reasons.append(f"Climate temperature ({temperature}°C) is highly suitable")
        else:
            sub_scores.append(max(30, 100 - abs(temperature - (t_min + t_max)/2) * 3))

        # Rainfall score
        r_min, r_max = req['rain']
        if r_min <= rainfall <= r_max:
            sub_scores.append(100)
            reasons.append(f"Annual/Seasonal rainfall ({rainfall} mm) satisfies water needs")
        else:
            sub_scores.append(max(30, 100 - abs(rainfall - (r_min + r_max)/2) * 0.05))

        # Season suitability
        if season in req['seasons']:
            sub_scores.append(100)
            reasons.append(f"Cultivation season '{season}' is recommended for {crop}")
        else:
            sub_scores.append(50)

        final_score = round(float(np.mean(sub_scores)), 1)
        scores[crop] = final_score
        reasons_dict[crop] = reasons

    ranked_crops = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    top_crop, top_score = ranked_crops[0]
    top_reasons = reasons_dict[top_crop]

    return {
        'recommended_crop': top_crop,
        'suitability_score': top_score,
        'reasons': top_reasons[:3],
        'all_recommendations': [{'crop': c, 'score': s} for c, s in ranked_crops]
    }

def recommend_fertilizer(crop, nitrogen, phosphorus, potassium, ph, soil_type):
    req = CROP_REQUIREMENTS.get(crop, CROP_REQUIREMENTS['Wheat'])

    target_n = (req['n'][0] + req['n'][1]) / 2.0
    target_p = (req['p'][0] + req['p'][1]) / 2.0
    target_k = (req['k'][0] + req['k'][1]) / 2.0

    n_diff = target_n - nitrogen
    p_diff = target_p - phosphorus
    k_diff = target_k - potassium

    suggestions = []

    if n_diff > 15:
        dose = round(n_diff / 0.46, 1) # Urea contains ~46% N
        suggestions.append(f"Apply Urea (~46% N) at ~{dose} kg/ha to compensate for Nitrogen deficit.")
    elif n_diff < -25:
        suggestions.append(f"Nitrogen level ({nitrogen} kg/ha) is high; reduce nitrogenous fertilizer to prevent lodging.")

    if p_diff > 10:
        dose = round(p_diff / 0.16, 1) # Single Super Phosphate (SSP) contains ~16% P2O5
        suggestions.append(f"Apply Single Super Phosphate (SSP ~16% P₂O₅) at ~{dose} kg/ha or DAP for Phosphorus deficiency.")
    elif p_diff < -20:
        suggestions.append(f"Phosphorus is sufficient ({phosphorus} kg/ha); avoid excess phosphatic applications.")

    if k_diff > 10:
        dose = round(k_diff / 0.60, 1) # Muriate of Potash (MOP) contains ~60% K2O
        suggestions.append(f"Apply Muriate of Potash (MOP ~60% K₂O) at ~{dose} kg/ha for Potassium enrichment.")
    elif k_diff < -20:
        suggestions.append(f"Potassium level ({potassium} kg/ha) is optimal; no immediate potash application needed.")

    if ph < 5.5:
        suggestions.append("Soil is acidic (pH < 5.5); apply agricultural lime (calcium carbonate) at 1-2 tonnes/ha to normalize pH.")
    elif ph > 7.8:
        suggestions.append("Soil is alkaline (pH > 7.8); apply gypsum or organic compost/sulfur to lower soil pH.")

    if not suggestions:
        suggestions.append("Soil nutrient profile (NPK & pH) is well-balanced for the selected crop. Maintain regular organic manure application.")

    explanation = (
        f"Nutrient analysis for {crop} (Target requirement: N={target_n} kg/ha, P={target_p} kg/ha, K={target_k} kg/ha). "
        "Suggestions are generated using standard agronomic nutrient balance principles as decision-support guidance."
    )

    return {
        'crop': crop,
        'fertilizer_summary': " | ".join(suggestions),
        'suggestions': suggestions,
        'explanation': explanation,
        'n_status': 'Optimal' if abs(n_diff) <= 15 else ('Deficient' if n_diff > 15 else 'Excessive'),
        'p_status': 'Optimal' if abs(p_diff) <= 10 else ('Deficient' if p_diff > 10 else 'Excessive'),
        'k_status': 'Optimal' if abs(k_diff) <= 10 else ('Deficient' if k_diff > 10 else 'Excessive')
    }
