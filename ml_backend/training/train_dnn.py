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

class DNNRegressor(nn.Module):
    def __init__(self, input_dim):
        super(DNNRegressor, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        return self.net(x)

def train_dnn():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    proc_path = os.path.join(base_dir, 'data', 'processed', 'processed_data.joblib')
    model_dir = os.path.join(base_dir, 'models', 'dnn')
    os.makedirs(model_dir, exist_ok=True)

    data = joblib.load(proc_path)
    X_train = torch.tensor(data['X_train_mat'], dtype=torch.float32)
    X_test = torch.tensor(data['X_test_mat'], dtype=torch.float32)
    y_train = torch.tensor(data['y_train_raw'], dtype=torch.float32).unsqueeze(1)
    y_test_raw = data['y_test_raw']

    dataset = TensorDataset(X_train, y_train)
    loader = DataLoader(dataset, batch_size=32, shuffle=True)

    model = DNNRegressor(X_train.shape[1])
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.003, weight_decay=1e-4)

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
            test_preds = model(X_test)
            test_loss = criterion(test_preds, torch.tensor(y_test_raw, dtype=torch.float32).unsqueeze(1)).item()
            if test_loss < best_loss:
                best_loss = test_loss
                best_weights = model.state_dict()

    if best_weights:
        model.load_state_dict(best_weights)

    model.eval()
    with torch.no_grad():
        y_pred = model(X_test).numpy().ravel()

    r2 = float(r2_score(y_test_raw, y_pred))
    mae = float(mean_absolute_error(y_test_raw, y_pred))
    rmse = float(root_mean_squared_error(y_test_raw, y_pred))

    model_path = os.path.join(model_dir, 'dnn_model.pt')
    torch.save({
        'state_dict': model.state_dict(),
        'input_dim': X_train.shape[1]
    }, model_path)

    metrics = {'r2': r2, 'mae': mae, 'rmse': rmse}
    print(f"DNN Trained Successfully!")
    print(f"Metrics -> R2: {r2:.4f}, MAE: {mae:.4f}, RMSE: {rmse:.4f}")
    return model, metrics

if __name__ == '__main__':
    train_dnn()
