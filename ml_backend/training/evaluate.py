import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import joblib
import torch
import numpy as np
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error

from training.train_rf import train_random_forest
from training.train_dnn import train_dnn, DNNRegressor
from training.train_lstm import train_lstm, LSTMRegressor
from training.train_hybrid import train_hybrid_model, HybridDNNLSTMNet

def evaluate_all_models():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc_path = os.path.join(base_dir, 'data', 'processed', 'processed_data.joblib')
    metrics_path = os.path.join(base_dir, 'models', 'metrics.json')

    if not os.path.exists(proc_path):
        from training.preprocess import run_preprocessing_pipeline
        run_preprocessing_pipeline()

    print("--- Starting Training & Evaluation Pipeline ---")

    rf_model, rf_metrics = train_random_forest()
    dnn_model, dnn_metrics = train_dnn()
    lstm_model, lstm_metrics = train_lstm()
    hybrid_model, hybrid_metrics = train_hybrid_model()

    comparison = {
        'Random Forest': rf_metrics,
        'DNN': dnn_metrics,
        'LSTM': lstm_metrics,
        'Hybrid DNN + LSTM': hybrid_metrics
    }

    with open(metrics_path, 'w') as f:
        json.dump(comparison, f, indent=4)

    print("\n================ MODEL COMPARISON SUMMARY ================")
    print(f"{'Model':<22} | {'R2 Score':<10} | {'MAE':<10} | {'RMSE':<10}")
    print("-" * 60)
    for model_name, metrics in comparison.items():
        print(f"{model_name:<22} | {metrics['r2']:<10.4f} | {metrics['mae']:<10.4f} | {metrics['rmse']:<10.4f}")
    print("==========================================================")
    print(f"Metrics saved to: {metrics_path}")
    return comparison

if __name__ == '__main__':
    evaluate_all_models()
