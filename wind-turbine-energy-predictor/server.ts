import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config();

// Initialize Database
const db_sqlite = new Database("wind_turbine.db");
db_sqlite.exec(`
  CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    city TEXT,
    wind_speed REAL,
    temperature REAL,
    predicted_power REAL,
    efficiency REAL
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Startup check for API Key
  if (!process.env.VITE_OPENWEATHER_API_KEY) {
    console.warn("WARNING: VITE_OPENWEATHER_API_KEY is not set in the environment. Weather search will be disabled.");
  }

  // API Routes
  
  // 1. Weather Proxy
  app.get("/api/weather", async (req, res) => {
    const { city } = req.query;
    const apiKey = process.env.VITE_OPENWEATHER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "OpenWeather API key not configured. Please add VITE_OPENWEATHER_API_KEY to your secrets." });
    }

    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`
      );
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ 
        error: error.response?.data?.message || "Failed to fetch weather data" 
      });
    }
  });

  // 2. Prediction Logic
  app.post("/api/predict", (req, res) => {
    const { windSpeed, windDirection, temperature, pressure, city } = req.body;

    const v = parseFloat(windSpeed) || 0;
    const t = parseFloat(temperature) || 15;
    const p = parseFloat(pressure) || 1013;

    const R = 287.05; 
    const tempKelvin = t + 273.15;
    const rho = (p * 100) / (R * tempKelvin); 

    const sweptArea = 5000; 
    const powerCoefficient = 0.4; 
    
    let power = 0.5 * rho * sweptArea * Math.pow(v, 3) * powerCoefficient;
    const directionFactor = 1 - (Math.abs(Math.sin((windDirection || 0) * Math.PI / 180)) * 0.05);
    power *= directionFactor;

    const maxCapacity = 2500000;
    power = Math.min(power, maxCapacity);
    
    if (v < 3 || v > 25) {
      power = 0;
    }

    const predictedPowerKw = parseFloat((power / 1000).toFixed(2));
    const efficiencyVal = parseFloat((powerCoefficient * directionFactor * 100).toFixed(1));

    // Save to DB
    try {
      const stmt = db_sqlite.prepare(`
        INSERT INTO predictions (city, wind_speed, temperature, predicted_power, efficiency)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(city || 'Manual', v, t, predictedPowerKw, efficiencyVal);
    } catch (err) {
      console.error("Database insert error:", err);
    }

    res.json({
      predictedPower: predictedPowerKw.toString(),
      unit: "kW",
      details: {
        airDensity: rho.toFixed(4),
        efficiency: efficiencyVal + "%"
      }
    });
  });

  // 3. Historical Data from DB
  app.get("/api/history", (req, res) => {
    try {
      const rows = db_sqlite.prepare(`
        SELECT 
          strftime('%H:%M', timestamp) as time,
          wind_speed as windSpeed,
          predicted_power as power
        FROM predictions 
        ORDER BY timestamp DESC 
        LIMIT 24
      `).all();
      
      // If no data, provide some seed data
      if (rows.length === 0) {
        const seed = Array.from({ length: 24 }, (_, i) => ({
          time: `${i}:00`,
          windSpeed: (8 + Math.sin(i / 3) * 4).toFixed(1),
          power: (Math.random() * 2000).toFixed(1)
        }));
        return res.json(seed.reverse());
      }
      
      res.json(rows.reverse());
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

