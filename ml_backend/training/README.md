# Dataset and model training

Project credit: **Shivacharan Dhoni (`shivacharandhoni`)**

## Dataset included

`../data/raw/multisource_agricultural_dataset.csv` is the dataset bundled with this project. It contains **3,000 rows and 23 columns**. The target column is `yield` (tons per hectare). Inputs include state, district, crop, season, soil type, pH, N/P/K readings, temperature, rainfall, humidity, farm area, previous yield, and quarterly weather values.

**Data provenance:** this CSV is generated/synthetic training data. The generation logic is in `generate_dataset.py`, including fixed random seed `42` for its default generation. It should be described to faculty as a generated dataset, not as measured government or farm-survey records. Replace it with an approved real dataset if the project requires field-observed data.

## Reproduce the Random Forest training run

Open a VS Code terminal and run:

```powershell
cd C:\Users\shiva\Downloads\farmeradvisory-main\ml_backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python training/preprocess.py
python training/train_rf.py
```

What the scripts do:

1. `preprocess.py` reads the bundled CSV, one-hot encodes categories, scales numeric inputs, creates an 80/20 train/test split with seed `42`, and saves the fitted preprocessor plus matrices in `data/processed/`.
2. `train_rf.py` fits a `RandomForestRegressor` with 150 trees and maximum depth 15 on the training partition.
3. The script evaluates the held-out partition with R², mean absolute error (MAE), and root mean squared error (RMSE), prints those values, and saves the fitted model to `models/random_forest/rf_model.joblib`.

The dashboard's yield API uses this saved Random Forest model. Re-running training replaces the model artifact used by the app.

The bundled `models/metrics.json` reports Random Forest **R² 0.9919**, **MAE 0.6992 tons/ha**, and **RMSE 1.8865 tons/ha** from the original project run. These are archived results on the generated dataset, not field-trial results. Also, the original preprocessing script fits its transformations before making the train/test split, so present the archived holdout scores with that limitation in mind.

## Other included training methods

The archive also includes `train_dnn.py`, `train_lstm.py`, `train_hybrid.py`, and `evaluate.py`. The full comparison pipeline trains those PyTorch models as well as the Random Forest. It requires the larger optional dependency set in `requirements-full.txt` and can take longer to install and train:

```powershell
python -m pip install -r training/requirements-full.txt
python training/preprocess.py
python training/evaluate.py
```

`models/metrics.json` contains the evaluation metrics bundled with the original project. Re-running `evaluate.py` produces a fresh comparison using the local environment and dataset.
