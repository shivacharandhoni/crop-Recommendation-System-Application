from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from flask import Flask, jsonify, request

from utils.recommendations import CROP_REQUIREMENTS, recommend_crop, recommend_fertilizer

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
CROPS = list(CROP_REQUIREMENTS)
SEASONS = ["Kharif", "Rabi", "Whole Year", "Zaid"]
SOIL_TYPES = ["Clay", "Loam", "Sandy Loam", "Black Soil", "Red Soil", "Alluvial"]

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
WEATHER_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}


@app.after_request
def configure_api_cors(response):
    """Allow the separately hosted GitHub Pages frontend to call this API."""
    allowed_origins = {
        origin.strip().rstrip("/")
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    }
    origin = request.headers.get("Origin", "").rstrip("/")
    if origin and origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers.add("Vary", "Origin")
    return response

try:
    PREPROCESSOR = joblib.load(MODEL_DIR / "preprocessor.joblib")
    YIELD_MODEL = joblib.load(MODEL_DIR / "random_forest" / "rf_model.joblib")
    MODEL_ERROR: str | None = None
except Exception as exc:  # Report a clear readiness error instead of crashing imports.
    PREPROCESSOR = None
    YIELD_MODEL = None
    MODEL_ERROR = f"Could not load the bundled yield model: {exc}"

