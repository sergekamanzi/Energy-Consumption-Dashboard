import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
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
  const [topN, setTopN] = useState<number>(8);
  const [smoothTrend, setSmoothTrend] = useState<boolean>(true);
  const [sortKey, setSortKey] = useState<'month' | 'consumption' | 'bill' | 'tariff' | 'confidence'>('month');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // formatters
  const formatKWh = (v: number | string) => `${Number(v).toFixed(1)} kWh`;
  const formatRWF = (v: number | string) => `${Number(v).toFixed(0)} RWF`;
  
  type TrendPoint = { index: number; consumption: number; bill: number; consumption_smoothed?: number; bill_smoothed?: number };

  const handleSort = (key: 'month' | 'consumption' | 'bill' | 'tariff' | 'confidence') => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleExportForecastCsv = () => {
    if (!forecastData) return;
    const header = ['#','Month','Consumption (kWh)','Bill (RWF)','Tariff Bracket','Confidence'];
    const rows = forecastData.predictions.map((p, i) => [
      String(i + 1),
      p.month,
      p.predicted_consumption_kwh.toFixed(1),
      p.predicted_bill_rwf.toFixed(0),
      p.tariff_bracket,
      p.confidence,
    ]);
    const totalCons = forecastData.predictions.reduce((s, p) => s + p.predicted_consumption_kwh, 0);
    const totalBill = forecastData.predictions.reduce((s, p) => s + p.predicted_bill_rwf, 0);
    rows.push(['', 'TOTAL', totalCons.toFixed(1), totalBill.toFixed(0), '', '']);

    const csv = [header, ...rows].map(r => r.map(cell => {
      const needsQuote = /[",\n]/.test(cell);
      const c = cell.replace(/"/g, '""');
      return needsQuote ? `"${c}"` : c;
    }).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forecast_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
  const computeClientFallbackForecast = (historicalData: number[], monthsAhead: number = 2): TimeSeriesResponse => {
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
        months_ahead: 2,
        forecast_months: 2,
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
            const fallback = computeClientFallbackForecast(historicalData, 2);
            setForecastData(fallback);
            setShowForecast(true);
            return;
          } catch (retryErr) {
            // if retry failed, use client-side fallback
            console.error('Retry failed:', retryErr);
            const fallback = computeClientFallbackForecast(historicalData, 2);
            setForecastData(fallback);
            setShowForecast(true);
            return;
          }
        }
        // For other server messages, fallback to client-side predictor
        console.warn('Server returned error; using client-side fallback forecast', serverMessage);
        const fallback = computeClientFallbackForecast(historicalData, 2);
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

  // 3-point moving average for smoother trend
  const movingAverage = (data: { index: number; consumption: number; bill: number }[], key: 'consumption' | 'bill') => {
    const arr = data.map(d => d[key]);
    const smoothed: number[] = arr.map((_, i) => {
      const windowVals = arr.slice(Math.max(0, i - 1), Math.min(arr.length, i + 2));
      const avg = windowVals.reduce((s, v) => s + v, 0) / windowVals.length;
      return parseFloat(avg.toFixed(2));
    });
    return data.map((d, i) => ({ ...d, [`${key}_smoothed`]: smoothed[i] })) as TrendPoint[];
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

  const trendWithSmoothing: TrendPoint[] | { index: number; consumption: number; bill: number }[] = smoothTrend
    ? movingAverage(movingAverage(trendData, 'consumption'), 'bill')
    : trendData;

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
                  className={`px-6 py-3 rounded-none font-semibold ${
                    hasEnoughDataForForecast 
                      ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg'
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Detailed Forecast</h3>
                  <button onClick={handleExportForecastCsv} className="px-3 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800">Export CSV</button>
                </div>
                {(() => {
                  const baseRows = forecastData.predictions.map((p, i) => ({
                    idx: i + 1,
                    month: p.month,
                    consumption: p.predicted_consumption_kwh,
                    bill: p.predicted_bill_rwf,
                    tariff: p.tariff_bracket,
                    confidence: p.confidence,
                  }));
                  const rows = [...baseRows].sort((a, b) => {
                    let comp = 0;
                    if (sortKey === 'month') comp = a.idx - b.idx; // keep original sequence
                    if (sortKey === 'consumption') comp = a.consumption - b.consumption;
                    if (sortKey === 'bill') comp = a.bill - b.bill;
                    if (sortKey === 'tariff') comp = a.tariff.localeCompare(b.tariff);
                    if (sortKey === 'confidence') comp = a.confidence.localeCompare(b.confidence);
                    return sortDir === 'asc' ? comp : -comp;
                  });
                  const totalCons = rows.reduce((s, r) => s + r.consumption, 0);
                  const totalBill = rows.reduce((s, r) => s + r.bill, 0);
                  const arrow = (key: typeof sortKey) => sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '';

                  return (
                    <table className="w-full text-sm text-left text-gray-700">
                      <thead className="text-xs uppercase text-gray-600 bg-white sticky top-0 z-10 border-b">
                        <tr>
                          <th className="px-4 py-3 w-10">#</th>
                          <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('month')}>Month <span className="ml-1 text-gray-400">{arrow('month')}</span></th>
                          <th className="px-4 py-3 cursor-pointer select-none text-right" onClick={() => handleSort('consumption')}>Consumption (kWh) <span className="ml-1 text-gray-400">{arrow('consumption')}</span></th>
                          <th className="px-4 py-3 cursor-pointer select-none text-right" onClick={() => handleSort('bill')}>Bill (RWF) <span className="ml-1 text-gray-400">{arrow('bill')}</span></th>
                          <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('tariff')}>Tariff Bracket <span className="ml-1 text-gray-400">{arrow('tariff')}</span></th>
                          <th className="px-4 py-3 cursor-pointer select-none" onClick={() => handleSort('confidence')}>Confidence <span className="ml-1 text-gray-400">{arrow('confidence')}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={`${r.idx}-${r.month}`} className="odd:bg-white even:bg-gray-50 hover:bg-gray-100 border-b last:border-0">
                            <td className="px-4 py-3 text-gray-500">{r.idx}</td>
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.month}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{r.consumption.toFixed(1)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{r.bill.toFixed(0)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                r.tariff === '0-20 kWh' ? 'bg-green-100 text-green-800' : r.tariff === '21-50 kWh' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {r.tariff}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{r.confidence}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-white">
                          <td className="px-4 py-3" colSpan={2}><span className="text-gray-600">Totals</span></td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalCons.toFixed(1)} kWh</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalBill.toFixed(0)} RWF</td>
                          <td className="px-4 py-3" colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                })()}
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

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl shadow border border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Total Reports</h3>
              <p className="text-3xl font-extrabold text-gray-900">{reports.length}</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow border border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Avg Consumption</h3>
              <p className="text-3xl font-extrabold text-emerald-600">{avgConsumption} kWh</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow border border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Total Consumption</h3>
              <p className="text-3xl font-extrabold text-gray-900">{totalConsumption.toFixed(2)} kWh</p>
            </div>
            <div className="bg-white p-5 rounded-xl shadow border border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Avg Bill</h3>
              <p className="text-3xl font-extrabold text-orange-600">{avgBill} RWF</p>
            </div>
          </div>

          {isAdmin ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Households by Region</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={regionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      labelLine={false}
                      dataKey="value"
                    >
                      {regionData.map((entry, index) => (
                        <Cell key={entry.name ?? `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(val: ValueType, name: NameType) => [val as string | number, String(name ?? 'Region')]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Tariff Bracket Distribution</h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={tariffData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      labelLine={false}
                      dataKey="value"
                    >
                      {tariffData.map((entry, index) => (
                        <Cell key={entry.name ?? `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(val: ValueType, name: NameType) => [val as string | number, String(name ?? 'Tariff')]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">Appliances Usage (You)</h2>
                  <div className="flex items-center gap-2 text-sm">
                    <label className="text-gray-500">Top</label>
                    <select className="border border-gray-200 rounded px-2 py-1 text-gray-700" value={topN} onChange={e => setTopN(Number(e.target.value))}>
                      {[5,8,10,12,15].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-4">Your appliance usage distribution across reports</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={applianceUsageData.slice(0, topN)} margin={{ left: 10, right: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" interval={0} height={60} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(v: number) => [`${v} reports`, 'Usage']} />
                    <Bar dataKey="count" fill="#10b981" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Appliance % Share</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={applianceUsageData.slice(0, topN).map(a => ({ name: a.name, value: Number(a.percentage) }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      labelLine={false}
                      dataKey="value"
                      label={({ name, percent }) => {
                        const p = typeof percent === 'number' ? percent : Number(percent ?? 0);
                        return `${name}: ${(p * 100).toFixed(0)}%`;
                      }}
                    >
                      {applianceUsageData.slice(0, topN).map((_, index) => (
                        <Cell key={`appliance-donut-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(val: ValueType, name: NameType) => [`${val}%`, String(name ?? '% Share')]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* New Appliance Usage Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Most Common Appliances</h2>
              <p className="text-gray-500 text-sm mb-4">Appliances used by households (most to least common)</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={applianceUsageData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#6b7280"
                    width={110}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }}
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
                    fill="#6366f1"
                    radius={[0, 6, 6, 0]}
                  >
                    {applianceUsageData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Appliance Usage Distribution</h2>
              <p className="text-gray-500 text-sm mb-4">Count of households using each appliance (top {topN})</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={applianceUsageData.slice(0, 8).map(a => ({ name: a.name, count: a.count, pct: Number(a.percentage) }))} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" interval={0} height={80} />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(val: number | string, key?: string | number) => [val, String(key ?? '')] as [string | number, string]} />
                  <Legend />
                  <Bar dataKey="count" fill="#10b981" name="Household Count" radius={[6,6,0,0]} />
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

          <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Consumption & Bill Trend</h2>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded" checked={smoothTrend} onChange={e => setSmoothTrend(e.target.checked)} />
                Smooth lines
              </label>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trendWithSmoothing}>
                <defs>
                  <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="colorBill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="index" stroke="#6b7280" label={{ value: 'Report #', position: 'insideBottom', offset: -5 }} />
                <YAxis yAxisId="left" stroke="#10b981" label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" label={{ value: 'RWF', angle: 90, position: 'insideRight' }} />
                <Tooltip contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: 8 }} formatter={(value: number, name: string) => {
                  const key = String(name || '').toLowerCase();
                  const isConsumption = key.includes('consum');
                  return [isConsumption ? formatKWh(value) : formatRWF(value), isConsumption ? 'Consumption' : 'Bill'];
                }} />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey={smoothTrend ? 'consumption_smoothed' : 'consumption'} stroke="#10b981" fill="url(#colorCons)" name="Consumption (kWh)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey={smoothTrend ? 'bill_smoothed' : 'bill'} stroke="#f59e0b" fill="url(#colorBill)" name="Bill (RWF)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Statistics: Professional table style */}
            <div className="rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="bg-gray-100 px-6 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Key Statistics</div>
              {isAdmin ? (
                <div className="p-6 text-sm text-gray-700">
                  {/* Keep admin simple; household gets table below */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-gray-600">Highest Consumption</div>
                      <div className="text-gray-900 font-semibold">{Math.max(...reports.map(r => parseFloat(String(r.consumption)))).toFixed(2)} <span className="text-gray-500 text-xs align-top">kWh</span></div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded">
                      <div className="text-gray-600">Highest Bill</div>
                      <div className="text-gray-900 font-semibold">{Math.max(...reports.map(r => parseFloat(String(r.bill)))).toFixed(2)} <span className="text-gray-500 text-xs align-top">RWF</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <table className="min-w-full text-sm text-gray-700">
                  <thead>
                    <tr className="text-xs uppercase text-gray-600 bg-white border-b">
                      <th className="px-6 py-3 text-left">Metric</th>
                      <th className="px-6 py-3 text-left">Value</th>
                      <th className="px-6 py-3 text-left">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Highest Consumption</td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">{Math.max(...reports.map(r => parseFloat(String(r.consumption)))).toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-500">kWh</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Lowest Consumption</td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">{Math.min(...reports.map(r => parseFloat(String(r.consumption)))).toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-500">kWh</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Highest Bill</td>
                      <td className="px-6 py-4 font-semibold text-orange-600">{Math.max(...reports.map(r => parseFloat(String(r.bill)))).toFixed(0)}</td>
                      <td className="px-6 py-4 text-gray-500">RWF</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Lowest Bill</td>
                      <td className="px-6 py-4 font-semibold text-orange-600">{Math.min(...reports.map(r => parseFloat(String(r.bill)))).toFixed(0)}</td>
                      <td className="px-6 py-4 text-gray-500">RWF</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Most Common Appliance</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{applianceUsageData[0]?.name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">—</td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Total Unique Appliances</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{applianceUsageData.length}</td>
                      <td className="px-6 py-4 text-gray-500">items</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-6 py-3 text-xs text-gray-500" colSpan={3}>
                        <div className="flex items-center justify-between">
                          <span>1–6 of 6</span>
                          <div className="flex items-center gap-3">
                            <span>Rows per page: 6</span>
                            <div className="flex items-center gap-1">
                              <button className="px-2 py-1 rounded border border-gray-200 text-gray-500" aria-label="Previous" disabled>{'<'}</button>
                              <span>1/1</span>
                              <button className="px-2 py-1 rounded border border-gray-200 text-gray-500" aria-label="Next" disabled>{'>'}</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* Insights: Professional table style for household; retain admin content */}
            <div className="rounded-xl shadow border border-gray-100 overflow-hidden">
              <div className="bg-gray-100 px-6 py-3 text-xs uppercase tracking-wide text-gray-600 font-semibold">Insights</div>
              {isAdmin ? (
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-700">Most Common Region</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{regionData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-700">Average Household Size</span>
                    <span className="text-gray-900 font-semibold">{averageHouseholdSizeValue !== null ? averageHouseholdSizeValue.toFixed(1) : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-700">Most Common Tariff</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{tariffData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-gray-700">Top 3 Appliances</span>
                    <span className="text-gray-900 font-semibold">{applianceUsageData.slice(0, 3).map(app => app.name).join(', ') || 'N/A'}</span>
                  </div>
                </div>
              ) : (
                <table className="min-w-full text-sm text-gray-700">
                  <thead>
                    <tr className="text-xs uppercase text-gray-600 bg-white border-b">
                      <th className="px-6 py-3 text-left">Insight</th>
                      <th className="px-6 py-3 text-left">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Top Appliances (You)</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {applianceUsageData.slice(0, 3).map(app => (
                            <span key={app.name} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{app.name}</span>
                          ))}
                          {applianceUsageData.length === 0 && <span className="text-gray-500">N/A</span>}
                        </div>
                      </td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Estimated Monthly Bill (avg)</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{reports.length > 0 ? (totalBill / reports.length).toFixed(2) : 'N/A'} <span className="text-gray-500 text-xs align-top">RWF</span></td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Most Expensive Appliance</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{(() => {
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
                      </td>
                    </tr>
                    <tr className="odd:bg-white even:bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4">Unique Appliances you use</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{applianceUsageData.length}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-6 py-3 text-xs text-gray-500" colSpan={2}>
                        <div className="flex items-center justify-between">
                          <span>1–4 of 4</span>
                          <div className="flex items-center gap-3">
                            <span>Rows per page: 4</span>
                            <div className="flex items-center gap-1">
                              <button className="px-2 py-1 rounded border border-gray-200 text-gray-500" aria-label="Previous" disabled>{'<'}</button>
                              <span>1/1</span>
                              <button className="px-2 py-1 rounded border border-gray-200 text-gray-500" aria-label="Next" disabled>{'>'}</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalysisSection;