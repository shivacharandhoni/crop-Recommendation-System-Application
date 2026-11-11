# Crop Recommendation System — Run Guide

Project credit: **Shivacharan Dhoni (`shivacharandhoni`)**

The React crop dashboard and floating chat run in the frontend. Crop recommendations and yield estimates are served by the Python model API. Disease scan uses the included Supabase Edge Function.

## Local development in VS Code

Use Node.js 20 or newer and Python 3.13 or newer. Keep the Python API and React development server running in two separate VS Code terminals. The Python requirements pin the versions needed by the supplied model artifacts.

### Terminal 1: start the model API

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main\ml_backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

The API listens on `http://localhost:5050`.

To reproduce the Random Forest training steps with the bundled dataset, see [the training guide](ml_backend/training/README.md). The core commands are:

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main\ml_backend
python training/preprocess.py
python training/train_rf.py
```

### Terminal 2: start the dashboard

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main
npm install
npm run dev
```

Open `http://localhost:8080`. Keep both terminals running. The Vite server forwards `/api` requests to the Python API.

If PowerShell blocks virtual-environment activation, open a new terminal and run the API directly with:

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main\ml_backend
python -m pip install -r requirements.txt
python app.py
```

## Run both services with Docker

Make sure Docker Desktop is running, then use one VS Code terminal:

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main
docker compose up --build -d
```

Open `http://localhost:8080`. The frontend and model API start together. The image names are `crop-recommendation-system:latest` and `crop-recommendation-ml:latest`.

Check status and logs:

```powershell
docker compose ps
docker compose logs -f
```

Stop the app from the same project folder:

```powershell
docker compose down
```

The images stay saved in Docker after stopping. Export the frontend image with:

```powershell
docker save -o crop-recommendation-system-images.tar crop-recommendation-system:latest crop-recommendation-ml:latest
```

## Supabase chat and disease scanning

The chat and disease scan use the existing Supabase functions. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` before a frontend build. These Vite values are delivered to the browser and must be public/publishable keys; never put a service-role key in the frontend.

The crop/yield archive does not contain a local plant disease model. The first project includes the `supabase/functions/crop-disease-detect` Edge Function, and the disease scan uses that function. Deploy/configure it in the Supabase project referenced by your `.env` for image analysis to work.

## About the predictions

The crop shortlist combines the supplied project's agronomic suitability scoring with Random Forest yield estimates for each crop. The yield forecast is a model estimate in tons per hectare. Results depend on the quality of farm inputs and should be reviewed with local agricultural guidance.

## Optional Supabase setup for chat, disease analysis, and farm sync

1. Copy `.env.example` to `.env` in the project root and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the Supabase dashboard. These are browser-visible publishable values. Never use a Supabase service-role key in `.env`, Docker build args, or frontend code.
2. For the new farm workspace sync only, apply `supabase/migrations/202611110001_farm_workspace_events.sql` to the project. With the Supabase CLI installed and linked, run `supabase db push` from the repository root.
3. In Supabase, enable anonymous sign-in under Authentication → Sign In / Providers. The farmer must opt in to sync in the app's Privacy controls. Anonymous sync is scoped to that browser and is not cross-device account recovery.
4. Restart `npm run dev`, or rebuild Docker with `docker compose up --build -d`, after changing `.env`.

The weather forecast needs no API key for non-commercial use. The server calls Open-Meteo Forecast and Geocoding APIs. Browser speech and notifications vary by device and permission; a task reminder can appear only while the app is open. Profile, advice, cost entries, services, and calendar tasks are stored locally in IndexedDB and remain available offline after the app shell has been cached. See README for forecast rules, data handling, service directory limits, language coverage, sync conflict behavior, and model limitations.
