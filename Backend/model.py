import numpy as np
import pandas as pd
import joblib
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
warnings.filterwarnings("ignore")
import re # Added for advanced regex operations

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)
from xgboost import XGBRegressor

# ── STEP 3: Load or Generate Dataset ────────────────────────
# 👉 Option A: Use your own CSV file (upload to Colab first)
# Load the Excel file, skipping only the very first title row
# Load the Excel file from the local Backend directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "Atchuthapuram_AQI_Pollution_Dataset_2023_2025.xlsx")
df_raw = pd.read_excel(DATA_PATH, header=None, skiprows=1)

# The actual column names are in the first row of this loaded df_raw (index 0)
# CORRECTION: Based on kernel state, the actual headers are in df_raw.iloc[1]
header_row_series = df_raw.iloc[1]

# Convert Series to a list of strings to ensure iteration is over values, not index
header_row_list = header_row_series.tolist()

# Clean these header names
cleaned_cols = []
for col in header_row_list: # Iterate over the list of actual string values
    col_str = str(col)
    col_str = re.sub(r' \(.*?\)', '', col_str) # Remove units like (μg/m³)
    col_str = col_str.replace('.', '_')       # Replace '.' with '_' for PM2.5 -> PM2_5
    col_str = col_str.strip()                  # Remove leading/trailing spaces
    cleaned_cols.append(col_str)

# Assign cleaned columns to the DataFrame
df_raw.columns = cleaned_cols

# Drop the rows that were used as header and reset index
# CORRECTION: Drop df_raw.iloc[0] (NaNs) and df_raw.iloc[1] (actual headers)
df = df_raw[2:].reset_index(drop=True)

# Convert relevant columns to numeric, coercing errors to NaN
# Ensure AQI is present before converting
if 'AQI' in df.columns:
    df['AQI'] = pd.to_numeric(df['AQI'], errors='coerce')
for feature in ["PM2_5", "PM10", "NO2", "SO2", "CO", "O3"]:
    if feature in df.columns: # Check if feature exists before trying to convert
        df[feature] = pd.to_numeric(df[feature], errors='coerce')

# Drop rows where AQI is NaN after conversion (or any other critical feature)
# Ensure 'AQI' column exists before trying to dropna on it
if 'AQI' in df.columns:
    df = df.dropna(subset=['AQI'] + [f for f in ["PM2_5", "PM10", "NO2", "SO2", "CO", "O3"] if f in df.columns])

# 👉 Option B: Synthetic dataset (runs instantly, no file needed)
# np.random.seed(42)
# n = 2000

# df = pd.DataFrame({
#     "PM2_5":      np.random.uniform(10, 300, n),
#     "PM10":       np.random.uniform(20, 400, n),
#     "NO2":        np.random.uniform(5,  150, n),
#     "SO2":        np.random.uniform(2,  100, n),
#     "CO":         np.random.uniform(0.1, 15, n),
#     "O3":         np.random.uniform(10, 200, n),
#     "Temperature":np.random.uniform(10,  45, n),
#     "Humidity":   np.random.uniform(20, 100, n),
#     "WindSpeed":  np.random.uniform(0,   30, n),
# })

# # AQI is a weighted combination + noise (realistic synthetic formula)
# df["AQI"] = (
#     0.40 * df["PM2_5"] +
#     0.20 * df["PM10"]  +
#     0.15 * df["NO2"]   +
#     0.10 * df["SO2"]   +
#     0.08 * df["CO"] * 10 +
#     0.07 * df["O3"]    +
#     np.random.normal(0, 12, n)
# ).clip(0, 500)

print("[DONE] Dataset ready")
print(df.head())
print(f"\nShape: {df.shape}")

# Ensure 'AQI' column exists before trying to describe it
if 'AQI' in df.columns:
    print(f"\nAQI Stats:\n{df['AQI'].describe().round(2)}")
else:
    print("\nWarning: 'AQI' column not found, cannot display AQI Stats.")

