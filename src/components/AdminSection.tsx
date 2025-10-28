import { useState } from 'react';
import { Users, AlertCircle, Zap, Network, Play, BarChart3 } from 'lucide-react';
import type { Report } from '../types';

interface Cluster {
  cluster: number;
  cluster_profile: {
    name: string;
    description: string;
    characteristics: string[];
    recommendations: string[];
  };
  anomaly_status: string;
  anomaly_score: number;
  anomaly_confidence: string;
  features_used: {
    clustering: string[];
    anomaly_detection: string[];
  };
}

interface Anomaly {
  household_id: string;
  cluster: number;
  cluster_profile: Cluster['cluster_profile'];
  anomaly_status: string;
  anomaly_score: number;
  anomaly_confidence: string;
  report: Report;
}

interface CommunityInsights {
  total_households_analyzed: number;
  cluster_distribution: Record<number, number>;
  anomaly_rate_percentage: number;
  dominant_cluster: string;
  recommendations: string[];
}

interface ClusterDisplayData {
  cluster_id: number;
  cluster_name: string;
  description: string;
  color: string;
  households: Report[];
  avg_consumption: number;
  avg_bill: number;
  size: number;
  consumption_range: string;
  typical_profile: string;
  min_consumption: number;
  max_consumption: number;
  common_regions: string[];
}

interface AdminSectionProps {
  reports?: Report[];
}

