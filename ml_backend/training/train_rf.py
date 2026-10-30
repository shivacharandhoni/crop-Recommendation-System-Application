import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error

def train_random_forest():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc_path = os.path.join(base_dir, 'data', 'processed', 'processed_data.joblib')
    model_dir = os.path.join(base_dir, 'models', 'random_forest')
    os.makedirs(model_dir, exist_ok=True)

    data = joblib.load(proc_path)
    X_train = data['X_train_mat']
    X_test = data['X_test_mat']
    y_train = data['y_train_raw']
    y_test = data['y_test_raw']

    rf = RandomForestRegressor(n_estimators=150, max_depth=15, random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    y_pred = rf.predict(X_test)

    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(root_mean_squared_error(y_test, y_pred))

    model_path = os.path.join(model_dir, 'rf_model.joblib')
    joblib.dump(rf, model_path)

    metrics = {'r2': r2, 'mae': mae, 'rmse': rmse}
    print(f"Random Forest Trained Successfully!")
    print(f"Metrics -> R2: {r2:.4f}, MAE: {mae:.4f}, RMSE: {rmse:.4f}")
    return rf, metrics

if __name__ == '__main__':
    train_random_forest()
