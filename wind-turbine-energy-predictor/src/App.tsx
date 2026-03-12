import React, { useState, useEffect } from 'react';
import { 
  Wind, 
  Thermometer, 
  Gauge, 
  Navigation, 
  Zap, 
  Search, 
  Activity,
  AlertTriangle,
  Info,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';

// --- Types ---
interface WeatherData {
  name: string;
  main: {
    temp: number;
    pressure: number;
    humidity: number;
  };
  wind: {
    speed: number;
    deg: number;
  };
}

interface PredictionResult {
  predictedPower: string;
  unit: string;
  details: {
    airDensity: string;
    efficiency: string;
  };
}

interface HistoryData {
  time: string;
  windSpeed: string;
  power: string;
}

// --- App Component ---
export default function App() {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // Manual inputs
  const [manualWind, setManualWind] = useState('8');
  const [manualTemp, setManualTemp] = useState('15');
  const [manualDir, setManualDir] = useState('180');

  useEffect(() => {
    fetchHistory();
    // Check if API key is missing (Vite exposes VITE_ prefixed vars)
    if (!import.meta.env.VITE_OPENWEATHER_API_KEY) {
      setIsApiKeyMissing(true);
    }
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get('/api/history');
      setHistory(res.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city) return;

    if (isApiKeyMissing) {
      setError("OpenWeather API key is missing. Please set VITE_OPENWEATHER_API_KEY in your environment.");
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/weather?city=${city}`);
      setWeather(res.data);
      // Auto predict after weather fetch
      handlePredict(res.data.wind.speed, res.data.wind.deg, res.data.main.temp, res.data.main.pressure, res.data.name);
    } catch (err: any) {
      setError(err.response?.data?.error || "City not found");
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (ws?: number, wd?: number, temp?: number, press?: number, cityName?: string) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/predict', {
        windSpeed: ws !== undefined ? ws : manualWind,
        windDirection: wd !== undefined ? wd : manualDir,
        temperature: temp !== undefined ? temp : manualTemp,
        pressure: press !== undefined ? press : 1013,
        city: cityName || city || 'Manual'
      });
      setPrediction(res.data);
      generateAIInsight(res.data, ws !== undefined ? ws : parseFloat(manualWind));
      fetchHistory(); // Refresh history chart
    } catch (err) {
      setError("Prediction failed");
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsight = async (pred: PredictionResult, wind: number) => {
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As a renewable energy expert, analyze this wind turbine state: 
        Wind Speed: ${wind} m/s, 
        Predicted Power: ${pred.predictedPower} kW, 
        Efficiency: ${pred.details.efficiency}. 
        Provide 2-3 sentences of technical insight or maintenance advice.`,
      });
      setAiInsight(response.text || '');
    } catch (err) {
      console.error("AI Insight failed", err);
      setAiInsight("Turbine operating within normal parameters. Monitor wind gusts for optimal pitch control.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Wind className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-800">WindFlow AI</h1>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#" className="text-emerald-600">Dashboard</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Forecasting</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Maintenance</a>
            <a href="#" className="hover:text-slate-800 transition-colors">Settings</a>
          </div>
          <button className="bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-all">
            Connect Grid
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {/* API Key Warning */}
        {isApiKeyMissing && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-800 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <span className="font-bold">API Key Missing:</span> Weather search is disabled. Please add your <code className="bg-amber-100 px-1 rounded text-amber-900">VITE_OPENWEATHER_API_KEY</code> to the environment variables.
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Controls */}
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                Location Search
              </h2>
              <form onSubmit={handleSearch} className="relative">
                <input 
                  type="text" 
                  placeholder="Enter city name..." 
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                <button 
                  type="submit"
                  disabled={loading}
                  className="mt-3 w-full bg-emerald-600 text-white py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'Fetching...' : 'Get Weather Data'}
                </button>
              </form>
              {error && <p className="mt-2 text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                Manual Parameters
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Wind Speed (m/s)</label>
                  <input 
                    type="range" min="0" max="30" step="0.1"
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    value={manualWind}
                    onChange={(e) => setManualWind(e.target.value)}
                  />
                  <div className="flex justify-between text-xs font-mono mt-1 text-slate-400">
                    <span>0</span>
                    <span className="text-emerald-600 font-bold">{manualWind} m/s</span>
                    <span>30</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Wind Direction (°)</label>
                  <input 
                    type="range" min="0" max="360"
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    value={manualDir}
                    onChange={(e) => setManualDir(e.target.value)}
                  />
                  <div className="flex justify-between text-xs font-mono mt-1 text-slate-400">
                    <span>0°</span>
                    <span className="text-emerald-600 font-bold">{manualDir}°</span>
                    <span>360°</span>
                  </div>
                </div>
                <button 
                  onClick={() => handlePredict()}
                  disabled={loading}
                  className="w-full border-2 border-emerald-600 text-emerald-600 py-2.5 rounded-xl font-semibold hover:bg-emerald-50 transition-all"
                >
                  Run Prediction
                </button>
              </div>
            </div>
          </div>

          {/* Middle Column: Results & AI */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <Wind className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Wind Speed</p>
                  <p className="text-xl font-bold">{weather ? weather.wind.speed : manualWind} <span className="text-sm font-normal text-slate-400">m/s</span></p>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                  <Thermometer className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Temperature</p>
                  <p className="text-xl font-bold">{weather ? weather.main.temp : manualTemp} <span className="text-sm font-normal text-slate-400">°C</span></p>
                </div>
              </div>
              <div className="glass rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                  <Gauge className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Air Density</p>
                  <p className="text-xl font-bold">{prediction ? prediction.details.airDensity : '1.225'} <span className="text-sm font-normal text-slate-400">kg/m³</span></p>
                </div>
              </div>
            </div>

            {/* Main Prediction Result */}
            <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-emerald-900/20">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Zap className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border border-emerald-500/30">Live Prediction</span>
                  {weather && <span className="text-slate-400 text-xs flex items-center gap-1"><Navigation className="w-3 h-3" /> {weather.name}</span>}
                </div>
                <h3 className="text-slate-400 font-medium mb-1">Estimated Energy Output</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black tracking-tighter">
                    {prediction ? prediction.predictedPower : '0.00'}
                  </span>
                  <span className="text-2xl font-bold text-emerald-400">kW</span>
                </div>
                
                <div className="mt-8 grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Turbine Efficiency</p>
                    <p className="text-lg font-semibold">{prediction ? prediction.details.efficiency : '0.0%'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Grid Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                      <p className="text-lg font-semibold">Optimal</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  AI Operational Insights
                </h3>
                {isAiLoading && <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>}
              </div>
              <p className="text-emerald-800/80 text-sm leading-relaxed italic">
                {aiInsight || "Run a prediction to generate real-time AI insights for your turbine operations."}
              </p>
            </div>

            {/* Chart */}
            <div className="glass rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-slate-800">24-Hour Power Forecast</h3>
                <div className="flex gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Power (kW)</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase"><div className="w-2 h-2 rounded-full bg-blue-400"></div> Wind (m/s)</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="time" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8'}}
                      interval={3}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fontSize: 10, fill: '#94a3b8'}}
                    />
                    <Tooltip 
                      contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="power" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPower)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="windSpeed" 
                      stroke="#60a5fa" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-500 text-sm">
          <div>
            <h4 className="font-bold text-slate-800 mb-3">About WindFlow</h4>
            <p className="leading-relaxed">Next-generation renewable energy management platform using advanced regression algorithms and real-time weather integration.</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-3">System Status</h4>
            <ul className="space-y-2">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> API Connection: Active</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Model Engine: v2.4.0</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Grid Sync: 99.9%</li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-3">Resources</h4>
            <div className="flex flex-wrap gap-2">
              <span className="bg-slate-100 px-3 py-1 rounded-full text-xs hover:bg-slate-200 cursor-pointer transition-colors">Documentation</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-xs hover:bg-slate-200 cursor-pointer transition-colors">API Keys</span>
              <span className="bg-slate-100 px-3 py-1 rounded-full text-xs hover:bg-slate-200 cursor-pointer transition-colors">Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
