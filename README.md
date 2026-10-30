# Crop Recommendation System

**Project credit:** Shivacharan Dhoni (`shivacharandhoni`)

Crop Recommendation System combines a crop-planning dashboard, crop-yield machine-learning model, fertilizer guidance, a crop-disease scan, and a compact agricultural chatbot.

## Features

- Dashboard that ranks eight crops using soil, season, and climate details
- Random Forest yield estimates for the crop shortlist
- Fertilizer starting guidance based on NPK and soil pH
- Crop image disease scan through the included Supabase Edge Function
- Floating agricultural chatbot
- Training dataset, preprocessing code, model training scripts, and saved model artifacts
- Docker Compose setup for the React frontend and Python prediction API

## Run and train

See [RUNNING.md](RUNNING.md) for local/Docker run steps and [ml_backend/training/README.md](ml_backend/training/README.md) for the dataset and model training workflow.

## Service endpoints

- Frontend: port `8080`
- Python model API: port `5050` during local development; proxied through the frontend in Docker
- `GET /api/health`: model service status
- `GET /api/options`: crop, season, soil, and evaluation metadata
- `POST /api/recommendations`: crop shortlist and fertilizer suggestions
- `POST /api/yield`: Random Forest yield estimate for the selected crop

Recommendations are decision support, not a guarantee of actual yield. Check results with local agronomic guidance and soil tests.