# ── STEP 4: Exploratory Data Analysis (EDA) ─────────────────────
fig, axes = plt.subplots(1, 3, figsize=(18, 5))
fig.suptitle("Pollution Data – EDA", fontsize=15, fontweight="bold")

# AQI Distribution
if 'AQI' in df.columns:
    axes[0].hist(df["AQI"], bins=40, color="#e74c3c", edgecolor="white", alpha=0.85)
    axes[0].set_title("AQI Distribution")
    axes[0].set_xlabel("AQI")
    axes[0].set_ylabel("Count")
else:
    axes[0].set_title("AQI Distribution (AQI column not found)")
    axes[0].text(0.5, 0.5, "AQI column not available", ha='center', va='center', transform=axes[0].transAxes)

# Correlation Heatmap
corr = df.corr(numeric_only=True) # Added numeric_only=True for older pandas versions
sns.heatmap(corr, ax=axes[1], annot=True, fmt=".2f",
            cmap="coolwarm", linewidths=0.5, cbar=True)
axes[1].set_title("Correlation Heatmap")

# AQI vs PM2.5
if 'PM2_5' in df.columns and 'AQI' in df.columns:
    axes[2].scatter(df["PM2_5"], df["AQI"], alpha=0.3, color="#2980b9", s=10)
    axes[2].set_title("PM2_5 vs AQI")
    axes[2].set_xlabel("PM2_5")
    axes[2].set_ylabel("AQI")
else:
    axes[2].set_title("PM2_5 vs AQI (Columns not found)")
    axes[2].text(0.5, 0.5, "PM2_5 or AQI column not available", ha='center', va='center', transform=axes[2].transAxes)

plt.tight_layout()
plt.savefig("eda_plots.png", dpi=150)
# plt.show()
print("EDA plots saved as 'eda_plots.png'")

# ── STEP 5: Feature Engineering & Preprocessing ───────────────────
# Updated FEATURES list based on available columns in the provided dataset
final_features = [f for f in ["PM2_5", "PM10", "NO2", "SO2", "CO", "O3"] if f in df.columns]
TARGET = "AQI"

if TARGET not in df.columns:
    raise KeyError(f"Target column '{TARGET}' not found in the DataFrame. Available columns: {df.columns.tolist()}")
if not final_features:
    raise ValueError(f"No valid features found in the DataFrame after cleaning. Available columns: {df.columns.tolist()}")

FEATURES = final_features

X = df[FEATURES]
y = df[TARGET]

# Train / Test split (80 / 20)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Scale features (important for Linear Regression)
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

print(f"\n[DONE] Train size: {X_train.shape[0]} | Test size: {X_test.shape[0]}")

# ── STEP 6: Helper – Evaluation Function ──────────────────
def evaluate_model(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    mse  = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    r2   = r2_score(y_true, y_pred)
    print(f"\n{'='*45}")
    print(f"\n  [MODEL] {name}")
    print(f"{'='*45}")
    print(f"  MAE  (lower = better) : {mae:.4f}")
    print(f"  RMSE (lower = better) : {rmse:.4f}")
    print(f"  R²   (higher = better): {r2:.4f}  ({r2*100:.2f}%)")
    return {"Model": name, "MAE": round(mae,4),
            "RMSE": round(rmse,4), "R2": round(r2,4)}

# ── STEP 7A: Linear Regression ─────────────────────
print("\nTraining Linear Regression...")
lr_model = LinearRegression()
lr_model.fit(X_train_scaled, y_train)
lr_pred  = lr_model.predict(X_test_scaled)
lr_scores = evaluate_model("Linear Regression", y_test, lr_pred)

# Cross-validation R² (5-fold)
lr_cv = cross_val_score(lr_model, X_train_scaled, y_train,
                        cv=5, scoring="r2")
print(f"  CV R² (5-fold): {lr_cv.mean():.4f} ± {lr_cv.std():.4f}")

# ── STEP 7B: Random Forest ─────────────────────────
print("\nTraining Random Forest...")
rf_model = RandomForestRegressor(
    n_estimators=200,
    max_depth=12,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)
rf_model.fit(X_train, y_train)       # RF doesn't need scaling
rf_pred = rf_model.predict(X_test)
rf_scores = evaluate_model("Random Forest", y_test, rf_pred)

rf_cv = cross_val_score(rf_model, X_train, y_train,
                        cv=5, scoring="r2")
print(f"  CV R² (5-fold): {rf_cv.mean():.4f} ± {rf_cv.std():.4f}")

# ── STEP 7C: XGBoost ──────────────────────────
print("\nTraining XGBoost...")
xgb_model = XGBRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=42,
    verbosity=0
)
xgb_model.fit(X_train, y_train,
              eval_set=[(X_test, y_test)],
              verbose=False)
