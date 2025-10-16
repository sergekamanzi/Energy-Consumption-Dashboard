import { useState } from 'react';
import { Users, AlertCircle, Zap, Network, Play, BarChart3 } from 'lucide-react';
import type { Report } from '../types';

interface Cluster {
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

interface Anomaly {
  report: Report;
  anomaly_score: number;
  reasons: string[];
  consumption_per_person: number;
  region_comparison?: number;
}

interface AdminSectionProps {
  reports?: Report[];
}

const AdminSection = ({ reports = [] }: AdminSectionProps) => {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [activeTab, setActiveTab] = useState('kmeans');
  const [isLoading, setIsLoading] = useState(false);
  const [modelMetrics, setModelMetrics] = useState<Record<string, unknown>>({});

  // Calculate basic statistics
  const avgConsumption = reports.length > 0
    ? (reports.reduce((sum, r) => sum + (r.total_kwh || 0), 0) / reports.length).toFixed(2)
    : '0';

  const totalBill = reports.reduce((sum, r) => sum + (r.total_bill || 0), 0);

  const performUnsupervisedAnalysis = async () => {
    if (reports.length < 3) {
      alert('Need at least 3 reports to perform clustering analysis');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/unsupervised/cluster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reports: reports.map(report => ({
            ...report,
            household_size: report.household_size || 1,
            income_level: report.income_level || 'Medium',
            region: report.region || 'Kigali'
          }))
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setClusters(data.clusters);
        setAnomalies(data.anomalies);
        setModelMetrics(data.model_metrics);
      } else {
        alert('Clustering failed: ' + data.message);
      }
    } catch (error) {
      console.error('Clustering error:', error);
      alert('Failed to perform clustering analysis');
    } finally {
      setIsLoading(false);
    }
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
      label: 'High Consumption Anomalies',
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
      value: modelMetrics.anomaly_rate || '0%',
      color: 'yellow',
      icon: AlertCircle
    }
  ];

  const getColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
    green: 'bg-darkgreen-500',
      orange: 'bg-orange-500', 
      red: 'bg-red-500',
      blue: 'bg-blue-500',
      purple: 'bg-purple-500',
      yellow: 'bg-yellow-500'
    };
  return colorMap[color] || 'bg-black';
  };

  const getTextColorClass = (color: string) => {
    const colorMap: { [key: string]: string } = {
  green: 'text-darkgreen-500',
      orange: 'text-orange-500',
      red: 'text-red-500',
      blue: 'text-blue-500', 
      purple: 'text-purple-500',
      yellow: 'text-yellow-500'
    };
  return colorMap[color] || 'text-black';
  };

  const getClusterDescription = (cluster: Cluster) => {
    return `${cluster.description} - ${cluster.size} household${cluster.size !== 1 ? 's' : ''}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-black p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Admin Dashboard</h1>
          <p className="text-black">Rule-Based Household Clustering & Anomaly Detection</p>
          {(() => {
            const method = modelMetrics.clustering_method ? String(modelMetrics.clustering_method) : undefined;
            return method ? <p className="text-darkgreen-400 text-sm mt-1">Method: {method}</p> : null;
          })()}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={getTextColorClass(stat.color)} size={20} />
                <span className="text-xs text-black">{stat.label}</span>
              </div>
              <p className={`text-xl font-bold ${getTextColorClass(stat.color)}`}>{String(stat.value)}</p>
            </div>
          ))}
        </div>

        {/* Control Section */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-darkgreen-500 mb-2">Rule-Based Clustering Models</h2>
              <p className="text-black">
                Analyze household patterns using rule-based clustering and detect high-consumption anomalies
              </p>
              <p className="text-darkgreen-400 text-sm mt-1">
                Clustering based on consumption ranges: Tier 1 (20-99 kWh), Tier 2 (100-250 kWh), Tier 3 (300-600 kWh)
              </p>
            </div>
            <button
              onClick={performUnsupervisedAnalysis}
              disabled={isLoading || reports.length < 3}
              className="bg-darkgreen-500 hover:bg-darkgreen-600 disabled:bg-gray-300 text-white font-bold px-6 py-3 rounded-lg transition flex items-center gap-2"
            >
              <Play size={20} />
              {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
          {reports.length < 3 && (
            <p className="text-red-400 mt-3">
              Need at least 3 household reports to perform analysis
            </p>
          )}
        </div>

        {/* Results Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('kmeans')}
              className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'kmeans'
                ? 'bg-darkgreen-500 text-white'
                : 'bg-gray-100 text-black hover:bg-gray-200'
            }`}
          >
            Consumption Clustering
          </button>
          <button
            onClick={() => setActiveTab('isolation')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'isolation'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-100 text-black hover:bg-gray-200'
            }`}
          >
            Anomaly Detection
          </button>
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-6 py-3 rounded-lg font-bold transition ${
              activeTab === 'insights'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-black hover:bg-gray-200'
            }`}
          >
            Business Insights
          </button>
        </div>

        {/* Consumption Clustering Results */}
        {activeTab === 'kmeans' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
              <Network className="text-darkgreen-500" size={28} />
              <h2 className="text-2xl font-bold text-darkgreen-500">Consumption Clustering Results</h2>
            </div>

            {clusters.length === 0 ? (
              <div className="py-12 text-center">
                <Network size={80} className="mx-auto text-black mb-4" />
                <p className="text-black text-lg">
                  {reports.length >= 3 
                    ? "Click 'Run Analysis' to cluster households by consumption"
                    : "Need at least 3 reports to perform clustering"
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-darkgreen-50 border border-darkgreen-500 rounded-lg">
                  <p className="text-darkgreen-600 font-bold">
                     Households successfully clustered into 3 consumption tiers using rule-based approach
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {clusters.map((cluster) => (
                    <div
                      key={cluster.cluster_id}
                      onClick={() => setSelectedCluster(cluster)}
                      className={`p-6 rounded-lg cursor-pointer transition border-2 ${
                        selectedCluster?.cluster_id === cluster.cluster_id
                          ? 'border-darkgreen-500 bg-gray-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                        <div className={`w-4 h-4 rounded-full ${getColorClass(cluster.color)} mb-3`}></div>
                      <h3 className="text-lg font-bold mb-2">{cluster.cluster_name}</h3>
                      <p className="text-sm text-black mb-4">{getClusterDescription(cluster)}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-black">Households:</span>
                          <span className="font-bold">{cluster.size}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-black">Avg Consumption:</span>
                          <span className="font-bold">{cluster.avg_consumption} kWh</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-black">Avg Bill:</span>
                          <span className="font-bold">{cluster.avg_bill} RWF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-black">Range:</span>
                          <span className="font-bold">{cluster.consumption_range}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-black">Actual Range:</span>
                          <span className="font-bold">{cluster.min_consumption}-{cluster.max_consumption} kWh</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedCluster && (
                    <div className="mt-6 p-6 bg-gray-50 rounded-lg border border-gray-200">
                    <h3 className="text-xl font-bold text-darkgreen-500 mb-4">
                      {selectedCluster.cluster_name} - Detailed View ({selectedCluster.size} households)
                    </h3>
                    <div className="mb-4 p-3 bg-white rounded-lg">
                      <p className="text-sm text-black">
                        <strong>Description:</strong> {selectedCluster.description}
                      </p>
                      <p className="text-sm text-black">
                        <strong>Typical Profile:</strong> {selectedCluster.typical_profile}
                      </p>
                      <p className="text-sm text-black">
                        <strong>Common Regions:</strong> {selectedCluster.common_regions.join(', ')}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-700">
                            <th className="text-left p-3 text-black font-medium">ID</th>
                              <th className="text-left p-3 text-black font-medium">Region</th>
                              <th className="text-left p-3 text-black font-medium">Income</th>
                              <th className="text-left p-3 text-black font-medium">Size</th>
                              <th className="text-left p-3 text-black font-medium">Consumption</th>
                              <th className="text-left p-3 text-black font-medium">Bill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCluster.households.map((household, index) => (
                            <tr key={index} className="border-b border-gray-800 hover:bg-gray-750">
                              <td className="p-3 font-mono text-sm">#{household.id}</td>
                              <td className="p-3">{household.region || 'Unknown'}</td>
                              <td className="p-3">{household.income_level || 'Unknown'}</td>
                              <td className="p-3">{household.household_size || 1}</td>
                              <td className="p-3 font-bold text-darkgreen-400">{household.total_kwh} kWh</td>
                              <td className="p-3 font-bold text-orange-400">{household.total_bill} RWF</td>
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
        {activeTab === 'isolation' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="text-orange-500" size={28} />
              <h2 className="text-2xl font-bold text-orange-500">Anomaly Detection Results</h2>
            </div>

            {clusters.length === 0 ? (
              <div className="py-12 text-center">
                <AlertCircle size={80} className="mx-auto text-black mb-4" />
                <p className="text-black text-lg">
                  Run clustering analysis first to detect anomalies
                </p>
              </div>
            ) : anomalies.length === 0 ? (
              <div className="p-6 bg-darkgreen-50 border border-darkgreen-500 rounded-lg">
                <p className="text-darkgreen-600 font-bold text-center text-lg">
                   No high-consumption anomalies detected. All households under 600 kWh/month.
                </p>
                <p className="text-black text-sm text-center mt-2">
                  Anomaly detection threshold: 600 kWh/month
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-500 rounded-lg mb-4">
                  <p className="text-red-600 font-bold">
                    🚨 Found {anomalies.length} high-consumption household(s) exceeding 600 kWh/month
                  </p>
                  <p className="text-red-500 text-sm mt-1">
                    These households require immediate attention and energy audit
                  </p>
                </div>
                
                {anomalies.map((anomaly, index) => (
                  <div key={index} className="p-6 bg-white border border-red-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-400 mb-4">
                          High Consumption Anomaly #{index + 1}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <span className="text-black text-sm">Household ID:</span>
                            <p className="font-bold text-black font-mono">#{anomaly.report.id}</p>
                          </div>
                          <div>
                            <span className="text-black text-sm">Consumption:</span>
                            <p className="font-bold text-red-600 text-lg">{anomaly.report.total_kwh} kWh</p>
                          </div>
                          <div>
                            <span className="text-black text-sm">Bill:</span>
                            <p className="font-bold text-red-600 text-lg">{anomaly.report.total_bill} RWF</p>
                          </div>
                          <div>
                            <span className="text-black text-sm">Anomaly Score:</span>
                            <p className="font-bold text-yellow-500">{anomaly.anomaly_score}</p>
                          </div>
                        </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <span className="text-black">Region:</span>
                            <p className="font-bold text-black">{anomaly.report.region || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-black">Income Level:</span>
                            <p className="font-bold text-black">{anomaly.report.income_level || 'Unknown'}</p>
                          </div>
                          <div>
                            <span className="text-black">Household Size:</span>
                            <p className="font-bold text-black">{anomaly.report.household_size || 1} person(s)</p>
                          </div>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                          <h4 className="text-red-600 font-bold mb-2">Detection Reasons:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {anomaly.reasons.map((reason, i) => (
                              <li key={i} className="text-sm text-red-600">{reason}</li>
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
        {activeTab === 'insights' && clusters.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="text-blue-500" size={28} />
              <h2 className="text-2xl font-bold text-blue-500">Business Insights & Recommendations</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-blue-900 bg-opacity-20 border border-blue-500 rounded-lg">
                <h3 className="text-lg font-bold text-blue-400 mb-3">📊 Consumption Patterns</h3>
                <ul className="space-y-2 text-sm text-white">
                  <li>• Tier 1 (Small Families): {clusters[0]?.size} households ({((clusters[0]?.size / reports.length) * 100).toFixed(1)}%)</li>
                  <li>• Tier 2 (Average Families): {clusters[1]?.size} households ({((clusters[1]?.size / reports.length) * 100).toFixed(1)}%)</li>
                  <li>• Tier 3 (Large Families): {clusters[2]?.size} households ({((clusters[2]?.size / reports.length) * 100).toFixed(1)}%)</li>
                  {anomalies.length > 0 && (
                    <li className="text-red-400">• High Consumption: {anomalies.length} households ({((anomalies.length / reports.length) * 100).toFixed(1)}%)</li>
                  )}
                </ul>
              </div>

              <div className="p-6 bg-darkgreen-900 bg-opacity-20 border border-darkgreen-500 rounded-lg">
                <h3 className="text-lg font-bold text-darkgreen-400 mb-3">💡 Actionable Insights</h3>
                <ul className="space-y-2 text-sm text-white">
                  <li>• {anomalies.length} households exceed 600 kWh/month and need energy audit</li>
                  <li>• Target energy efficiency programs for Tier 3 households</li>
                  <li>• Tier 1 households can be used as efficiency benchmarks</li>
                  <li>• Consider time-of-use pricing for high consumption clusters</li>
                </ul>
              </div>
            </div>

            {/* Cluster Distribution */}
            <div className="mt-6 p-6 bg-purple-900 bg-opacity-20 border border-purple-500 rounded-lg">
              <h3 className="text-lg font-bold text-purple-400 mb-3">🏠 Household Distribution by Consumption Tier</h3>
              <div className="space-y-4">
                {clusters.map((cluster) => (
                  <div key={cluster.cluster_id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getColorClass(cluster.color)}`}></div>
                      <span className="text-white">{cluster.cluster_name}</span>
                          <span className="text-white text-sm">({cluster.consumption_range})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm">{cluster.size} households</span>
                      <div className="w-32 bg-gray-700 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${getColorClass(cluster.color)}`}
                          style={{ width: `${(cluster.size / reports.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-white text-sm font-bold">{((cluster.size / reports.length) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                {anomalies.length > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-red-400">High Consumption Anomalies</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white text-sm">{anomalies.length} households</span>
                      <div className="w-32 bg-gray-700 rounded-full h-3">
                        <div 
                          className="h-3 rounded-full bg-red-500"
                          style={{ width: `${(anomalies.length / reports.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-red-400 text-sm font-bold">{((anomalies.length / reports.length) * 100).toFixed(1)}%</span>
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