const AdminSection = ({ reports = [] }: AdminSectionProps) => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [communityInsights, setCommunityInsights] = useState<CommunityInsights | null>(null);
  // Stores per-report cluster assignments returned by the API (index-aligned with `reports`)
  const [clusterAssignments, setClusterAssignments] = useState<number[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('clustering');
  const [isLoading, setIsLoading] = useState(false);
  // Call our Node backend proxy to avoid CORS and network issues
  const BACKEND_BASE = 'http://localhost:4000/api/ai';
  const HEALTH_ENDPOINT = `${BACKEND_BASE}/health`;
  const CLUSTERING_ENDPOINT = `${BACKEND_BASE}/clustering/batch`;

  // Minimal type for items returned in individual_predictions
  interface ClusterPrediction {
    cluster: number;
    cluster_profile: Cluster['cluster_profile'];
    anomaly_status: string;
    anomaly_score: number;
    anomaly_confidence: string;
    features_used: Cluster['features_used'];
    household_id?: string;
  }

  // Calculate basic statistics from reports
  const avgConsumption = reports.length > 0
    ? (reports.reduce((sum, r) => sum + (parseFloat(String(r.consumption)) || 0), 0) / reports.length).toFixed(2)
    : '0';

  const totalBill = reports.reduce((sum, r) => sum + (parseFloat(String(r.bill)) || 0), 0);

  const checkApiHealth = async (): Promise<boolean> => {
    try {
      const res = await fetch(HEALTH_ENDPOINT, { headers: { 'Accept': 'application/json' } });
      return res.ok;
    } catch {
      return false;
    }
  };

  const performClusteringAnalysis = async () => {
    if (reports.length < 3) {
      alert('Need at least 3 reports to perform clustering analysis');
      return;
    }

    setIsLoading(true);
    try {
      // Prepare household data for batch clustering using ReportSection data structure
      const householdsData = reports.map((report, index) => {
        const consumption = parseFloat(String(report.consumption)) || 0;
        const bill = parseFloat(String(report.bill)) || 0;
        const hhSize = Number(report.householdData?.householdSize) || 1;
        const region = (report.householdData?.region || 'Kigali').toString();
        const incomeLevel = (report.householdData?.incomeLevel || 'Medium').toString().toLowerCase();

        // Derive tariff bracket if missing, based on consumption
        const bracket = report.tariffBracket || (consumption <= 20 ? '0-20 kWh' : consumption <= 50 ? '21-50 kWh' : '50+ kWh');

        return {
          total_kwh: Number(consumption.toFixed(2)),
          total_bill: Number(bill.toFixed(2)),
          household_size: hhSize,
          region: region,
          income_level: incomeLevel,
          tariff_bracket: bracket,
          appliance_count: Number(report.appliances?.length || 0),
          avg_usage_hours: Number(calculateAvgUsageHours(report)),
          daily_energy: Number((consumption / 30).toFixed(3)),
          // Send ISO month (YYYY-MM) to be safe if backend validates format
          month: new Date().toISOString().slice(0, 7),
          household_id: String(report.id ?? `report_${index}`)
        };
      });

      console.log('Sending household data for clustering:', householdsData);

      // Connectivity check (provides clearer error when server/CORS blocks)
      const apiUp = await checkApiHealth();
      if (!apiUp) {
        throw new Error('AI service not reachable. Ensure FastAPI is running at 127.0.0.1:8000 (backend proxies via /api/ai).');
      }

      const response = await fetch(CLUSTERING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          households: householdsData
        }),
      });

      if (!response.ok) {
        let serverMessage = '';
        try {
          const errJson = await response.json();
          serverMessage = errJson?.detail || errJson?.message || JSON.stringify(errJson);
        } catch {
          try { serverMessage = await response.text(); } catch { /* ignore */ }
        }
        throw new Error(`HTTP ${response.status}${serverMessage ? ` — ${serverMessage}` : ''}`);
      }

      const data = await response.json();
      console.log('Clustering response:', data);

      if (data.status === 'success') {
        // Process individual predictions
        const individualPredictions = data.individual_predictions;
        const insights = data.community_insights;
        
        setCommunityInsights(insights);

        // Group by cluster and create cluster data
        const clusterMap = new Map<number, Cluster>();
        const anomalyList: Anomaly[] = [];
        const assignments: number[] = [];

        individualPredictions.forEach((prediction: ClusterPrediction, index: number) => {
          const clusterData: Cluster = {
            cluster: prediction.cluster,
            cluster_profile: prediction.cluster_profile,
            anomaly_status: prediction.anomaly_status,
            anomaly_score: prediction.anomaly_score,
            anomaly_confidence: prediction.anomaly_confidence,
            features_used: prediction.features_used
          };

          clusterMap.set(prediction.cluster, clusterData);
          assignments[index] = prediction.cluster;

          if (prediction.anomaly_status === 'Anomaly') {
            anomalyList.push({
              ...prediction,
              report: reports[index] || {},
              household_id: prediction.household_id || `household_${index}`
            });
          }
        });

        setClusters(Array.from(clusterMap.values()));
        setAnomalies(anomalyList);
        setClusterAssignments(assignments);
        
        console.log('Processed clusters:', Array.from(clusterMap.values()));
        console.log('Processed anomalies:', anomalyList);
      } else {
        alert('Clustering failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Clustering error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      const hint = message.includes('Failed to fetch') || message.includes('Network')
        ? '\nHint: Is the FastAPI server running? Check CORS for http://localhost:5173 and http://127.0.0.1:5173'
        : '';
      alert(`Failed to perform clustering analysis: ${message}${hint}`);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAvgUsageHours = (report: Report): number => {
    if (!report.appliances || report.appliances.length === 0) return 4; // Default value
    
    // Calculate average usage hours from appliances
    // Since we don't have exact hours, we'll estimate based on typical usage
    const totalEstimatedHours = report.appliances.reduce((sum, appliance) => {
      const consumption = parseFloat(String(appliance.consumption)) || 0;
      // Estimate hours based on consumption (this is a rough estimate)
      return sum + Math.min(8, Math.max(2, consumption / 10));
    }, 0);
    
    return totalEstimatedHours / report.appliances.length;
  };

  // Get cluster display data for UI
  const getClusterDisplayData = (clusterId: number): ClusterDisplayData | null => {
    const cluster = clusters.find(c => c.cluster === clusterId);
    if (!cluster) return null;

    // Get reports that belong to this cluster (simplified mapping)
    // In a real implementation, this mapping would come from the API response
    // Use real assignments from API (fallback to empty when not available)
    const clusterReports = reports.filter((_, index) => clusterAssignments[index] === clusterId);

    const consumptions = clusterReports.map(r => parseFloat(String(r.consumption)) || 0);
    const bills = clusterReports.map(r => parseFloat(String(r.bill)) || 0);

    return {
      cluster_id: clusterId,
      cluster_name: cluster.cluster_profile.name,
      description: cluster.cluster_profile.description,
      color: ['green', 'blue', 'orange'][clusterId] || 'gray',
      households: clusterReports,
      avg_consumption: consumptions.length > 0 ? 
        Number((consumptions.reduce((a, b) => a + b, 0) / consumptions.length).toFixed(2)) : 0,
      avg_bill: bills.length > 0 ? 
        Number((bills.reduce((a, b) => a + b, 0) / bills.length).toFixed(2)) : 0,
      size: clusterReports.length,
      consumption_range: getConsumptionRange(clusterId),
      typical_profile: cluster.cluster_profile.characteristics.join(', '),
      min_consumption: consumptions.length > 0 ? Math.min(...consumptions) : 0,
      max_consumption: consumptions.length > 0 ? Math.max(...consumptions) : 0,
      common_regions: getCommonRegions(clusterReports)
    };
  };

  const getConsumptionRange = (clusterId: number): string => {
    const ranges = [
      "0-50 kWh (Low Consumption)",
      "51-150 kWh (Medium Consumption)", 
      "151+ kWh (High Consumption)"
    ];
    return ranges[clusterId] || "Unknown Range";
  };

  const getCommonRegions = (households: Report[]): string[] => {
    const regionCount: Record<string, number> = {};
    households.forEach(h => {
      const region = h.householdData?.region || 'Unknown';
      regionCount[region] = (regionCount[region] || 0) + 1;
    });
    
    return Object.entries(regionCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([region]) => region);
  };

  // Stats cards data
  const stats = [
    {
      label: 'Total Households',
      value: reports.length,
      icon: Users,
      color: 'green'
    },
    {
      label: 'Clusters Identified',
      value: clusters.length,
      icon: Network,
      color: 'orange'
    },
    {
      label: 'Anomalies Detected',
      value: anomalies.length,
      color: 'red',
      icon: AlertCircle
    },
    {
      label: 'Avg Consumption',
      value: `${avgConsumption} kWh`,
      color: 'blue',
      icon: Zap
    },
    {
      label: 'Total Monthly Bill',
      value: `${(totalBill / 1000).toFixed(0)}K RWF`,
      color: 'purple',
      icon: BarChart3
    },
    {
      label: 'Anomaly Rate',
      value: communityInsights ? `${communityInsights.anomaly_rate_percentage.toFixed(1)}%` : '0%',
      color: 'yellow',
      icon: AlertCircle
    }
  ];

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'bg-green-500',
      orange: 'bg-orange-500', 
      red: 'bg-red-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  const getTextColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'text-green-600',
      orange: 'text-orange-600',
      red: 'text-red-600',
      blue: 'text-blue-600', 
      purple: 'text-purple-600',
      yellow: 'text-yellow-600'
    };
    return colorMap[color] || 'text-gray-600';
  };

  const getClusterDescription = (clusterData: ClusterDisplayData) => {
    return `${clusterData.description} - ${clusterData.size} household${clusterData.size !== 1 ? 's' : ''}`;
  };

  const getAnomalyReasons = (anomaly: Anomaly): string[] => {
    const reasons = [];
    const report = anomaly.report;
    const consumption = parseFloat(String(report.consumption)) || 0;
    const bill = parseFloat(String(report.bill)) || 0;
    
    if (consumption > 300) {
      reasons.push(`Extremely high consumption: ${consumption} kWh`);
    }
    
    if (bill > 50000) {
      reasons.push(`Very high bill amount: ${bill} RWF`);
    }
    
    if (anomaly.anomaly_score < -0.1) {
      reasons.push(`Strong anomaly signal (score: ${anomaly.anomaly_score.toFixed(3)})`);
    }
    
    if (report.householdData?.householdSize && consumption) {
      const sizeNum = Number(report.householdData.householdSize) || 0;
      const perCapita = sizeNum > 0 ? consumption / sizeNum : 0;
      if (perCapita > 100) {
        reasons.push(`High per capita consumption: ${perCapita.toFixed(1)} kWh/person`);
      }
    }
    
    return reasons.length > 0 ? reasons : ['Unusual consumption pattern detected by AI model'];
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-green-600 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">AI-Powered Household Clustering & Anomaly Detection</p>
          <p className="text-green-500 text-sm mt-1">
            Using K-Means Clustering and Isolation Forest for intelligent pattern analysis
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Analyzing {reports.length} household reports from ReportSection
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={getTextColorClass(stat.color)} size={20} />
                <span className="text-xs text-gray-500">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${getTextColorClass(stat.color)}`}>{String(stat.value)}</p>
            </div>
          ))}
        </div>

        {/* Control Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">AI Clustering Models</h2>
              <p className="text-gray-600">
                Analyze {reports.length} household reports using K-Means clustering and detect anomalies with Isolation Forest
              </p>
              <p className="text-green-500 text-sm mt-1">
                Advanced machine learning for intelligent household segmentation and anomaly detection
              </p>
            </div>
            <button
              onClick={performClusteringAnalysis}
              disabled={isLoading || reports.length < 3}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-lg transition flex items-center gap-2 shadow-sm"
            >
              <Play size={20} />
              {isLoading ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
          </div>
          {reports.length < 3 && (
            <p className="text-red-500 mt-3">
              Need at least 3 household reports to perform analysis (currently: {reports.length})
            </p>
          )}
        </div>

        {/* Results Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('clustering')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'clustering'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            K-means Clustering
          </button>
          <button
            onClick={() => setActiveTab('anomaly')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'anomaly'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Anomaly Detection
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'insights'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Business Insights
          </button>
        </div>

        {/* AI Clustering Results */}
        {activeTab === 'clustering' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Network className="text-green-600" size={28} />
              <h2 className="text-2xl font-bold text-green-600">AI Clustering Results</h2>
            </div>

            {clusters.length === 0 ? (
              <div className="py-12 text-center">
                <Network size={80} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">
                  {reports.length >= 3 
                    ? "Click 'Run AI Analysis' to cluster households using K-Means algorithm"
                    : `Need at least 3 reports to perform clustering (currently: ${reports.length})`
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-700 font-bold">
                    Successfully clustered {reports.length} households into {clusters.length} groups using K-Means algorithm
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {[0, 1, 2].map((clusterId) => {
                    const clusterData = getClusterDisplayData(clusterId);
                    if (!clusterData) return null;

                    return (
                      <div
                        key={clusterId}
                        onClick={() => setSelectedCluster(clusterId)}
                        className={`p-6 rounded-lg cursor-pointer transition border-2 ${
                          selectedCluster === clusterId
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full ${getColorClass(clusterData.color)} mb-3`}></div>
                        <h3 className="text-lg font-bold mb-2">{clusterData.cluster_name}</h3>
                        <p className="text-sm text-gray-600 mb-4">{getClusterDescription(clusterData)}</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Households:</span>
                            <span className="font-bold">{clusterData.size}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg Consumption:</span>
                            <span className="font-bold">{clusterData.avg_consumption} kWh</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Avg Bill:</span>
                            <span className="font-bold">{clusterData.avg_bill} RWF</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Range:</span>
                            <span className="font-bold">{clusterData.consumption_range}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedCluster !== null && (
                  <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-bold text-green-600 mb-4">
                      {getClusterDisplayData(selectedCluster)?.cluster_name} - Detailed View
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-2">Cluster Profile</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          {clusters.find(c => c.cluster === selectedCluster)?.cluster_profile.description}
                        </p>
                        <div className="space-y-1">
                          <h5 className="text-sm font-bold text-gray-700">Characteristics:</h5>
                          <ul className="text-sm text-gray-600 list-disc list-inside">
                            {clusters.find(c => c.cluster === selectedCluster)?.cluster_profile.characteristics.map((char: string, idx: number) => (
                              <li key={idx}>{char}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <h4 className="font-bold text-gray-800 mb-2">AI Recommendations</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {clusters.find(c => c.cluster === selectedCluster)?.cluster_profile.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-green-500 mr-2">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left p-3 text-gray-700 font-medium">Report ID</th>
                            <th className="text-left p-3 text-gray-700 font-medium">Region</th>
                            <th className="text-left p-3 text-gray-700 font-medium">Income</th>
                            <th className="text-left p-3 text-gray-700 font-medium">Size</th>
                            <th className="text-left p-3 text-gray-700 font-medium">Consumption</th>
                            <th className="text-left p-3 text-gray-700 font-medium">Bill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getClusterDisplayData(selectedCluster)?.households.map((household, index) => (
                            <tr key={index} className="border-b border-gray-200 hover:bg-gray-100">
                              <td className="p-3 font-mono text-sm">#{household.id}</td>
                              <td className="p-3">{household.householdData?.region || 'Unknown'}</td>
                              <td className="p-3">{household.householdData?.incomeLevel || 'Unknown'}</td>
                              <td className="p-3">{household.householdData?.householdSize || 1}</td>
                              <td className="p-3 font-bold text-green-600">{household.consumption} kWh</td>
                              <td className="p-3 font-bold text-orange-600">{household.bill} RWF</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Anomaly Detection Results */}
        {activeTab === 'anomaly' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="text-orange-500" size={28} />
              <h2 className="text-2xl font-bold text-orange-500">Anomaly Detection Results</h2>
            </div>

            {clusters.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle size={80} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">
                  Run AI analysis first to detect anomalies
                </p>
              </div>
            ) : anomalies.length === 0 ? (
              <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 font-bold text-center text-lg">
                  No anomalies detected. All consumption patterns appear normal.
                </p>
                <p className="text-gray-600 text-sm text-center mt-2">
                  Isolation Forest algorithm analyzed all households and found no unusual patterns
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                  <p className="text-red-700 font-bold">
                    🚨 Found {anomalies.length} anomalous household(s) using Isolation Forest
                  </p>
                  <p className="text-red-600 text-sm mt-1">
                    These households show unusual consumption patterns that require investigation
                  </p>
                </div>
                
                {anomalies.map((anomaly, index) => (
                  <div key={index} className="p-6 bg-white border border-red-200 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-600 mb-4">
                          Anomaly #{index + 1} - Confidence: {anomaly.anomaly_confidence}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="text-gray-600 text-sm">Report ID:</span>
                            <p className="font-bold text-gray-800 font-mono">#{anomaly.report.id}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-sm">Consumption:</span>
                            <p className="font-bold text-red-600 text-lg">{anomaly.report.consumption} kWh</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-sm">Bill:</span>
                            <p className="font-bold text-red-600 text-lg">{anomaly.report.bill} RWF</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-sm">Anomaly Score:</span>
                            <p className="font-bold text-orange-500">{anomaly.anomaly_score.toFixed(3)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <span className="text-gray-600">Region:</span>
                            <p className="font-bold text-gray-800">{anomaly.report.householdData?.region || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Income Level:</span>
                            <p className="font-bold text-gray-800">{anomaly.report.householdData?.incomeLevel || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Household Size:</span>
                            <p className="font-bold text-gray-800">{anomaly.report.householdData?.householdSize || 1} person(s)</p>
                          </div>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <h4 className="text-red-700 font-bold mb-2">Detection Reasons:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {getAnomalyReasons(anomaly).map((reason, i) => (
                              <li key={i} className="text-sm text-red-700">{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <AlertCircle size={40} className="text-red-500 ml-4 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Business Insights */}
        {activeTab === 'insights' && communityInsights && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="text-blue-500" size={28} />
              <h2 className="text-2xl font-bold text-blue-500">Business Insights & Recommendations</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-lg font-bold text-blue-700 mb-3">📊 Consumption Patterns</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>• Cluster 0 (Low Consumption): {communityInsights.cluster_distribution[0] || 0} households</li>
                  <li>• Cluster 1 (Medium Consumption): {communityInsights.cluster_distribution[1] || 0} households</li>
                  <li>• Cluster 2 (High Consumption): {communityInsights.cluster_distribution[2] || 0} households</li>
                  {anomalies.length > 0 && (
                    <li className="text-red-600">• Anomalies Detected: {anomalies.length} households</li>
                  )}
                </ul>
              </div>

              <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-bold text-green-700 mb-3">💡 AI Recommendations</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {communityInsights.recommendations.slice(0, 4).map((rec, idx) => (
                    <li key={idx}>• {rec}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Cluster Distribution */}
            <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="text-lg font-bold text-purple-700 mb-3">🏠 Household Distribution by AI Clusters</h3>
              <div className="space-y-4">
                {[0, 1, 2].map((clusterId) => {
                  const clusterData = getClusterDisplayData(clusterId);
                  if (!clusterData) return null;
                  
                  const clusterCount = communityInsights.cluster_distribution[clusterId] || 0;
                  const percentage = (clusterCount / communityInsights.total_households_analyzed) * 100;

                  return (
                    <div key={clusterId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getColorClass(clusterData.color)}`}></div>
                        <span className="text-gray-700">{clusterData.cluster_name}</span>
                        <span className="text-gray-500 text-sm">({clusterData.consumption_range})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600 text-sm">{clusterCount} households</span>
                        <div className="w-32 bg-gray-200 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full ${getColorClass(clusterData.color)}`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-gray-700 text-sm font-bold">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
                {anomalies.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-gray-300">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-red-600 font-bold">Anomalies Detected</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-600 text-sm">{anomalies.length} households</span>
                      <div className="w-32 bg-gray-200 rounded-full h-3">
                        <div 
                          className="h-3 rounded-full bg-red-500"
                          style={{ width: `${communityInsights.anomaly_rate_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-red-600 text-sm font-bold">{communityInsights.anomaly_rate_percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSection;