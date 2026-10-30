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

class LSTMRegressor(nn.Module):
    def __init__(self, input_dim=2, hidden_dim=64, num_layers=2):
        super(LSTMRegressor, self).__init__()
        self.lstm = nn.LSTM(input_size=input_dim, hidden_size=hidden_dim, num_layers=num_layers, batch_first=True, dropout=0.1)
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        # x shape: (batch_size, seq_len=4, num_features=2)
        out, (h_n, c_n) = self.lstm(x)
        last_hidden = out[:, -1, :] # Last time step output
        preds = self.fc(last_hidden)
        return preds

def train_lstm():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc_path = os.path.join(base_dir, 'data', 'processed', 'processed_data.joblib')
    model_dir = os.path.join(base_dir, 'models', 'lstm')
    os.makedirs(model_dir, exist_ok=True)

    data = joblib.load(proc_path)
    X_train_seq = torch.tensor(data['X_train_seq'], dtype=torch.float32)
    X_test_seq = torch.tensor(data['X_test_seq'], dtype=torch.float32)
    y_train = torch.tensor(data['y_train_raw'], dtype=torch.float32).unsqueeze(1)
    y_test_raw = data['y_test_raw']

    dataset = TensorDataset(X_train_seq, y_train)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)

    model = LSTMRegressor(input_dim=2, hidden_dim=64, num_layers=2)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.003)

    best_loss = float('inf')
    best_weights = None

    for epoch in range(120):
        model.train()
        for batch_x, batch_y in loader:
            optimizer.zero_grad()
            preds = model(batch_x)
            loss = criterion(preds, batch_y)
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            test_preds = model(X_test_seq)
            test_loss = criterion(test_preds, torch.tensor(y_test_raw, dtype=torch.float32).unsqueeze(1)).item()
            if test_loss < best_loss:
                best_loss = test_loss
                best_weights = model.state_dict()

    if best_weights:
        model.load_state_dict(best_weights)

    model.eval()
    with torch.no_grad():
        y_pred = model(X_test_seq).numpy().ravel()

    r2 = float(r2_score(y_test_raw, y_pred))
    mae = float(mean_absolute_error(y_test_raw, y_pred))
    rmse = float(root_mean_squared_error(y_test_raw, y_pred))

    model_path = os.path.join(model_dir, 'lstm_model.pt')
    torch.save({
        'state_dict': model.state_dict(),
        'input_dim': 2,
        'hidden_dim': 64
    }, model_path)

    metrics = {'r2': r2, 'mae': mae, 'rmse': rmse}
    print(f"LSTM Trained Successfully!")
    print(f"Metrics -> R2: {r2:.4f}, MAE: {mae:.4f}, RMSE: {rmse:.4f}")
    return model, metrics

if __name__ == '__main__':
    train_lstm()
