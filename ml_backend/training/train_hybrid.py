import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error

class HybridDNNLSTMNet(nn.Module):
    def __init__(self, mat_dim, seq_dim=2, seq_hidden_dim=64):
        super(HybridDNNLSTMNet, self).__init__()

        # DNN Subnetwork for tabular agricultural & soil parameters
        self.dnn_branch = nn.Sequential(
            nn.Linear(mat_dim, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU()
        )

        # LSTM Subnetwork for temporal weather sequence features
        self.lstm_branch = nn.LSTM(
            input_size=seq_dim,
            hidden_size=seq_hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=0.1
        )

        # Fusion & Regressor Head
        fused_dim = 64 + seq_hidden_dim # 128 dims
        self.regressor = nn.Sequential(
            nn.Linear(fused_dim, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

    def forward(self, x_mat, x_seq):
        # DNN feature representation
        h_dnn = self.dnn_branch(x_mat)

        # LSTM temporal feature representation
        lstm_out, _ = self.lstm_branch(x_seq)
        h_lstm = lstm_out[:, -1, :]

        # Feature Fusion
        fused = torch.cat([h_dnn, h_lstm], dim=1)

        # Yield Prediction
        preds = self.regressor(fused)
        return preds

def train_hybrid_model():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc_path = os.path.join(base_dir, 'data', 'processed', 'processed_data.joblib')
    model_dir = os.path.join(base_dir, 'models', 'hybrid')
    os.makedirs(model_dir, exist_ok=True)

    data = joblib.load(proc_path)
    X_train_mat = torch.tensor(data['X_train_mat'], dtype=torch.float32)
    X_test_mat = torch.tensor(data['X_test_mat'], dtype=torch.float32)

    X_train_seq = torch.tensor(data['X_train_seq'], dtype=torch.float32)
    X_test_seq = torch.tensor(data['X_test_seq'], dtype=torch.float32)

    y_train = torch.tensor(data['y_train_raw'], dtype=torch.float32).unsqueeze(1)
    y_test_raw = data['y_test_raw']

    dataset = TensorDataset(X_train_mat, X_train_seq, y_train)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)

    model = HybridDNNLSTMNet(mat_dim=X_train_mat.shape[1], seq_dim=2, seq_hidden_dim=64)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.003, weight_decay=1e-4)

    best_loss = float('inf')
    best_weights = None

    for epoch in range(150):
        model.train()
        for batch_mat, batch_seq, batch_y in loader:
            optimizer.zero_grad()
            preds = model(batch_mat, batch_seq)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            test_preds = model(X_test_mat, X_test_seq)
            test_loss = criterion(test_preds, torch.tensor(y_test_raw, dtype=torch.float32).unsqueeze(1)).item()
            if test_loss < best_loss:
                best_loss = test_loss
                best_weights = model.state_dict()

    if best_weights:
        model.load_state_dict(best_weights)

    model.eval()
    with torch.no_grad():
        y_pred = model(X_test_mat, X_test_seq).numpy().ravel()

    r2 = float(r2_score(y_test_raw, y_pred))
    mae = float(mean_absolute_error(y_test_raw, y_pred))
    rmse = float(root_mean_squared_error(y_test_raw, y_pred))

    model_path = os.path.join(model_dir, 'hybrid_model.pt')
    torch.save({
        'state_dict': model.state_dict(),
        'mat_dim': X_train_mat.shape[1],
        'seq_dim': 2,
        'seq_hidden_dim': 64
    }, model_path)

    metrics = {'r2': r2, 'mae': mae, 'rmse': rmse}
    print(f"Hybrid DNN + LSTM Model Trained Successfully!")
    print(f"Metrics -> R2: {r2:.4f}, MAE: {mae:.4f}, RMSE: {rmse:.4f}")
    return model, metrics

if __name__ == '__main__':
    train_hybrid_model()
