# Crop Recommendation System

**Project:** Shivacharan Dhoni (`shivacharandhoni`)

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

## Deploy the public GitHub Pages site

GitHub Pages only hosts the built frontend. It does not run the Python model/weather API in Docker Compose, so a public page needs a separate public API service. This repository includes [render.yaml](render.yaml) for a Docker deployment of the Python API on Render. Create a Render Blueprint from this repository and wait for the API service to finish deploying. Its health endpoint should return JSON at `https://<your-api-service>.onrender.com/api/health`.

In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add:

- `VITE_API_BASE_URL` = the API origin, for example `https://crop-recommendation-api.onrender.com` (no trailing slash)
- `VITE_SUPABASE_URL` = the Supabase project URL, if using the chatbot, disease function, or cloud sync
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the Supabase publishable/anon key, if using those Supabase functions

Then run the **Deploy Crop Recommendation System** workflow again (or push a commit to `main`). The API origin must be the one shown by the deployed Render service. The Render blueprint allows browser API requests only from `https://crop.shivacharandhoni.tech`; update `CORS_ALLOWED_ORIGINS` in `render.yaml` if the public frontend domain changes. Keep provider secrets such as model keys inside Supabase Edge Function secrets; never add service-role or model-provider keys to GitHub Actions variables prefixed with `VITE_`.

The crop recommendation, yield, and weather endpoints need the deployed Python API. Chat and disease image analysis additionally need the corresponding Supabase Edge Functions deployed and configured. Local Docker Compose continues to proxy `/api` internally and does not need `VITE_API_BASE_URL`.

## Service endpoints

- Frontend: port `8080`
- Python model API: port `5050` during local development; proxied through the frontend in Docker
- `GET /api/health`: model service status
- `GET /api/options`: crop, season, soil, and evaluation metadata
- `POST /api/recommendations`: crop shortlist and fertilizer suggestions
- `POST /api/yield`: Random Forest yield estimate for the selected crop

Recommendations are decision support, not a guarantee of actual yield. Check results with local agronomic guidance and soil tests.


## Farmer workspace features

- Choose any ISO 3166-1 alpha-2 country. The farmer dashboard, disease screen, and tools have interface translations for English, Hindi, and Telugu; untranslated content stays in English. The chat language selector supports the 12 languages listed in the deployed chat function: English, Hindi, Telugu, Tamil, Bengali, Punjabi, Gujarati, Kannada, Malayalam, Marathi, Odia, and Assamese. Responses depend on the configured model/provider and are not a promise of translation quality.
- The chat has a microphone button, editable speech transcript, selectable chat/speech language, per-reply playback, and optional automatic reply playback. Input and output speech use browser Web Speech APIs: microphone permission, recognition languages, and installed voices vary by device. The chat reports unsupported speech and keeps readable text as the fallback. Browser speech recognition may require internet even when an on-device voice exists.
- The last 60 chat messages are saved in this browser's local storage so farmers can read recent history offline. The widget has a clear-history control. New AI answers require internet and the deployed Supabase chat function; the app does not fabricate offline answers.
- Farm profile, costs, saved recommendations, service directory, and crop tasks are held in browser IndexedDB. Use Export in privacy controls to save a JSON copy. Weather snapshots are cached locally; GPS is requested only after the farmer selects “Use device location.” Coordinates from that one request are used for that forecast and cached with it, not saved into the farm profile.
- The offline app shell is served by the existing PWA service worker. Previously saved profile, advice, costs, service entries, and calendar tasks remain available offline. Local changes are queued in an append-only event log. Optional cloud sync is off until the farmer opts in. Sync uses Supabase anonymous authentication and row-level security. It is scoped to that browser's anonymous session and does not provide account recovery or cross-device identity. Conflicts resolve by latest event timestamp; ties use the event ID for a deterministic winner. Keep a local export before clearing site data.
- The crop calendar is farmer-authored: select a crop and enter sowing, irrigation, fertilizing, harvest, or other tasks. The app does not generate an unverified local schedule. Browser reminders work only while the app is open and the browser grants notification permission.
- Weather uses the [Open-Meteo Forecast API](https://open-meteo.com/en/docs) and [Geocoding API](https://open-meteo.com/en/docs/geocoding-api). For non-commercial use this setup requires no API key. Forecast calls are made by the Python server; geocoding and forecast errors are shown in the interface, with a saved snapshot shown as stale when available. Weather heads-up rules in this app (40°C maximum or 50 mm daily precipitation) are simple app thresholds, not official alerts. Follow local meteorological and agricultural authorities.
- The nearby-services directory is an editable, local list. The user must enter a provider and the source/verification date. The app does not search for, verify, or invent nearby providers. Phone links and OpenStreetMap search directions are offered only from user-supplied entries.
- Cost comparison uses costs, currency, area, selling price, and model yield estimates entered/selected by the farmer. Results are rough arithmetic and do not account for every tax, loan, loss, transport cost, or market change; they are not a promise of profit.
- Recommendation cards separate heuristic crop-fit factors from the Random Forest yield estimate. Suitability factors are pH, nitrogen, temperature, rainfall, and season; phosphorus, potassium, humidity, and soil type are not inputs to that rule score. The yield model uses its configured feature pipeline. The bundled training data is generated/synthetic, so its estimates are not validated real-world predictions.
- Dark mode follows the device preference until a farmer chooses a theme; the choice is stored in local browser storage.

## Optional Supabase farm sync configuration

The included Supabase values are a project URL and publishable browser key, not a secret API key. Never place a service-role key in a `VITE_` variable or in the frontend image. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. The Compose build forwards only those publishable settings to the web build.

To enable farm-workspace sync, apply `supabase/migrations/202611110001_farm_workspace_events.sql` to the same Supabase project and enable anonymous sign-ins in **Authentication → Sign In / Providers**. For example, after installing the Supabase CLI and linking the project, run `supabase db push`. Restart/rebuild the frontend after changing `.env`. Without these steps, local farm features continue to work and the sync control reports that sync is unavailable.

The existing chat and disease-analysis functions are separate integrations. Their function secrets must remain in Supabase Function Secrets, not frontend `.env` variables. The historical chat migration currently has broad access policies; review and tighten those policies before storing private conversations in a public deployment.

## Configuration and limitations

There is no required weather API secret. `VITE_SUPABASE_PROJECT_ID` is optional metadata; `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` configure the existing Supabase features. Without Supabase configuration, crop recommendations, yield API, local profile, calendar, offline cache, local directory, cost estimates, and weather still have the described local/server behavior; chatbot and disease analysis need their deployed Supabase functions.

Open-Meteo is the documented external source for the forecast and location lookup. Browser geolocation requires permission and a secure context (localhost is allowed). Speech depends on the browser/operating system and may require an internet connection. Interface translations are currently limited to English, Hindi, and Telugu; browser speech may support fewer or additional languages, but only the selected app languages have integrated UI labels. Synthetic model output and heuristic thresholds must be treated as educational decision support, not agronomic validation.
 (some Updates-1)
