import os
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer

CATEGORICAL_COLS = ['state', 'district', 'crop', 'season', 'soil_type']
NUMERICAL_COLS = ['ph', 'nitrogen', 'phosphorus', 'potassium', 'temperature', 'rainfall', 'humidity', 'area', 'previous_yield']
TEMPORAL_COLS = ['temp_q1', 'temp_q2', 'temp_q3', 'temp_q4', 'rain_q1', 'rain_q2', 'rain_q3', 'rain_q4']
TARGET_COL = 'yield'

PREPROCESSOR_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models', 'preprocessor.joblib')

class AgriculturalPreprocessor:
    def __init__(self):
        self.column_transformer = None
        self.feature_names = []
        self.target_scaler = StandardScaler()
        self.categories_ = {}

    def fit_transform(self, df):
        df_clean = df.copy()

        # Handle missing values
        for col in NUMERICAL_COLS + TEMPORAL_COLS:
            if col in df_clean.columns and df_clean[col].isnull().sum() > 0:
                df_clean[col] = df_clean[col].fillna(df_clean[col].median())

        for col in CATEGORICAL_COLS:
            if col in df_clean.columns and df_clean[col].isnull().sum() > 0:
                df_clean[col] = df_clean[col].fillna(df_clean[col].mode()[0])

        # Record category options for UI dropdowns
        for col in CATEGORICAL_COLS:
            self.categories_[col] = sorted(list(df_clean[col].unique()))

        # Setup column transformer
        self.column_transformer = ColumnTransformer(
            transformers=[
                ('cat', OneHotEncoder(sparse_output=False, handle_unknown='ignore'), CATEGORICAL_COLS),
                ('num', StandardScaler(), NUMERICAL_COLS)
            ],
            remainder='drop'
        )

        X_transformed = self.column_transformer.fit_transform(df_clean)

        # Get feature names
        cat_encoder = self.column_transformer.named_transformers_['cat']
        cat_feature_names = list(cat_encoder.get_feature_names_out(CATEGORICAL_COLS))
        self.feature_names = cat_feature_names + NUMERICAL_COLS

        # Fit target scaler if target is present
        if TARGET_COL in df_clean.columns:
            y = df_clean[TARGET_COL].values.reshape(-1, 1)
            y_scaled = self.target_scaler.fit_transform(y).ravel()
        else:
            y_scaled = None

        # Extract sequence tensor for LSTM (temporal weather windows: [temp, rain] for 4 quarters)
        # Shape: (N, 4, 2)
        seq_data = []
        for i in range(len(df_clean)):
            row = df_clean.iloc[i]
            t_seq = [row['temp_q1'], row['temp_q2'], row['temp_q3'], row['temp_q4']]
            r_seq = [row['rain_q1'], row['rain_q2'], row['rain_q3'], row['rain_q4']]
            seq = np.column_stack([t_seq, r_seq])
            seq_data.append(seq)
        seq_tensor = np.array(seq_data, dtype=np.float32)

        # Standardize sequence tensor
        mean_s = seq_tensor.mean(axis=(0, 1), keepdims=True)
        std_s = seq_tensor.std(axis=(0, 1), keepdims=True) + 1e-6
        seq_tensor_scaled = (seq_tensor - mean_s) / std_s
        self.seq_mean = mean_s
        self.seq_std = std_s

        return X_transformed, seq_tensor_scaled, y_scaled

    def transform_single(self, input_dict):
        if hasattr(input_dict, 'keys') and not isinstance(input_dict, dict):
            input_dict = dict(input_dict)
        # Build single row dataframe
        df_single = pd.DataFrame([input_dict])

        # Fill defaults if missing
        if 'previous_yield' not in df_single.columns or pd.isnull(df_single['previous_yield'].iloc[0]):
            df_single['previous_yield'] = 0.0

        for col in NUMERICAL_COLS:
            if col not in df_single.columns:
                df_single[col] = 0.0

        for col in CATEGORICAL_COLS:
            if col not in df_single.columns:
                df_single[col] = self.categories_.get(col, ['Unknown'])[0]

        X_transformed = self.column_transformer.transform(df_single)

        # Synthesize 4-quarter weather sequence for single prediction
        temp = float(input_dict.get('temperature', 25.0))
        rain = float(input_dict.get('rainfall', 800.0))

        t_seq = [temp - 2.0, temp + 1.0, temp + 2.0, temp - 1.0]
        r_seq = [max(0.0, rain * 0.2), max(0.0, rain * 0.4), max(0.0, rain * 0.3), max(0.0, rain * 0.1)]
        seq = np.column_stack([t_seq, r_seq]) # (4, 2)
        seq = np.expand_dims(seq, axis=0)     # (1, 4, 2)
        seq_scaled = (seq - self.seq_mean) / self.seq_std

        return X_transformed, seq_scaled

    def save(self, filepath=PREPROCESSOR_PATH):
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self, filepath)

    @staticmethod
    def load(filepath=PREPROCESSOR_PATH):
        return joblib.load(filepath)