xgb_pred = xgb_model.predict(X_test)
xgb_scores = evaluate_model("XGBoost", y_test, xgb_pred)

xgb_cv = cross_val_score(xgb_model, X_train, y_train,
                         cv=5, scoring="r2")
print(f"  CV R² (5-fold): {xgb_cv.mean():.4f} ± {xgb_cv.std():.4f}")

# ── STEP 8: Model Comparison Table ──────────────────
results_df = pd.DataFrame([lr_scores, rf_scores, xgb_scores])
results_df = results_df.sort_values("R2", ascending=False).reset_index(drop=True)
print("\n\nMODEL COMPARISON")
print("=" * 50)
print(results_df.to_string(index=False))
best_model_name = results_df.iloc[0]["Model"]
print(f"\n[BEST] Best Model: {best_model_name}")

# ── STEP 8.1: Save Best Model & Scaler ──────────────────────
print("\nSaving model and scaler...")
if best_model_name == "XGBoost":
    joblib.dump(xgb_model, os.path.join(BASE_DIR, "model.joblib"))
elif best_model_name == "Random Forest":
    joblib.dump(rf_model, os.path.join(BASE_DIR, "model.joblib"))
else:
    joblib.dump(lr_model, os.path.join(BASE_DIR, "model.joblib"))

joblib.dump(scaler, os.path.join(BASE_DIR, "scaler.joblib"))
joblib.dump(FEATURES, os.path.join(BASE_DIR, "features.joblib"))
print("Files saved: model.joblib, scaler.joblib, features.joblib")

# ── STEP 9: Visualizations ──────────────────────
fig, axes = plt.subplots(2, 3, figsize=(18, 12))
fig.suptitle("Model Performance – AQI Prediction", fontsize=16, fontweight="bold")

preds   = [lr_pred, rf_pred, xgb_pred]
names   = ["Linear Regression", "Random Forest", "XGBoost"]
colors  = ["#3498db", "#2ecc71", "#f39c12"]

for i, (name, pred, color) in enumerate(zip(names, preds, colors)):
    # Row 0: Actual vs Predicted
    ax = axes[0][i]
    ax.scatter(y_test, pred, alpha=0.3, color=color, s=8)
    mn, mx = y_test.min(), y_test.max()
    ax.plot([mn, mx], [mn, mx], "r--", lw=1.5, label="Perfect fit")
    ax.set_title(f"{name}\nActual vs Predicted")
    ax.set_xlabel("Actual AQI")
    ax.set_ylabel("Predicted AQI")
    ax.legend(fontsize=8)
    r2 = r2_score(y_test, pred)
    ax.text(0.05, 0.92, f"R²={r2:.3f}", transform=ax.transAxes,
            fontsize=10, color="black",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.7))

    # Row 1: Residuals
    ax2 = axes[1][i]
    residuals = y_test - pred
    ax2.scatter(pred, residuals, alpha=0.3, color=color, s=8)
    ax2.axhline(0, color="red", linestyle="--", lw=1.5)
    ax2.set_title(f"{name}\nResiduals")
    ax2.set_xlabel("Predicted AQI")
    ax2.set_ylabel("Residual (Actual − Predicted)")

