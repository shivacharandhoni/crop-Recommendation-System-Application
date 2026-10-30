import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from utils.preprocessing import AgriculturalPreprocessor

def run_preprocessing_pipeline():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    raw_path = os.path.join(base_dir, 'data', 'raw', 'multisource_agricultural_dataset.csv')
    proc_dir = os.path.join(base_dir, 'data', 'processed')
    os.makedirs(proc_dir, exist_ok=True)

    if not os.path.exists(raw_path):
        from training.generate_dataset import generate_multisource_agricultural_dataset
        df = generate_multisource_agricultural_dataset()
        df.to_csv(raw_path, index=False)
    else:
        df = pd.read_csv(raw_path)

    preprocessor = AgriculturalPreprocessor()
    X_mat, X_seq, y_scaled = preprocessor.fit_transform(df)

    y_raw = df['yield'].values

    # Train / Test split (80% train, 20% test)
    indices = range(len(df))
    train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42)

    data_dict = {
        'X_train_mat': X_mat[train_idx],
        'X_test_mat': X_mat[test_idx],
        'X_train_seq': X_seq[train_idx],
        'X_test_seq': X_seq[test_idx],
        'y_train_scaled': y_scaled[train_idx],
        'y_test_scaled': y_scaled[test_idx],
        'y_train_raw': y_raw[train_idx],
        'y_test_raw': y_raw[test_idx],
        'feature_names': preprocessor.feature_names
    }

    # Save preprocessor and processed matrices
    preprocessor.save()
    proc_data_path = os.path.join(proc_dir, 'processed_data.joblib')
    joblib.dump(data_dict, proc_data_path)

    print(f"Preprocessing completed successfully!")
    print(f"Feature matrix shape: {X_mat.shape}")
    print(f"Sequence matrix shape: {X_seq.shape}")
    print(f"Processed data saved to: {proc_data_path}")
    return data_dict

if __name__ == '__main__':
    run_preprocessing_pipeline()
