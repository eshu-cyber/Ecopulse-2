from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import joblib
import os
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='../Frontend', static_url_path='')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.joblib")
DATA_PATH = os.path.join(BASE_DIR, "processed_aqi_data.csv")
FEATURES_PATH = os.path.join(BASE_DIR, "features.joblib")

# Load model and data
model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)
features = joblib.load(FEATURES_PATH)
df_historical = pd.read_csv(DATA_PATH)
df_historical['Date'] = pd.to_datetime(df_historical['Date'])

def get_forecast_data():
    """Generate forecasted data for 2026 and 2027 based on historical seasonal trends."""
    print("Generating forecast data...")
    # Last date in historical data is 2025-12-31
    start_date = datetime(2026, 1, 1)
    end_date = datetime(2027, 12, 31)
    date_range = pd.date_range(start_date, end_date)
    
    # Calculate monthly averages from historical data to preserve seasonality
    historical_seasonal = df_historical.groupby(df_historical['Date'].dt.month)[features].mean()
    
    # Prepare forecasting data in bulk
    forecast_df = pd.DataFrame({'Date': date_range})
    forecast_df['Month'] = forecast_df['Date'].dt.month
    forecast_df['Year'] = forecast_df['Date'].dt.year
    
    # Map base values from seasonality
    for feat in features:
        forecast_df[feat] = forecast_df['Month'].map(historical_seasonal[feat])
        
        # Vectorized application of annual growth trend (3% per year beyond 2025)
        forecast_df[feat] *= (1 + (forecast_df['Year'] - 2025) * 0.03)
        
        # Add a bit of random noise (gaussian)
        noise = np.random.normal(0, forecast_df[feat] * 0.05)
        forecast_df[feat] += noise

    # Bulk Predict AQI
    input_data = forecast_df[features]
    is_linear = "LinearRegression" in str(type(model))
    
    if is_linear:
        input_processed = scaler.transform(input_data)
        aqi_preds = model.predict(input_processed)
    else:
        aqi_preds = model.predict(input_data)
        
    forecast_df['AQI'] = aqi_preds
    forecast_df['Type'] = 'Predicted'
    
    # Convert to list of dicts
    forecast_df['Date'] = forecast_df['Date'].dt.strftime('%Y-%m-%d')
    return forecast_df.to_dict(orient='records')

@app.route('/api/dashboard-data', methods=['GET'])
def dashboard_data():
    print(f"[{datetime.now()}] GET /api/dashboard-data")
    try:
        # Filter historical data for 2024-2025
        df_24_25 = df_historical[(df_historical['Year'] >= 2024) & (df_historical['Year'] <= 2025)].copy()
        historical_data = df_24_25[["Date", "Year", "Month", "AQI", "PM2_5", "PM10", "NO2", "SO2", "CO", "O3"]].copy()
        historical_data["Date"] = pd.to_datetime(historical_data["Date"]).dt.strftime('%Y-%m-%d')
        historical_data["Type"] = "Historical"
        
        # Generate forecast
        forecast_data = get_forecast_data()
        
        # Combine
        combined = historical_data.to_dict(orient='records') + forecast_data
        print(f"Returning {len(combined)} data points.")
        return jsonify(combined)
    except Exception as e:
        print(f"Error in dashboard_data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.json
    print(f"[{datetime.now()}] POST /api/predict")
    try:
        input_data = pd.DataFrame([{
            "PM2_5": data.get("PM2_5", 50),
            "PM10": data.get("PM10", 80),
            "NO2": data.get("NO2", 30),
            "SO2": data.get("SO2", 15),
            "CO": data.get("CO", 1.5),
            "O3": data.get("O3", 40)
        }])
        
        is_linear = "LinearRegression" in str(type(model))
        if is_linear:
            input_processed = scaler.transform(input_data)
            prediction = model.predict(input_processed)[0]
        else:
            prediction = model.predict(input_data)[0]
            
        return jsonify({"AQI": float(prediction)})
    except Exception as e:
        print(f"Error in predict: {e}")
        return jsonify({"error": str(e)}), 400

@app.route('/', methods=['GET'])
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>', methods=['GET'])
def serve_secondary_pages(path):
    if not path.endswith('.html') and '.' not in path:
        path += '.html'
    return app.send_static_file(path)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    print("Starting Flask server on http://0.0.0.0:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
