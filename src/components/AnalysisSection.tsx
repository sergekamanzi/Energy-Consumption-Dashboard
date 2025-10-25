import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import type { Report } from '../types';
import { useState } from 'react';

interface AnalysisSectionProps {
  reports: Report[];
  isAdmin?: boolean;
}

interface RegionCount {
  [key: string]: number;
}

interface IncomeData {
  total: number;
  count: number;
}

interface IncomeConsumption {
  [key: string]: IncomeData;
}

interface ApplianceUsage {
  [key: string]: number;
}

interface ForecastData {
  month: string;
  predicted_consumption_kwh: number;
  predicted_bill_rwf: number;
  tariff_bracket: string;
  confidence: string;
}

interface TimeSeriesResponse {
  status: string;
  message: string;
  historical_data: number[];
  forecast_months: number;
  predictions: ForecastData[];
  total_forecasted_consumption: number;
  total_forecasted_bill: number;
  average_monthly_consumption: number;
  average_monthly_bill: number;
  trend: string;
  trend_percentage: number;
  model_used: string;
  forecast_id: string;
}

const AnalysisSection = ({ reports, isAdmin = false }: AnalysisSectionProps) => {
  const [showForecast, setShowForecast] = useState(false);
  const [forecastData, setForecastData] = useState<TimeSeriesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user has enough data for forecasting (at least 3 reports)
  const hasEnoughDataForForecast = reports.length >= 3;

  // Get user's historical consumption data for forecasting
  const getUserHistoricalData = () => {
    // Sort reports by timestamp (assuming they have timestamps) or use in order
    const sortedReports = [...reports].sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date();
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date();
      return dateA.getTime() - dateB.getTime();
    });
    
    return sortedReports.map(report => parseFloat(String(report.consumption)));
  };

  // Client-side fallback forecast (improved): uses linear regression trend, seasonality and noise
  const computeClientFallbackForecast = (historicalData: number[], monthsAhead: number = 3): TimeSeriesResponse => {
    const n = historicalData.length;
    const preds: number[] = [];

    // basic stats
    const mean = n ? historicalData.reduce((a, b) => a + b, 0) / n : 0;
    const variance = n ? historicalData.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n : 0;
    const stddev = Math.sqrt(variance || 0);

    // If no historical usage, return small non-zero baseline estimates
    if (n === 0 || mean === 0) {
      const baseline = 5; // small baseline kWh
      for (let i = 0; i < monthsAhead; i++) preds.push(baseline);
    } else {
      // linear regression for trend: x = 0..n-1, y = historicalData
      const xs = Array.from({ length: n }, (_, i) => i);
      const xMean = (n - 1) / 2;
      const cov = xs.reduce((acc, xi, i) => acc + (xi - xMean) * (historicalData[i] - mean), 0);
      const varX = xs.reduce((acc, xi) => acc + (xi - xMean) * (xi - xMean), 0) || 1;
      const slope = cov / varX;
      const intercept = mean - slope * xMean;

      // seasonality: if >=12 months, compute month-of-year average, otherwise small sinusoid
      let monthSeason: number[] | null = null;
      if (n >= 12) {
        monthSeason = new Array(12).fill(0).map(() => 0);
        const counts = new Array(12).fill(0);
        // assume historicalData corresponds to consecutive months ending now
        for (let i = 0; i < n; i++) {
          const monthIndex = (new Date().getMonth() - (n - 1 - i) + 12) % 12; // map to month index
          monthSeason[monthIndex] += historicalData[i];
          counts[monthIndex] += 1;
        }
        for (let m = 0; m < 12; m++) if (counts[m] > 0) monthSeason[m] = monthSeason[m] / counts[m];
      }

      for (let i = 0; i < monthsAhead; i++) {
        const t = n + i; // next time index
  const trendVal = intercept + slope * t;

        // seasonality factor
        let seasonalFactor = 1;
        if (monthSeason) {
          const futureMonth = (new Date().getMonth() + i + 1) % 12;
          const monthAvg = monthSeason[futureMonth] || mean;
          // scale seasonal factor relative to mean
          seasonalFactor = monthAvg / mean || 1;
        } else {
          seasonalFactor = 1 + 0.05 * Math.sin((t) * Math.PI / 6);
        }

        // add small noise based on historical stddev
        const noise = (stddev || Math.max(1, mean * 0.1)) * (Math.random() * 0.1 - 0.05);

        let val = Math.max(0, (trendVal * seasonalFactor) + noise);

        // If trend/regression yields non-sensible values, fallback to mean-based extrapolation
        if (!isFinite(val) || val <= 0) {
          val = mean * (1 + 0.02 * (i + 1));
        }

        // ensure not ridiculously small
        val = Math.max(val, Math.max(0.1, mean * 0.05));
        preds.push(parseFloat(val.toFixed(2)));
      }
    }

    // calculate bills using same tariff logic
    const billPreds = preds.map(p => {
      if (p <= 20) return p * 89;
      if (p <= 50) return 20 * 89 + (p - 20) * 310;
      return 20 * 89 + 30 * 310 + (p - 50) * 369;
    }).map(v => parseFloat(v.toFixed(2)));

    const now = new Date();
    const monthNames: string[] = [];
    for (let i = 0; i < monthsAhead; i++) {
      const future = new Date(now.getFullYear(), now.getMonth() + (i + 1), 1);
      monthNames.push(future.toLocaleString(undefined, { month: 'long', year: 'numeric' }));
    }

    const predictions: ForecastData[] = preds.map((p, i) => ({
      month: monthNames[i] || `Month ${i + 1}`,
      predicted_consumption_kwh: p,
      predicted_bill_rwf: billPreds[i],
      tariff_bracket: p <= 20 ? '0-20 kWh' : (p <= 50 ? '21-50 kWh' : '50+ kWh'),
      confidence: n >= 12 ? 'medium' : (n >= 6 ? 'low-medium' : 'low')
    }));

    const forecastAvg = preds.length ? preds.reduce((a, b) => a + b, 0) / preds.length : 0;
    const histAvg = n ? historicalData.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, n) : 0;
    const trend = forecastAvg > histAvg ? 'increasing' : 'decreasing';
    const trend_percentage = histAvg ? parseFloat((((forecastAvg - histAvg) / histAvg) * 100).toFixed(2)) : 0;

    return {
      status: 'success',
      message: 'Client-side fallback forecast used (regression + seasonality)',
      historical_data: historicalData.map(x => parseFloat(Number(x).toFixed(2))),
      forecast_months: monthsAhead,
      predictions: predictions,
      total_forecasted_consumption: parseFloat(preds.reduce((a, b) => a + b, 0).toFixed(2)),
      total_forecasted_bill: parseFloat(billPreds.reduce((a, b) => a + b, 0).toFixed(2)),
      average_monthly_consumption: parseFloat(forecastAvg.toFixed(2)),
      average_monthly_bill: parseFloat((billPreds.reduce((a, b) => a + b, 0) / (billPreds.length || 1)).toFixed(2)),
      trend: trend,
      trend_percentage: trend_percentage,
      model_used: 'client_fallback',
      forecast_id: 'local-' + String(Date.now()).slice(-6)
    };
  };

  const fetchForecast = async () => {
    if (isAdmin) {
      // Admins should not trigger forecast
      setShowForecast(false);
      setForecastData(null);
      setError(null);
      return;
    }
    if (!hasEnoughDataForForecast) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch timeseries model status to decide payload (avoid SARIMA if not available)
      let sarimaAvailable: boolean | undefined = undefined;
      try {
        const statusResp = await fetch('http://localhost:8000/api/timeseries/status');
        if (statusResp.ok) {
          const statusJson = await statusResp.json();
          sarimaAvailable = statusJson?.time_series_forecasting?.sarima_available;
        }
      } catch (statusErr) {
        console.warn('Could not fetch timeseries status, will proceed with default payload', statusErr);
      }

      const historicalData = getUserHistoricalData();

      const payload = {
        historical_data: historicalData,
        // include both keys some APIs expect one or the other
        months_ahead: 6,
        forecast_months: 6,
        household_info: reports[0]?.householdData || {},
        householdData: reports[0]?.householdData || {}
      };

      const finalPayload = sarimaAvailable === false ? { ...payload, model: 'auto' } : payload;

      console.debug('Forecast request payload:', finalPayload);

      const response = await fetch('http://localhost:8000/api/timeseries/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(finalPayload),
      });

      // If server returns non-OK, try to read its body for a helpful message
  if (!response.ok) {
        let serverMessage = '';
        try {
          const json = await response.json();
          serverMessage = json?.message || JSON.stringify(json);
        } catch {
          try {
            serverMessage = await response.text();
          } catch {
            serverMessage = `HTTP ${response.status}`;
          }
        }
        console.error('Forecast API error', response.status, serverMessage);

        // If SARIMA model is not available on server, attempt a single retry asking server to choose an alternative
        if (typeof serverMessage === 'string' && serverMessage.toLowerCase().includes('sarima')) {
          console.warn('SARIMA model not available — retrying forecast request with model:auto');
          try {
            const retryPayload = { ...payload, model: 'auto' };
            const retryResp = await fetch('http://localhost:8000/api/timeseries/forecast', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify(retryPayload),
            });

            if (retryResp.ok) {
              const retryData: TimeSeriesResponse = await retryResp.json();
              setForecastData(retryData);
              setShowForecast(true);
              return;
            }

            // read retry response message if available
            let retryMsg = '';
            try {
              const json = await retryResp.json();
              retryMsg = json?.message || JSON.stringify(json);
            } catch {
              try { retryMsg = await retryResp.text(); } catch { retryMsg = `HTTP ${retryResp.status}`; }
            }
            console.error('Retry forecast API error', retryResp.status, retryMsg);
            // fallback to client-side predictor instead of throwing
            const fallback = computeClientFallbackForecast(historicalData, 6);
            setForecastData(fallback);
            setShowForecast(true);
            return;
          } catch (retryErr) {
            // if retry failed, use client-side fallback
            console.error('Retry failed:', retryErr);
            const fallback = computeClientFallbackForecast(historicalData, 6);
            setForecastData(fallback);
            setShowForecast(true);
            return;
          }
        }
        // For other server messages, fallback to client-side predictor
        console.warn('Server returned error; using client-side fallback forecast', serverMessage);
        const fallback = computeClientFallbackForecast(historicalData, 6);
        setForecastData(fallback);
        setShowForecast(true);
        return;
      }

      const data: TimeSeriesResponse = await response.json();
      setForecastData(data);
      setShowForecast(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate forecast';
      setError(msg);
      console.error('Forecast error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getRegionData = () => {
    const regionCounts: RegionCount = {};
    reports.forEach(report => {
      const region = report.householdData?.region || 'Unknown';
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    });

    return Object.entries(regionCounts).map(([name, value]) => ({ name, value }));
  };

  const getIncomeData = () => {
    const incomeConsumption: IncomeConsumption = {};
    reports.forEach(report => {
      const income = report.householdData?.incomeLevel || 'Unknown';
      if (!incomeConsumption[income]) {
        incomeConsumption[income] = { total: 0, count: 0 };
      }
      incomeConsumption[income].total += parseFloat(String(report.consumption));
      incomeConsumption[income].count += 1;
    });

    return Object.entries(incomeConsumption).map(([name, data]) => ({
      name,
      avgConsumption: (data.total / data.count).toFixed(2)
    }));
  };

  const getConsumptionTrend = () => {
    return reports.map((report, index) => ({
      index: index + 1,
      consumption: parseFloat(String(report.consumption)),
      bill: parseFloat(String(report.bill))
    }));
  };

  const getTariffDistribution = () => {
    const tariffCounts: RegionCount = {};
    reports.forEach(report => {
      const tariff = report.tariffBracket || 'Unknown';
      tariffCounts[tariff] = (tariffCounts[tariff] || 0) + 1;
    });

    return Object.entries(tariffCounts).map(([name, value]) => ({ name, value }));
  };

  const getApplianceUsageData = () => {
    const applianceUsage: ApplianceUsage = {};
    
    reports.forEach(report => {
      if (report.appliances && Array.isArray(report.appliances)) {
        report.appliances.forEach(appliance => {
          const applianceName = appliance.name || 'Unknown Appliance';
          applianceUsage[applianceName] = (applianceUsage[applianceName] || 0) + 1;
        });
      }
    });

    // Sort by usage count (most to least)
    return Object.entries(applianceUsage)
      .map(([name, count]) => ({ 
        name, 
        count,
        percentage: ((count / reports.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count);
  };

  const COLORS = ['#2f8f4a', '#FF8C00', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFD700', '#9370DB', '#20B2AA', '#FF69B4', '#00CED1'];

  const regionData = getRegionData();
  const incomeData = getIncomeData();
  const trendData = getConsumptionTrend();
  const tariffData = getTariffDistribution();
  const applianceUsageData = getApplianceUsageData();

  const totalConsumption = reports.reduce((sum, r) => sum + parseFloat(String(r.consumption)), 0);
  const avgConsumption = reports.length > 0 ? (totalConsumption / reports.length).toFixed(2) : 0;
  const totalBill = reports.reduce((sum, r) => sum + parseFloat(String(r.bill)), 0);
  const avgBill = reports.length > 0 ? (totalBill / reports.length).toFixed(2) : 0;
  const averageHouseholdSizeValue = reports.length > 0
    ? reports.reduce((sum, r) => {
        const size = r.householdData?.householdSize;
        const numericSize = typeof size === 'number' ? size : Number(size ?? 0);
        return sum + (Number.isNaN(numericSize) ? 0 : numericSize);
      }, 0) / reports.length
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-orange-500">Energy Analysis</h1>
        <p className="text-black mt-2">Statistical insights and visualizations</p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white p-12 rounded-lg border-2 border-darkgreen-500 text-center">
          <p className="text-xl text-black">No reports available for analysis.</p>
          <p className="text-sm text-black mt-2">Generate predictions to see analytics here.</p>
        </div>
      ) : (
        <>
          {/* Forecast Button Section */}
          {!isAdmin && (
            <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-orange-500 mb-2">Future Energy Patterns</h2>
                  <p className="text-black">
                    {hasEnoughDataForForecast 
                      ? `You have ${reports.length} energy usage records. Predict your future consumption patterns.`
                      : `You need at least 3 energy usage records to predict future patterns. You have ${reports.length}.`
                    }
                  </p>
                </div>
                <button
                  onClick={fetchForecast}
                  disabled={!hasEnoughDataForForecast || isLoading}
                  className={`px-6 py-3 rounded-none font-semibold transition-all ${
                    hasEnoughDataForForecast 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Predicting...
                    </div>
                  ) : (
                    '🔮 Predict Future Usage'
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Forecast Results (Household Users only) */}
          {!isAdmin && showForecast && forecastData && (
            <div className="bg-white p-6 rounded-lg border-2 border-purple-500">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-purple-500">Future Energy Forecast</h2>
                <button
                  onClick={() => setShowForecast(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="text-sm text-purple-600 mb-1">Forecast Period</h3>
                  <p className="text-xl font-bold text-purple-700">{forecastData.forecast_months} months</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-sm text-green-600 mb-1">Avg Monthly Usage</h3>
                  <p className="text-xl font-bold text-green-700">{forecastData.average_monthly_consumption} kWh</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <h3 className="text-sm text-orange-600 mb-1">Avg Monthly Bill</h3>
                  <p className="text-xl font-bold text-orange-700">{forecastData.average_monthly_bill.toFixed(0)} RWF</p>
                </div>
                <div className={`p-4 rounded-lg border ${
                  forecastData.trend === 'increasing' 
                    ? 'bg-red-50 border-red-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  <h3 className={`text-sm mb-1 ${
                    forecastData.trend === 'increasing' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    Trend
                  </h3>
                  <p className={`text-xl font-bold ${
                    forecastData.trend === 'increasing' ? 'text-red-700' : 'text-blue-700'
                  }`}>
                    {forecastData.trend} ({forecastData.trend_percentage.toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Forecast Chart */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Monthly Forecast</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={forecastData.predictions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#6b7280"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="#10b981"
                      label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      stroke="#f59e0b"
                      label={{ value: 'RWF', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number, name: string) => {
                        const key = String(name || '').toLowerCase();
                        const isConsumption = key.includes('consum') || key.includes('kwh');
                        const display = isConsumption ? `${value} kWh` : `${Number(value).toFixed(0)} RWF`;
                        const label = isConsumption ? 'Consumption (kWh)' : 'Bill (RWF)';
                        return [display, label];
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="predicted_consumption_kwh" 
                      stroke="#10b981" 
                      strokeWidth={3}
                      name="Consumption (kWh)"
                      dot={{ fill: '#10b981', r: 4 }}
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="predicted_bill_rwf" 
                      stroke="#f59e0b" 
                      strokeWidth={3}
                      name="Bill (RWF)"
                      dot={{ fill: '#f59e0b', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Forecast Table */}
              <div className="overflow-x-auto">
                <h3 className="text-lg font-semibold text-black mb-4">Detailed Forecast</h3>
                <table className="w-full text-sm text-left text-gray-700">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Consumption (kWh)</th>
                      <th className="px-4 py-3">Bill (RWF)</th>
                      <th className="px-4 py-3">Tariff Bracket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastData.predictions.map((prediction, index) => (
                      <tr key={index} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{prediction.month}</td>
                        <td className="px-4 py-3">{prediction.predicted_consumption_kwh.toFixed(1)}</td>
                        <td className="px-4 py-3">{prediction.predicted_bill_rwf.toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            prediction.tariff_bracket === '0-20 kWh' 
                              ? 'bg-green-100 text-green-800'
                              : prediction.tariff_bracket === '21-50 kWh'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {prediction.tariff_bracket}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Historical Context */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Historical Context</h4>
                <p className="text-sm text-blue-700">
                  Based on your last {forecastData.historical_data.length} months of usage: {forecastData.historical_data.map(d => d.toFixed(1)).join(' kWh, ')} kWh
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Model used: {forecastData.model_used} • Forecast ID: {forecastData.forecast_id}
                </p>
              </div>
            </div>
          )}

          {/* Original Analytics Content */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
              <h3 className="text-sm text-black mb-2">Total Reports</h3>
              <p className="text-3xl font-bold text-darkgreen-500">{reports.length}</p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
              <h3 className="text-sm text-black mb-2">Avg Consumption</h3>
              <p className="text-3xl font-bold text-orange-500">{avgConsumption} kWh</p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
              <h3 className="text-sm text-black mb-2">Total Consumption</h3>
              <p className="text-3xl font-bold text-darkgreen-500">{totalConsumption.toFixed(2)} kWh</p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
              <h3 className="text-sm text-black mb-2">Avg Bill</h3>
              <p className="text-3xl font-bold text-orange-500">{avgBill} RWF</p>
            </div>
          </div>

          {isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
                <h2 className="text-xl font-bold text-darkgreen-500 mb-4">Households by Region</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: PieLabelRenderProps) => {
                        const name = props.name ?? 'Unknown';
                        const rawPercent = typeof props.percent === 'number' ? props.percent : Number(props.percent ?? 0);
                        return `${name}: ${(rawPercent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {regionData.map((entry, index) => (
                        <Cell key={entry.name ?? `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#8884d8', border: '1px solid #2f8f4a' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
                <h2 className="text-xl font-bold text-orange-500 mb-4">Tariff Bracket Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tariffData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: PieLabelRenderProps) => {
                        const name = props.name ?? 'Unknown';
                        const rawPercent = typeof props.percent === 'number' ? props.percent : Number(props.percent ?? 0);
                        return `${name}: ${(rawPercent * 100).toFixed(0)}%`;
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {tariffData.map((entry, index) => (
                        <Cell key={entry.name ?? `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#8884d8', border: '1px solid #FF8C00' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
                <h2 className="text-xl font-bold text-darkgreen-500 mb-4">Appliances Usage (You)</h2>
                <p className="text-black text-sm mb-4">Your appliance usage distribution across reports</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={applianceUsageData.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis type="number" stroke="#2f8f4a" />
                    <YAxis type="category" dataKey="name" stroke="#2f8f4a" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a' }} />
                    <Bar dataKey="count" fill="#2f8f4a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
                <h2 className="text-xl font-bold text-orange-500 mb-4">Appliance % Share</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={applianceUsageData.slice(0, 8).map(a => ({ name: a.name, value: Number(a.percentage), count: a.count }))} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="name" stroke="#2f8f4a" angle={-45} textAnchor="end" interval={0} height={60} />
                    <YAxis stroke="#2f8f4a" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a' }} formatter={(val: number | string, name?: string | number) => {
                      const label = String(name ?? '');
                      return [val, label === 'value' ? 'Percentage' : label] as [string | number, string | number];
                    }} />
                    <Bar dataKey="value" fill="#F59E0B" name="% Share" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* New Appliance Usage Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
              <h2 className="text-xl font-bold text-darkgreen-500 mb-4">Most Common Appliances</h2>
              <p className="text-black text-sm mb-4">Appliances used by households (most to least common)</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={applianceUsageData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis type="number" stroke="#2f8f4a" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#2f8f4a"
                    width={90}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2f8f4a' }}
                    formatter={(value: number | string, name?: string | number) => {
                      const key = String(name ?? '');
                      if (key === 'count') return [`${value} households`, 'Usage Count'] as [string, string];
                      return [value, key] as [string | number, string | number];
                    }}
                    labelFormatter={(label) => `Appliance: ${label}`}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    name="Number of Households"
                    fill="#FF8C00"
                    radius={[0, 4, 4, 0]}
                  >
                    {applianceUsageData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
              <h2 className="text-xl font-bold text-orange-500 mb-4">Appliance Usage Distribution</h2>
              <p className="text-black text-sm mb-4">Count of households using each appliance (top 8)</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={applianceUsageData.slice(0, 8).map(a => ({ name: a.name, count: a.count, pct: Number(a.percentage) }))} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" stroke="#00FF7F" angle={-45} textAnchor="end" interval={0} height={80} />
                  <YAxis stroke="#00FF7F" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FF8C00' }} formatter={(val: number | string, key?: string | number) => [val, String(key ?? '')] as [string | number, string]} />
                  <Legend />
                  <Bar dataKey="count" fill="#8884d8" name="Household Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
              <h2 className="text-xl font-bold text-darkgreen-500 mb-4">Average Consumption by Income Level</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={incomeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" stroke="#2f8f4a" />
                  <YAxis stroke="#2f8f4a" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #2f8f4a' }} />
                  <Legend />
                  <Bar dataKey="avgConsumption" fill="#FF8C00" name="Avg Consumption (kWh)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg border-2 border-orange-500">
            <h2 className="text-xl font-bold text-orange-500 mb-4">Consumption & Bill Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="index" stroke="#FF8C00" label={{ value: 'Report #', position: 'insideBottom', offset: -5 }} />
                <YAxis yAxisId="left" stroke="#00FF7F" label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#FF8C00" label={{ value: 'RWF', angle: 90, position: 'insideRight' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FF8C00' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="consumption" stroke="#00FF7F" strokeWidth={2} name="Consumption (kWh)" />
                <Line yAxisId="right" type="monotone" dataKey="bill" stroke="#FF8C00" strokeWidth={2} name="Bill (RWF)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border-2 border-darkgreen-500">
              <h2 className="text-xl font-bold text-darkgreen-500 mb-4">Key Statistics</h2>
              <div className="space-y-4">
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Highest Consumption:</span>
                  <span className="font-bold text-darkgreen-500">
                    {Math.max(...reports.map(r => parseFloat(String(r.consumption)))).toFixed(2)} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Lowest Consumption:</span>
                  <span className="font-bold text-darkgreen-500">
                    {Math.min(...reports.map(r => parseFloat(String(r.consumption)))).toFixed(2)} kWh
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Highest Bill:</span>
                  <span className="font-bold text-orange-500">
                    {Math.max(...reports.map(r => parseFloat(String(r.bill)))).toFixed(2)} RWF
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Lowest Bill:</span>
                  <span className="font-bold text-orange-500">
                    {Math.min(...reports.map(r => parseFloat(String(r.bill)))).toFixed(2)} RWF
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Most Common Appliance:</span>
                  <span className="font-bold text-darkgreen-500">
                    {applianceUsageData[0]?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-gray-50 rounded">
                  <span className="text-black">Total Unique Appliances:</span>
                  <span className="font-bold text-orange-500">
                    {applianceUsageData.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg border-2 border-orange-500">
              <h2 className="text-xl font-bold text-orange-500 mb-4">Insights</h2>
              <div className="space-y-3">
                {isAdmin ? (
                  <>
                    <div className="p-4 bg-darkgreen-900 border border-darkgreen-500 rounded">
                      <p className="text-sm">
                        <strong className="text-darkgreen-400">Most Common Region:</strong>{' '}
                        <span className="text-white">{regionData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-orange-900 border border-orange-500 rounded">
                      <p className="text-sm">
                        <strong className="text-orange-400">Average Household Size:</strong>{' '}
                        <span className="text-white">{averageHouseholdSizeValue !== null
                          ? averageHouseholdSizeValue.toFixed(1)
                          : 'N/A'}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-darkgreen-900 border border-darkgreen-500 rounded">
                      <p className="text-sm">
                        <strong className="text-darkgreen-400">Most Common Tariff:</strong>{' '}
                        <span className="text-white">{tariffData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-orange-900 border border-orange-500 rounded">
                      <p className="text-sm">
                        <strong className="text-orange-400">Top 3 Appliances:</strong>{' '}
                        <span className="text-white">{applianceUsageData.slice(0, 3).map(app => app.name).join(', ') || 'N/A'}</span>
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-darkgreen-900 border border-darkgreen-500 rounded">
                      <p className="text-sm">
                        <strong className="text-darkgreen-400">Top Appliances (You):</strong>{' '}
                        <span className="text-white">{applianceUsageData.slice(0, 3).map(app => app.name).join(', ') || 'N/A'}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-orange-900 border border-orange-500 rounded">
                      <p className="text-sm">
                        <strong className="text-orange-400">Estimated Monthly Bill (avg):</strong>{' '}
                        <span className="text-white">{reports.length > 0 ? (totalBill / reports.length).toFixed(2) : 'N/A'} RWF</span>
                      </p>
                    </div>
                    <div className="p-4 bg-darkgreen-900 border border-darkgreen-500 rounded">
                      <p className="text-sm">
                        <strong className="text-darkgreen-400">Most Expensive Appliance:</strong>{' '}
                        <span className="text-white">{(() => {
                          // Find appliance with highest average bill share
                          const applianceBills: Record<string, number[]> = {};
                          reports.forEach(r => {
                            r.appliances?.forEach(a => {
                              applianceBills[a.name] = applianceBills[a.name] || [];
                              applianceBills[a.name].push(parseFloat(String(a.bill)));
                            });
                          });
                          const averages = Object.entries(applianceBills).map(([name, arr]) => ({ name, avg: arr.reduce((s, v) => s + v, 0) / arr.length }));
                          return averages.sort((a, b) => b.avg - a.avg)[0]?.name || 'N/A';
                        })()}</span>
                      </p>
                    </div>
                    <div className="p-4 bg-orange-900 border border-orange-500 rounded">
                      <p className="text-sm">
                        <strong className="text-orange-400">Unique Appliances you use:</strong>{' '}
                        <span className="text-white">{applianceUsageData.length}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisSection;