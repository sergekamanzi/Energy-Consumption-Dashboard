import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AdminSection from './components/AdminSection';
import PredictionSection, { type Predictions } from './components/PredictionSection';
import AnalysisSection from './components/AnalysisSection';
import ReportSection from './components/ReportSection';
import SettingsSection from './components/SettingsSection';
import type { Report } from './types';

// Use shared Report type from `src/types.ts`

function App() {
  const [activeSection, setActiveSection] = useState('prediction');
  const [reports, setReports] = useState<Report[]>([]);
  const [role, setRole] = useState<'Admin' | 'Household User'>('Household User');
  const [currentHouseholdId] = useState<string>(() => `hh-${Date.now()}`);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleGenerateReport = (reportData: Predictions) => {
    const newReport: Report = {
      ...reportData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ownerId: currentHouseholdId
    };
    setReports([...reports, newReport]);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'admin':
  return role === 'Admin' ? <AdminSection reports={reports} /> : <div className="text-center text-black">Access denied.</div>;
      case 'prediction':
  return role === 'Household User' ? <PredictionSection onGenerateReport={handleGenerateReport} ownerId={currentHouseholdId} /> : <div className="text-center text-black">Prediction accessible to household users only.</div>;
      case 'analysis':
        return <AnalysisSection isAdmin={role === 'Admin'} reports={reports.filter(r => role === 'Admin' ? true : r.ownerId === currentHouseholdId)} />;
      case 'report':
        return <ReportSection isAdmin={role === 'Admin'} reports={reports.filter(r => role === 'Admin' ? true : r.ownerId === currentHouseholdId)} />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <PredictionSection onGenerateReport={handleGenerateReport} />;
    }
  };

  return (
  <div className="min-h-screen bg-gray-50 text-black" >
  <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} role={role} />

      <div className="ml-64">
        <Navbar
          setShowPaymentModal={setShowPaymentModal}
          selectedRole={role}
          setSelectedRole={setRole}
        />

        <main className="p-8">
          {renderSection()}
        </main>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full border-2 border-darkgreen-500">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-orange-500">MTN MoMo Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-black hover:text-red-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <>
                <div>
                  <label className="block text-sm mb-2 text-darkgreen-500">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="078XXXXXXX"
                    className="w-full px-4 py-2 bg-white border border-darkgreen-500 rounded text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-darkgreen-500">Amount (RWF)</label>
                  <input
                    type="number"
                    placeholder="Enter amount"
                    className="w-full px-4 py-2 bg-white border border-darkgreen-500 rounded text-black"
                  />
                </div>
              </>

              <button
                onClick={() => {
                  alert('Payment Successful!');
                  setShowPaymentModal(false);
                }}
                className="w-full bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold py-3 rounded transition"
              >
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;