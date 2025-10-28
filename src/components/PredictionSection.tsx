import { useState } from 'react';
import { Plus, Trash2, Zap, Loader2, AlertCircle, Brain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface Appliance {
  id?: number;
  name: string;
  power: string | number;
  hours: string | number;
  quantity: number;
  usageDays: number;
}

interface HouseholdData {
  region: string;
  incomeLevel: string;
  householdSize: string;
  monthlyBudget: string;
}

interface PredictionAppliance {
  name: string;
  consumption: string;
  bill: string;
  percentage: string;
  powerWatts: number;
}

export interface Predictions {
  id: string;
  consumption: string;
  bill: string;
  tariffBracket: string;
  budgetStatus: string;
  budgetDifference: number;
  message: string;
  appliances: PredictionAppliance[];
  householdData: HouseholdData;
  timestamp: string;
  total_kwh: number;
  total_bill: number;
  report_id: string;
  ai_recommendations?: AIRecommendation[];
}

interface PredictionResponse {
  total_kwh: number;
  total_bill: number;
  tariff_bracket: string;
  budget_status: string;
  budget_difference: number;
  message: string;
  breakdown: Array<{
    appliance: string;
    estimated_kwh: number;
    estimated_bill: number;
    percentage: number;
    power_watts: number;
  }>;
  report_id: string;
  status: string;
  ai_recommendations: AIRecommendation[];
  model_used: string;
}

interface ApiStatus {
  status: string;
  message?: string;
  model_loaded?: boolean;
}

interface ModelStatus {
  loaded?: boolean;
  ready?: boolean;
}

interface ApiStatus {
  status: string;
  message?: string;
  model_loaded?: boolean;
  models?: {
    supervised?: ModelStatus;
  };
}

interface PredictionSectionProps {
  onGenerateReport?: (data: Predictions) => void;
  ownerId?: string;
}

interface RecommendationRow {
  appliance: string;
  power: number;
  currentHours: number;
  currentDays: number;
  recommendedHours: number;
  recommendedDays: number;
  currentBill: number;
  recommendedBill: number;
  savings: number;
  tip: string;
}

// AI Recommendation Types
interface AIRecommendation {
  type: string;
  suggestion?: string;
  title?: string;
  savings_estimate: number;
  cost_estimate: number;
  priority: string;
  confidence_score: number;
  ai_insights?: {
    efficiency_gain_percent?: number;
    payback_period_months?: number;
    annual_savings?: number;
    environmental_impact?: string;
    smart_tip?: string;
    special_advice?: string;
    behavioral_impact?: string;
    smart_scheduling?: string;
    tariff_advantage?: string;
  };
  total_potential_savings_kwh?: number;
  total_potential_savings_money?: number;
  total_implementation_cost?: number;
  roi_months?: number;
  recommendation_engine?: string;
  number_of_recommendations?: number;
}

const PredictionSection = ({ onGenerateReport, ownerId }: PredictionSectionProps) => {
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [currentAppliance, setCurrentAppliance] = useState<Appliance>({
    name: '',
    power: '',
    hours: '',
    quantity: 1,
    usageDays: 30
  });
  const [householdData, setHouseholdData] = useState<HouseholdData>({
    region: '',
    incomeLevel: '',
    householdSize: '',
    monthlyBudget: ''
  });
  const [predictions, setPredictions] = useState<Predictions | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [showAIRecommendations, setShowAIRecommendations] = useState(false);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);

  // API Configuration
  const API_BASE_URL = 'http://127.0.0.1:8000'; // FastAPI (AI model)
  const BACKEND_BASE_URL = 'http://localhost:4000/api'; // Node/Express + MongoDB

  const addAppliance = () => {
    if (currentAppliance.name && currentAppliance.power && currentAppliance.hours) {
      setAppliances([...appliances, { ...currentAppliance, id: Date.now() }]);
      setCurrentAppliance({
        name: '',
        power: '',
        hours: '',
        quantity: 1,
        usageDays: 30
      });
    }
  };

  const removeAppliance = (id: number) => {
    setAppliances(appliances.filter(a => a.id !== id));
  };

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();
      setApiStatus(data);
      return data.models?.supervised?.loaded || false;
    } catch {
      setApiStatus({ status: 'offline', message: 'Cannot connect to API server' });
      return false;
    }
  };

  const calculatePredictions = async () => {
    if (!householdData.region || !householdData.incomeLevel || !householdData.householdSize || !householdData.monthlyBudget) {
      setError('Please fill in all household details');
      return;
    }

    if (appliances.length === 0) {
      setError('Please add at least one appliance');
      return;
    }

  setIsLoading(true);
    setError(null);
  // mark that we're starting a new generation attempt
  setHasGeneratedReport(false);

    try {
      // Check API health first
      await checkApiHealth();

      // Prepare request payload for FastAPI
      const requestPayload = {
        appliances: appliances.map(app => ({
          appliance: app.name,
          power: Number(app.power),
          power_unit: 'W',
          hours: Number(app.hours),
          quantity: Number(app.quantity),
          usage_days_monthly: Number(app.usageDays)
        })),
        household_info: {
          region: householdData.region,
          income_level: householdData.incomeLevel,
          household_size: Number(householdData.householdSize),
          budget: Number(householdData.monthlyBudget)
        }
      };

      // Call FastAPI prediction endpoint
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || `API Error: ${response.status} ${response.statusText}`);
      }

  const result: PredictionResponse = await response.json();

      // Transform API response to match our UI format
      const predictionData: Predictions = {
        id: result.report_id,
        consumption: result.total_kwh.toFixed(2),
        bill: result.total_bill.toFixed(2),
        tariffBracket: result.tariff_bracket,
        budgetStatus: result.budget_status,
        budgetDifference: result.budget_difference,
        message: result.message,
        appliances: result.breakdown.map(item => ({
          name: item.appliance,
          consumption: item.estimated_kwh.toFixed(2),
          bill: item.estimated_bill.toFixed(2),
          percentage: item.percentage.toFixed(1),
          powerWatts: item.power_watts
        })),
        householdData,
        timestamp: new Date().toISOString(),
        total_kwh: result.total_kwh,
        total_bill: result.total_bill,
        report_id: result.report_id,
        ai_recommendations: result.ai_recommendations
      };

      setPredictions(predictionData);

      // Persist to backend (MongoDB): saves to predictions and also auto-creates a report snapshot
      try {
        await fetch(`${BACKEND_BASE_URL}/predictions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...predictionData, ownerId })
        });
      } catch (saveErr) {
        console.warn('Failed to save prediction/report to backend:', saveErr);
      }

      // Only call onGenerateReport once per generated report to avoid duplicates
      if (onGenerateReport && !hasGeneratedReport) {
        try {
          onGenerateReport(predictionData);
        } catch (e) {
          console.warn('onGenerateReport callback threw an error:', e);
        }
        setHasGeneratedReport(true);
      }
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (err) {
      console.error('Prediction error:', err);
      const message = err instanceof Error
        ? err.message
        : 'Failed to get prediction. Please ensure the API server is running at http://127.0.0.1:8000';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRecommendations = (): RecommendationRow[] => {
    if (!predictions) return [];

    const currentBill = parseFloat(predictions.bill);
    const budget = parseFloat(householdData.monthlyBudget);
    const isOverBudget = predictions.budgetStatus === 'over_budget';
    
    const recommendations: RecommendationRow[] = [];

    if (!isOverBudget) {
      // If within budget, show current usage as optimal
      predictions.appliances.forEach(app => {
        const originalApp = appliances.find(a => a.name === app.name);
        if (originalApp) {
          recommendations.push({
            appliance: app.name,
            power: app.powerWatts,
            currentHours: Number(originalApp.hours),
            currentDays: Number(originalApp.usageDays),
            recommendedHours: Number(originalApp.hours),
            recommendedDays: Number(originalApp.usageDays),
            currentBill: parseFloat(app.bill),
            recommendedBill: parseFloat(app.bill),
            savings: 0,
            tip: 'Current usage is optimal. Maintain this level.'
          });
        }
      });
      return recommendations;
    }

    // Over budget - calculate reductions needed
    const amountToReduce = Math.abs(predictions.budgetDifference);
    let remainingToReduce = amountToReduce;

    // Sort by bill (highest first)
    const sortedAppliances = [...predictions.appliances]
      .sort((a, b) => parseFloat(b.bill) - parseFloat(a.bill));

    sortedAppliances.forEach(app => {
      const originalApp = appliances.find(a => a.name === app.name);
      if (!originalApp) return;

      const currentHours = Number(originalApp.hours);
      const currentDays = Number(originalApp.usageDays);
      const currentAppBill = parseFloat(app.bill);
      const power = app.powerWatts;

      let recommendedHours = currentHours;
      let recommendedDays = currentDays;
      let tip = '';

      if (remainingToReduce > 0) {
        // Calculate reduction percentage needed (max 40% per appliance)
        const targetReduction = Math.min(remainingToReduce, currentAppBill * 0.4);
        const reductionPercent = targetReduction / currentAppBill;

        // Apply reduction strategy based on appliance type
        const name = app.name.toLowerCase();
        
        if (name.includes('refrigerator') || name.includes('fridge')) {
          // Can't reduce hours for refrigerator, suggest efficiency tips
          recommendedHours = 24;
          recommendedDays = 30;
          tip = 'Keep at 3-4°C, clean coils monthly, check door seals';
        } else if (name.includes('water heater') || name.includes('geyser')) {
          // Reduce hours significantly for water heater
          recommendedHours = Math.max(2, currentHours * (1 - reductionPercent * 1.5));
          recommendedDays = currentDays;
          tip = 'Heat water only when needed, lower temperature to 50-55°C';
        } else if (name.includes('ac') || name.includes('air condition')) {
          // Reduce AC hours
          recommendedHours = Math.max(4, currentHours * (1 - reductionPercent * 1.2));
          recommendedDays = currentDays;
          tip = 'Set to 24-26°C, use fans for circulation, close doors/windows';
        } else if (name.includes('iron') || name.includes('pressing')) {
          // Reduce ironing frequency
          recommendedHours = Math.max(0.5, currentHours * (1 - reductionPercent));
          recommendedDays = Math.max(15, currentDays * (1 - reductionPercent * 0.5));
          tip = 'Iron multiple clothes in one session, use residual heat';
        } else if (name.includes('tv') || name.includes('television')) {
          // Reduce TV hours
          recommendedHours = Math.max(3, currentHours * (1 - reductionPercent));
          recommendedDays = currentDays;
          tip = 'Reduce brightness, unplug when not in use, use power-saving mode';
        } else if (name.includes('washing machine') || name.includes('washer')) {
          // Reduce washing frequency
          recommendedHours = currentHours;
          recommendedDays = Math.max(15, currentDays * (1 - reductionPercent * 0.5));
          tip = 'Run full loads only, use cold water when possible';
        } else if (name.includes('light') || name.includes('bulb') || name.includes('lamp')) {
          // Reduce lighting hours
          recommendedHours = Math.max(2, currentHours * (1 - reductionPercent));
          recommendedDays = currentDays;
          tip = 'Switch to LED bulbs, use natural light during day';
        } else {
          // Generic reduction for other appliances
          recommendedHours = Math.max(1, currentHours * (1 - reductionPercent));
          recommendedDays = Math.max(15, currentDays * (1 - reductionPercent * 0.3));
          tip = 'Reduce usage during peak hours, unplug when not in use';
        }

        // Calculate new bill based on recommended usage
        const monthlyKwh = (power * recommendedHours * recommendedDays) / 1000;
        const recommendedAppBill = (monthlyKwh / parseFloat(predictions.consumption)) * currentBill * (budget / currentBill);
        const savings = currentAppBill - recommendedAppBill;

        recommendations.push({
          appliance: app.name,
          power: power,
          currentHours: currentHours,
          currentDays: currentDays,
          recommendedHours: parseFloat(recommendedHours.toFixed(1)),
          recommendedDays: Math.round(recommendedDays),
          currentBill: currentAppBill,
          recommendedBill: Math.max(0, recommendedAppBill),
          savings: Math.max(0, savings),
          tip: tip
        });

        remainingToReduce -= savings;
      } else {
        // No more reduction needed, keep current usage
        recommendations.push({
          appliance: app.name,
          power: power,
          currentHours: currentHours,
          currentDays: currentDays,
          recommendedHours: currentHours,
          recommendedDays: currentDays,
          currentBill: currentAppBill,
          recommendedBill: currentAppBill,
          savings: 0,
          tip: 'Current usage is acceptable for budget'
        });
      }
    });

    return recommendations;
  };

  const getAIRecommendationSummary = () => {
    if (!predictions?.ai_recommendations) return null;
    
    const summary = predictions.ai_recommendations.find(rec => rec.type === 'summary');
    return summary;
  };

  const getAIRecommendations = () => {
    if (!predictions?.ai_recommendations) return [];
    
    return predictions.ai_recommendations.filter(rec => rec.type !== 'summary');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
  case 'low': return 'text-darkgreen-500';
  default: return 'text-black';
    }
  };

  const getPriorityBgColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'bg-red-100 border-red-200';
      case 'medium': return 'bg-yellow-100 border-yellow-200';
  case 'low': return 'bg-darkgreen-100 border-darkgreen-200';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  const chartData = predictions?.appliances || [];
  const pieChartData = predictions?.appliances.map(app => ({
    name: app.name,
    value: parseFloat(app.consumption)
  })) || [];

  const COLORS = ['#2f8f4a', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

  return (
  <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Energy Prediction</h1>
          <p className="text-black">Calculate your household energy consumption using AI-powered predictions</p>
          
          {/* API Status Indicator */}
          {apiStatus && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              apiStatus.status === 'healthy' ? 'bg-darkgreen-900 bg-opacity-20 border border-darkgreen-500' :
              apiStatus.status === 'degraded' ? 'bg-yellow-900 bg-opacity-20 border border-yellow-500' :
              'bg-red-900 bg-opacity-20 border border-red-500'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                apiStatus.status === 'healthy' ? 'bg-darkgreen-500' :
                apiStatus.status === 'degraded' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-sm">
                {apiStatus.status === 'healthy' ? 'AI Models Active' :
                 apiStatus.status === 'degraded' ? 'Using Fallback Calculation' :
                 'API Offline - Start server: uvicorn main:app --reload'}
              </span>
              {apiStatus.models && (
                <span className="text-xs text-black ml-2">
                  {apiStatus.models.supervised?.loaded && '(ML) '}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-200 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
            <div>
              <p className="font-bold text-red-600">Error</p>
              <p className="text-sm text-black">{error}</p>
            </div>
          </div>
        )}

        {/* Add Appliances Section */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-darkgreen-500 mb-2">Add Appliances</h2>
          <p className="text-black mb-6">Enter details about your household appliances</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Appliance Name</label>
              <input
                type="text"
                placeholder="e.g., Refrigerator"
                value={currentAppliance.name}
                onChange={(e) => setCurrentAppliance({...currentAppliance, name: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Power (Watts)</label>
              <input
                type="number"
                placeholder="e.g., 150"
                value={currentAppliance.power}
                onChange={(e) => setCurrentAppliance({...currentAppliance, power: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Usage Hours/Day</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g., 8"
                value={currentAppliance.hours}
                onChange={(e) => setCurrentAppliance({...currentAppliance, hours: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-redfocus:outline-none focus:border-darkgreen-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <input
                type="number"
                placeholder="1"
                value={currentAppliance.quantity}
                onChange={(e) => setCurrentAppliance({...currentAppliance, quantity: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Usage Days (Monthly)</label>
              <input
                type="number"
                placeholder="30"
                value={currentAppliance.usageDays}
                onChange={(e) => setCurrentAppliance({...currentAppliance, usageDays: parseInt(e.target.value) || 30})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={addAppliance}
                className="w-full bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold py-3 px-6 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Add Appliance
              </button>
            </div>
          </div>
        </div>

        {/* Appliances List */}
        {appliances.length > 0 && (
          <div className="bg-white rounded-2xl p-8 border border-gray-200">
            <h2 className="text-2xl font-bold text-darkgreen-500 mb-6">Your Appliances ({appliances.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 text-black font-medium">Name</th>
                    <th className="text-left p-4 text-black font-medium">Power (W)</th>
                    <th className="text-left p-4 text-black font-medium">Hours/Day</th>
                    <th className="text-left p-4 text-black font-medium">Quantity</th>
                    <th className="text-left p-4 text-black font-medium">Days/Month</th>
                    <th className="text-left p-4 text-black font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {appliances.map((app) => (
                    <tr key={app.id} className="border-b border-gray-200">
                      <td className="p-4">{app.name}</td>
                      <td className="p-4">{app.power}</td>
                      <td className="p-4">{app.hours}</td>
                      <td className="p-4">{app.quantity}</td>
                      <td className="p-4">{app.usageDays}</td>
                      <td className="p-4">
                        <button
                          onClick={() => app.id && removeAppliance(app.id)}
                          className="text-red-500 hover:text-red-400 transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Household Details Section */}
        <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-darkgreen-500 mb-2">Household Details</h2>
          <p className="text-black mb-6">Provide information about your household</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Region <span className="text-red-500">*</span></label>
              <select
                value={householdData.region}
                onChange={(e) => setHouseholdData({...householdData, region: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
              >
                <option value="">Select region</option>
                <option>Kamonyi</option>
                <option>Nyarugenge</option>
                <option>Gasabo</option>
                <option>Kicukiro</option>
                <option>Kayonza</option>
                <option>Muhanga</option>
                <option>Nyagatare</option>
                <option>Musanze</option>
                <option>Huye</option>
                <option>Rusizi</option>
                <option>Rubavu</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Income Level <span className="text-red-500">*</span></label>
              <select
                value={householdData.incomeLevel}
                onChange={(e) => setHouseholdData({...householdData, incomeLevel: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
              >
                <option value="">Select income level</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Household Size <span className="text-red-500">*</span></label>
              <input
                type="number"
                placeholder="e.g., 4"
                value={householdData.householdSize}
                onChange={(e) => setHouseholdData({...householdData, householdSize: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Monthly Budget (RWF) <span className="text-red-500">*</span></label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={householdData.monthlyBudget}
                onChange={(e) => setHouseholdData({...householdData, monthlyBudget: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-red placeholder-red focus:outline-none focus:border-darkgreen-500"
              />
            </div>
          </div>

          <button
            onClick={calculatePredictions}
            disabled={appliances.length === 0 || isLoading || hasGeneratedReport}
            className="w-full bg-orange-500 hover:bg-orange-600 cursor-pointer text-white font-bold py-4 px-6 rounded-lg transition flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                Analyzing with AI Model...
              </>
            ) : (
              <>
                <Zap size={24} />
                {hasGeneratedReport ? 'Prediction Generated' : 'Calculate Prediction'}
              </>
            )}
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="bg-darkgreen-500 text-white p-4 rounded-lg font-bold text-center">
            ✅ Prediction Generated Successfully! Report ID: {predictions?.report_id}
          </div>
        )}

        {/* Prediction Results */}
        {predictions && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm text-black mb-2">Monthly Consumption</h3>
                <p className="text-4xl font-bold text-darkgreen-500">{predictions.consumption}</p>
                <p className="text-black text-sm mt-1">kWh</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm text-black mb-2">Estimated Bill</h3>
                <p className="text-4xl font-bold text-orange-500">{predictions.bill}</p>
                <p className="text-black text-sm mt-1">RWF</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm text-black mb-2">Tariff Bracket</h3>
                <p className="text-2xl font-bold text-black mt-2">{predictions.tariffBracket}</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <h3 className="text-sm text-black mb-2">Report ID</h3>
                <p className="text-sm font-bold text-blue-400 mt-2 font-mono">{predictions.report_id}</p>
                <p className="text-xs text-black mt-1">For admin reference</p>
              </div>
            </div>

            {/* Budget Analysis */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-darkgreen-500 mb-6">Budget Analysis</h2>
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-black">Estimated Bill: {predictions.bill} RWF</span>
                  <span className="text-black">Budget: {householdData.monthlyBudget} RWF</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-8 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      predictions.budgetStatus === 'over_budget'
                        ? 'bg-red-500'
                        : 'bg-darkgreen-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (parseFloat(predictions.bill) / parseFloat(householdData.monthlyBudget)) * 100,
                        100
                      )}%`
                    }}
                  />
                </div>
              </div>
              {predictions.budgetStatus === 'over_budget' ? (
                <div className="bg-red-100 text-red-700 p-4 rounded-lg font-bold">
                  ⚠️ Warning: Your estimated bill exceeds your budget by {Math.abs(predictions.budgetDifference).toFixed(2)} RWF
                </div>
              ) : (
                <div className="bg-darkgreen-100 text-darkgreen-700 p-4 rounded-lg font-bold">
                  ✅ Great! Your estimated bill is within budget. You can save {Math.abs(predictions.budgetDifference).toFixed(2)} RWF
                </div>
              )}
            </div>

            {/* AI Recommendations Toggle */}
            {predictions.ai_recommendations && predictions.ai_recommendations.length > 0 && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-purple-500 mb-2 flex items-center gap-2">
                      <Brain size={24} />
                      AI-Powered Recommendations
                    </h2>
                    <p className="text-black">
                      Smart suggestions from our AI model to optimize your energy usage
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg transition"
                  >
                    {showAIRecommendations ? 'Hide AI Recommendations' : 'Show AI Recommendations'}
                  </button>
                </div>
              </div>
            )}

            {/* AI Recommendations Section */}
            {showAIRecommendations && predictions.ai_recommendations && (
              <div className="bg-white rounded-2xl p-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-purple-500 mb-6 flex items-center gap-2">
                  <Brain size={24} />
                  🤖 AI-Powered Energy Optimization
                </h2>

                {/* AI Summary */}
                {getAIRecommendationSummary() && (
                  <div className="bg-purple-50 border border-purple-100 p-6 rounded-lg mb-6">
                    <h3 className="text-xl font-bold text-purple-600 mb-3">
                      {getAIRecommendationSummary()?.title || 'AI Recommendations Summary'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-black text-sm">Potential Savings</p>
                        <p className="text-2xl font-bold text-darkgreen-500">
                          {getAIRecommendationSummary()?.total_potential_savings_kwh?.toFixed(1) || '0'} kWh
                        </p>
                      </div>
                      <div>
                        <p className="text-black text-sm">Financial Savings</p>
                        <p className="text-2xl font-bold text-darkgreen-500">
                          {getAIRecommendationSummary()?.total_potential_savings_money?.toFixed(0) || '0'} RWF
                        </p>
                      </div>
                      <div>
                        <p className="text-black text-sm">Implementation Cost</p>
                        <p className="text-2xl font-bold text-orange-500">
                          {getAIRecommendationSummary()?.total_implementation_cost?.toFixed(0) || '0'} RWF
                        </p>
                      </div>
                      <div>
                        <p className="text-black text-sm">ROI Period</p>
                        <p className="text-2xl font-bold text-blue-400">
                          {getAIRecommendationSummary()?.roi_months?.toFixed(1) || '0'} months
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm text-black">
                        Engine: {getAIRecommendationSummary()?.recommendation_engine || 'AI Model'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Individual AI Recommendations */}
                <div className="space-y-4">
                  {getAIRecommendations().map((recommendation, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded-lg border ${getPriorityBgColor(recommendation.priority)}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityColor(recommendation.priority)} ${getPriorityBgColor(recommendation.priority)}`}>
                            {recommendation.priority.toUpperCase()} PRIORITY
                          </span>
                          <span className="text-sm text-black">
                            Confidence: {recommendation.confidence_score}%
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-darkgreen-400 font-bold">
                            +{recommendation.savings_estimate.toFixed(1)} kWh/month
                          </p>
                          <p className="text-sm text-black">
                            {recommendation.cost_estimate > 0 ? 
                              `Cost: ${recommendation.cost_estimate.toFixed(0)} RWF` : 
                              'No additional cost'
                            }
                          </p>
                        </div>
                      </div>

                      <h4 className="font-bold text-white text-lg mb-2">
                        {recommendation.suggestion}
                      </h4>

                      {recommendation.ai_insights && (
                        <div className="mt-3 space-y-2">
                          {recommendation.ai_insights.efficiency_gain_percent && (
                            <p className="text-sm text-blue-400">
                              ⚡ Efficiency Gain: {recommendation.ai_insights.efficiency_gain_percent}%
                            </p>
                          )}
                          {recommendation.ai_insights.payback_period_months && (
                            <p className="text-sm text-darkgreen-400">
                              📅 Payback Period: {recommendation.ai_insights.payback_period_months} months
                            </p>
                          )}
                          {recommendation.ai_insights.special_advice && (
                            <p className="text-sm text-purple-400">
                              💡 {recommendation.ai_insights.special_advice}
                            </p>
                          )}
                          {recommendation.ai_insights.smart_tip && (
                            <p className="text-sm text-yellow-400">
                              🎓 {recommendation.ai_insights.smart_tip}
                            </p>
                          )}
                          {recommendation.ai_insights.environmental_impact && (
                            <p className="text-sm text-darkgreen-300">
                              🌱 {recommendation.ai_insights.environmental_impact}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div className="bg-white rounded-2xl p-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-darkgreen-500 mb-6">Consumption by Appliance</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" stroke="#6B7280" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="#6B7280" />
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#FFFFFF', 
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="consumption" fill="#2f8f4a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Chart */}
              <div className="bg-white rounded-2xl p-8 border border-gray-200">
                <h2 className="text-2xl font-bold text-darkgreen-500 mb-6">Energy Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(props: PieLabelRenderProps) => {
                        const name = props.name ?? 'Unknown';
                        const rawPercent = typeof props.percent === 'number' ? props.percent : Number(props.percent ?? 0);
                        const percentage = (rawPercent * 100).toFixed(0);
                        return `${name}: ${percentage}%`;
                      }}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={entry.name ?? `cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Breakdown Table */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <h2 className="text-2xl font-bold text-darkgreen-500 mb-6">Detailed Appliance Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-4 text-black font-medium">Appliance</th>
                      <th className="text-left p-4 text-black font-medium">Power (W)</th>
                      <th className="text-left p-4 text-black font-medium">Consumption (kWh)</th>
                      <th className="text-left p-4 text-black font-medium">Cost (RWF)</th>
                      <th className="text-left p-4 text-black font-medium">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.appliances.map((app, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="p-4 font-medium">{app.name}</td>
                        <td className="p-4">{app.powerWatts.toFixed(0)}</td>
                        <td className="p-4 text-darkgreen-500">{app.consumption}</td>
                        <td className="p-4 text-orange-500">{app.bill}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-darkgreen-500"
                                style={{ width: `${app.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm">{app.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Traditional Recommendations Table */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-darkgreen-500 mb-2">
                  {predictions.budgetStatus === 'over_budget' 
                    ? `Action Plan to Achieve ${householdData.monthlyBudget} RWF Budget`
                    : `Optimal Usage Plan for ${householdData.monthlyBudget} RWF Budget`
                  }
                </h2>
                <p className="text-black">
                  {predictions.budgetStatus === 'over_budget'
                    ? `Follow these recommendations to reduce your bill from ${predictions.bill} RWF to ${householdData.monthlyBudget} RWF`
                    : 'Your current usage is within budget. Maintain these levels for optimal savings.'
                  }
                </p>
              </div>

              {/* Summary Box */}
                <div className={`p-4 rounded-lg mb-6 ${
                predictions.budgetStatus === 'over_budget'
                  ? 'bg-orange-50 border border-orange-100'
                  : 'bg-darkgreen-50 border border-darkgreen-100'
              }`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-black text-sm">Current Bill</p>
                    <p className="text-2xl font-bold text-orange-500">{predictions.bill} RWF</p>
                  </div>
                  <div>
                    <p className="text-black text-sm">Your Budget</p>
                    <p className="text-2xl font-bold text-black">{householdData.monthlyBudget} RWF</p>
                  </div>
                  <div>
                    <p className="text-black text-sm">
                      {predictions.budgetStatus === 'over_budget' ? 'Amount to Save' : 'Remaining Budget'}
                    </p>
                    <p className={`text-2xl font-bold ${
                      predictions.budgetStatus === 'over_budget' ? 'text-red-400' : 'text-darkgreen-400'
                    }`}>
                      {Math.abs(predictions.budgetDifference).toFixed(0)} RWF
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-3 text-black font-medium">Appliance</th>
                      <th className="text-left p-3 text-black font-medium">Power (W)</th>
                      <th className="text-left p-3 text-black font-medium">Current Usage</th>
                      <th className="text-left p-3 text-black font-medium">Recommended Usage</th>
                      <th className="text-left p-3 text-black font-medium">Current Cost</th>
                      <th className="text-left p-3 text-black font-medium">New Cost</th>
                      <th className="text-left p-3 text-black font-medium">Savings</th>
                      <th className="text-left p-3 text-black font-medium">Energy Tips</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generateRecommendations().map((rec, index) => (
                      <tr key={index} className="border-b border-gray-200 hover:bg-gray-50 transition">
                        <td className="p-3 font-medium text-black">{rec.appliance}</td>
                        <td className="p-3 text-black">{rec.power.toFixed(0)}W</td>
                        <td className="p-3">
                          <div className="text-sm">
                            <span className="text-orange-400">{rec.currentHours}h/day</span>
                            <br />
                            <span className="text-black">{rec.currentDays} days/month</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-sm">
                            <span className={rec.recommendedHours < rec.currentHours ? 'text-darkgreen-400' : 'text-black'}>
                              {rec.recommendedHours}h/day
                            </span>
                            <br />
                            <span className={rec.recommendedDays < rec.currentDays ? 'text-darkgreen-400' : 'text-black'}>
                              {rec.recommendedDays} days/month
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-orange-400 font-medium">{rec.currentBill.toFixed(0)} RWF</td>
                        <td className="p-3 text-darkgreen-400 font-medium">{rec.recommendedBill.toFixed(0)} RWF</td>
                        <td className="p-3">
                          {rec.savings > 0 ? (
                            <span className="text-darkgreen-500 font-bold">-{rec.savings.toFixed(0)} RWF</span>
                          ) : (
                            <span className="text-black">--</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-black max-w-xs">{rec.tip}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-darkgreen-500 bg-gray-800">
                      <td colSpan={4} className="p-3 font-bold text-white">TOTAL MONTHLY BILL</td>
                      <td className="p-3 font-bold text-orange-400">{predictions.bill} RWF</td>
                      <td className="p-3 font-bold text-darkgreen-400">
                        {predictions.budgetStatus === 'over_budget' 
                          ? `${householdData.monthlyBudget} RWF`
                          : `${predictions.bill} RWF`
                        }
                      </td>
                      <td className="p-3 font-bold text-darkgreen-500">
                        {predictions.budgetStatus === 'over_budget'
                          ? `-${Math.abs(predictions.budgetDifference).toFixed(0)} RWF`
                          : '0 RWF'
                        }
                      </td>
                      <td className="p-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Additional Tips */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-100 bg-opacity-20 border border-blue-500 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-900 mb-2">Regional Insight: {householdData.region}</h3>
                  <p className="text-sm text-blue-900">
                    {householdData.region === 'Kigali'
                      ? 'Kigali has higher electricity tariffs. Use appliances during off-peak hours (9 PM - 6 AM) for 15-20% savings.'
                      : `${householdData.region} region: Consider solar solutions if available in your area for long-term savings.`
                    }
                  </p>
                </div>
                <div className="bg-purple-100 bg-opacity-20 border border-purple-500 p-4 rounded-lg">
                  <h3 className="font-bold text-purple-900 mb-2">Income Level: {householdData.incomeLevel}</h3>
                  <p className="text-sm text-purple-900">
                    {householdData.incomeLevel === 'Low'
                      ? 'Focus on free energy-saving methods: unplugging devices, using natural light, and proper appliance maintenance. Consider pre-paid meters to track daily usage.'
                      : householdData.incomeLevel === 'Medium'
                      ? 'Consider investing in energy-efficient appliances (LED bulbs, inverter AC). Initial cost pays back in 6-12 months.'
                      : 'Investment opportunity: Consider solar panels (ROI in 3-5 years), smart home systems for 40-60% long-term savings.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PredictionSection;