plt.tight_layout()
plt.savefig("model_performance.png", dpi=150)
# plt.show()
print("Performance plots saved as 'model_performance.png'")

# ── STEP 10: Feature Importance (RF & XGBoost) ───────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("Feature Importance", fontsize=14, fontweight="bold")

rf_importance = pd.Series(rf_model.feature_importances_, index=FEATURES).sort_values()
rf_importance.plot(kind="barh", ax=axes[0], color="#2ecc71", edgecolor="white")
axes[0].set_title("Random Forest – Feature Importance")
axes[0].set_xlabel("Importance")

xgb_importance = pd.Series(xgb_model.feature_importances_, index=FEATURES).sort_values()
xgb_importance.plot(kind="barh", ax=axes[1], color="#f39c12", edgecolor="white")
axes[1].set_title("XGBoost – Feature Importance")
axes[1].set_xlabel("Importance")

plt.tight_layout()
plt.savefig("feature_importance.png", dpi=150)
# plt.show()
print("Feature importance saved as 'feature_importance.png'")

# ── STEP 11: Metrics Bar Chart ─────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(15, 5))
fig.suptitle("Metrics Comparison Across Models", fontsize=14, fontweight="bold")

metrics = ["MAE", "RMSE", "R2"]
bar_colors = ["#3498db", "#2ecc71", "#f39c12"]

for j, metric in enumerate(metrics):
    vals  = results_df[metric].values
    names_ = results_df["Model"].values
    bars = axes[j].bar(names_, vals, color=bar_colors, edgecolor="white", width=0.5)
    axes[j].set_title(metric)
    axes[j].set_ylabel(metric)
    axes[j].set_xticklabels(names_, rotation=15, ha="right")
    for bar, val in zip(bars, vals):
        axes[j].text(bar.get_x() + bar.get_width()/2,
                     bar.get_height() + 0.005 * max(vals),
                     f"{val:.3f}", ha="center", va="bottom", fontsize=9)

plt.tight_layout()
plt.savefig("metrics_comparison.png", dpi=150)
# plt.show()
print("Metrics comparison saved as 'metrics_comparison.png'")

# ── STEP 12: Predict on New Data ──────────────────
print("\n\nPREDICT ON NEW SAMPLE")
print("=" * 45)
# Note: The new_sample must only contain the features present in the trained model (PM2_5, PM10, NO2, SO2, CO, O3).
# Removed Temperature, Humidity, WindSpeed as they are not in the dataset used for training.
new_sample = pd.DataFrame({
    "PM2_5": 120,   # µg/m³
    "PM10":  180,   # µg/m³
    "NO2":   60,    # µg/m³
    "SO2":   30,    # µg/m³
    "CO":    5.0,   # mg/m³
    "O3":    80     # µg/m³
}, index=[0])

sample_scaled = scaler.transform(new_sample)

print(f"  Linear Regression  → AQI = {lr_model.predict(sample_scaled)[0]:.2f}")
print(f"  Random Forest      → AQI = {rf_model.predict(new_sample)[0]:.2f}")
print(f"  XGBoost            → AQI = {xgb_model.predict(new_sample)[0]:.2f}")

def aqi_category(aqi):
    if aqi <= 50:   return "Good 🟢"
    elif aqi <= 100: return "Moderate 🟡"
    elif aqi <= 150: return "Unhealthy for Sensitive Groups 🟠"
    elif aqi <= 200: return "Unhealthy 🔴"
    elif aqi <= 300: return "Very Unhealthy 🟣"
    else:            return "Hazardous ⚫"

avg_aqi = np.mean([
    lr_model.predict(sample_scaled)[0],
    rf_model.predict(new_sample)[0],
    xgb_model.predict(new_sample)[0]
])
print(f"\n  Ensemble Average AQI : {avg_aqi:.2f}")
print(f"  AQI Category         : {aqi_category(avg_aqi)}")

print("\nAll done! Check your Colab files panel for saved plots.")