try:
    METRICS: dict[str, Any] = json.loads((MODEL_DIR / "metrics.json").read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    METRICS = {}


def _number(data: dict[str, Any], key: str, default: float, minimum: float, maximum: float) -> float:
    value = data.get(key, default)
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be a number") from None
    if not np.isfinite(number) or not minimum <= number <= maximum:
        raise ValueError(f"{key} must be between {minimum:g} and {maximum:g}")
    return number


def _input_data(data: dict[str, Any], crop: str | None = None) -> dict[str, Any]:
    selected_crop = crop or str(data.get("crop", "Rice"))
    if selected_crop not in CROPS:
        raise ValueError(f"crop must be one of: {', '.join(CROPS)}")
    season = str(data.get("season", "Kharif"))
    if season not in SEASONS:
        raise ValueError(f"season must be one of: {', '.join(SEASONS)}")
    soil_type = str(data.get("soil_type", "Loam"))
    if soil_type not in SOIL_TYPES:
        raise ValueError(f"soil_type must be one of: {', '.join(SOIL_TYPES)}")

    return {
        "state": str(data.get("state", "Telangana"))[:80],
        "district": str(data.get("district", "Hyderabad"))[:80],
        "crop": selected_crop,
        "season": season,
        "soil_type": soil_type,
        "ph": _number(data, "ph", 6.5, 0, 14),
        "nitrogen": _number(data, "nitrogen", 100, 0, 500),
        "phosphorus": _number(data, "phosphorus", 50, 0, 500),
        "potassium": _number(data, "potassium", 40, 0, 500),
        "temperature": _number(data, "temperature", 25, -10, 60),
        "rainfall": _number(data, "rainfall", 800, 0, 10000),
        "humidity": _number(data, "humidity", 65, 0, 100),
        "area": _number(data, "area", 1, 0.01, 100000),
        "previous_yield": _number(data, "previous_yield", 0, 0, 1000),
    }


def _predict_yield(values: dict[str, Any]) -> float:
    if PREPROCESSOR is None or YIELD_MODEL is None:
        raise RuntimeError(MODEL_ERROR or "Yield model is not available")
    matrix, _ = PREPROCESSOR.transform_single(values)
    prediction = float(YIELD_MODEL.predict(matrix)[0])
    if not np.isfinite(prediction):
        raise RuntimeError("The model returned an invalid yield estimate")
    return max(0.0, prediction)


def _reasons_for_crop(crop: str, values: dict[str, Any]) -> list[str]:
    requirements = CROP_REQUIREMENTS[crop]
    checks = [
        ("ph", "Soil pH", "ph"),
        ("nitrogen", "Nitrogen", "n"),
        ("temperature", "Temperature", "temp"),
        ("rainfall", "Rainfall", "rain"),
    ]
    reasons = []
    for value_key, label, requirement_key in checks:
        low, high = requirements[requirement_key]
        value = values[value_key]
        if low <= value <= high:
            unit = "°C" if value_key == "temperature" else " mm" if value_key == "rainfall" else ""
            reasons.append(f"{label} ({value:g}{unit}) is within this crop's preferred range ({low:g}–{high:g}{unit})")
    if values["season"] in requirements["seasons"]:
        reasons.append(f"{values['season']} is a recommended growing season for {crop}")
    if not reasons:
        reasons.append("The crop ranks highest after combining its growing-condition fit and estimated yield")
    return reasons[:3]


def _factor_explanation(crop: str, values: dict[str, Any]) -> dict[str, Any]:
    """Expose the same rule factors used by recommend_crop; scores are heuristics, not probabilities."""
    req = CROP_REQUIREMENTS[crop]
    ph_min, ph_max = req["ph"]
    n_min, n_max = req["n"]
    t_min, t_max = req["temp"]
    r_min, r_max = req["rain"]
    ph_score = 100 if ph_min <= values["ph"] <= ph_max else max(30, 100 - min(abs(values["ph"] - ph_min), abs(values["ph"] - ph_max)) * 25)
    n_score = 100 if n_min <= values["nitrogen"] <= n_max else max(40, 100 - abs(values["nitrogen"] - (n_min + n_max) / 2) * 0.4)
    t_score = 100 if t_min <= values["temperature"] <= t_max else max(30, 100 - abs(values["temperature"] - (t_min + t_max) / 2) * 3)
    rain_score = 100 if r_min <= values["rainfall"] <= r_max else max(30, 100 - abs(values["rainfall"] - (r_min + r_max) / 2) * 0.05)
    season_score = 100 if values["season"] in req["seasons"] else 50
    return {
        "rule_factors": {
            "ph": round(float(ph_score), 1), "nitrogen": round(float(n_score), 1),
            "temperature": round(float(t_score), 1), "rainfall": round(float(rain_score), 1),
            "season": round(float(season_score), 1),
        },
        "rule_inputs_used": ["pH", "nitrogen", "temperature", "rainfall", "season"],
        "rule_inputs_not_used": ["phosphorus", "potassium", "humidity", "soil_type"],
        "model_inputs_used": ["state", "district", "candidate crop", "season", "soil type", "pH", "nitrogen", "phosphorus", "potassium", "temperature", "rainfall", "humidity", "area", "previous yield"],
        "notice": "Factor values are heuristic scores, not probabilities. Yield estimates use generated training data and are not field validated.",
    }


def _json_error(message: str, status: int):
    return jsonify({"error": message}), status


@app.get("/api/health")
def health():
    ready = MODEL_ERROR is None
    return jsonify({"status": "ok" if ready else "degraded", "model_ready": ready}), (200 if ready else 503)


@app.get("/api/options")
def options():
    return jsonify({"crops": CROPS, "seasons": SEASONS, "soil_types": SOIL_TYPES, "metrics": METRICS})


def _open_meteo_json(url: str) -> dict[str, Any]:
    request_obj = urllib.request.Request(url, headers={"User-Agent": "CropRecommendationSystem/1.0"})
    with urllib.request.urlopen(request_obj, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


@app.get("/api/weather")
def weather():
    """Fetch a short Open-Meteo forecast; no API secret is needed for non-commercial use."""
    try:
        lat_raw, lon_raw = request.args.get("latitude"), request.args.get("longitude")
        location_label = request.args.get("location", "").strip()[:120]
        country_code = request.args.get("country_code", "").strip().upper()[:2]
        if lat_raw is not None or lon_raw is not None:
            if lat_raw is None or lon_raw is None:
                return _json_error("Provide both latitude and longitude.", 400)
            latitude, longitude = float(lat_raw), float(lon_raw)
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                return _json_error("Coordinates are outside the valid range.", 400)
        else:
            if len(location_label) < 2:
                return _json_error("Enter a town or district, or choose device location.", 400)
            query = {"name": location_label, "count": 1, "language": "en", "format": "json"}
            if country_code:
                query["countryCode"] = country_code
            geocode_url = "https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode(query)
            matches = _open_meteo_json(geocode_url).get("results", [])
            if not matches:
                return _json_error("No matching location was found. Check the spelling or enter coordinates.", 404)
            place = matches[0]
            latitude, longitude = float(place["latitude"]), float(place["longitude"])
            location_label = ", ".join(x for x in [place.get("name"), place.get("admin1"), place.get("country")] if x)

        cache_key = f"{latitude:.3f},{longitude:.3f}"
        now = datetime.now(timezone.utc).timestamp()
        cached = WEATHER_CACHE.get(cache_key)
        if cached and now - cached[0] < 600:
            return jsonify({**cached[1], "cache_hit": True})
        params = {
            "latitude": latitude, "longitude": longitude,
            "daily": "temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,weather_code",
            "forecast_days": 5, "timezone": "auto", "temperature_unit": "celsius",
        }
        forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
        data = _open_meteo_json(forecast_url)
        daily = data.get("daily", {})
        days = []
        for index, date in enumerate(daily.get("time", [])):
            probability = daily.get("precipitation_probability_max", [None] * len(daily["time"]))[index]
            days.append({
                "date": date,
                "minC": daily.get("temperature_2m_min", [None] * len(daily["time"]))[index],
                "maxC": daily.get("temperature_2m_max", [None] * len(daily["time"]))[index],
                "precipitationMm": daily.get("precipitation_sum", [0] * len(daily["time"]))[index] or 0,
                "precipitationProbability": probability,
                "weatherCode": daily.get("weather_code", [0] * len(daily["time"]))[index] or 0,
            })
        result = {
            "location": location_label or "Selected coordinates",
            "latitude": latitude, "longitude": longitude,
            "timezone": data.get("timezone", "auto"), "days": days,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "source": "Open-Meteo Forecast API; location search uses Open-Meteo Geocoding API",
            "sourceUrl": "https://open-meteo.com/en/docs",
            "cache_hit": False,
        }
        WEATHER_CACHE[cache_key] = (now, result)
        return jsonify(result)
    except (TypeError, ValueError):
        return _json_error("Coordinates must be valid numbers.", 400)
    except urllib.error.HTTPError as exc:
        app.logger.warning("Open-Meteo returned HTTP %s", exc.code)
        return _json_error("Weather provider is temporarily unavailable.", 502)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        app.logger.warning("Weather request failed: %s", exc)
        return _json_error("Could not reach the weather provider. Try again later.", 502)


@app.post("/api/recommendations")
def recommendations():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _json_error("Send the farm details as a JSON object.", 400)
    try:
        values = _input_data(payload)
        rule_result = recommend_crop(
            values["soil_type"], values["nitrogen"], values["phosphorus"], values["potassium"],
            values["ph"], values["temperature"], values["rainfall"], values["humidity"], values["season"],
        )
        scored = []
        for crop in CROPS:
            candidate = {**values, "crop": crop}
            predicted_yield = _predict_yield(candidate)
            rule_score = next((item["score"] for item in rule_result["all_recommendations"] if item["crop"] == crop), 0)
            scored.append({"crop": crop, "predicted_yield": round(predicted_yield, 2), "suitability_score": rule_score, "explanation": _factor_explanation(crop, values)})

        yields = [item["predicted_yield"] for item in scored]
        low, high = min(yields), max(yields)
        for item in scored:
            yield_score = 70 if high == low else 100 * (item["predicted_yield"] - low) / (high - low)
            item["score"] = round(0.65 * item["suitability_score"] + 0.35 * yield_score, 1)
        scored.sort(key=lambda item: item["score"], reverse=True)

        chosen = scored[0]["crop"]
        fertilizer = recommend_fertilizer(
            chosen, values["nitrogen"], values["phosphorus"], values["potassium"], values["ph"], values["soil_type"]
        )
        return jsonify({
            "recommended_crop": chosen,
            "recommendations": scored[:5],
            "reasons": _reasons_for_crop(chosen, values),
            "fertilizer": fertilizer,
            "model": "Random Forest yield estimate + agronomic suitability ranking",
        })
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        app.logger.exception("Recommendation request failed")
        return _json_error(str(exc), 503)


@app.post("/api/yield")
def yield_prediction():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _json_error("Send the farm details as a JSON object.", 400)
    try:
        values = _input_data(payload)
        per_hectare = _predict_yield(values)
        return jsonify({
            "crop": values["crop"],
            "yield_per_hectare": round(per_hectare, 2),
            "estimated_total_yield": round(per_hectare * values["area"], 2),
            "area_hectares": values["area"],
            "unit": "tons/ha",
            "model": "Random Forest",
        })
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        app.logger.exception("Yield prediction request failed")
        return _json_error(str(exc), 503)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5050")), debug=False)
