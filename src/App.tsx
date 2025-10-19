import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AdminSection from './components/AdminSection';
import PredictionSection, { type Predictions } from './components/PredictionSection';
import AnalysisSection from './components/AnalysisSection';
import ReportSection from './components/ReportSection';
import SettingsSection from './components/SettingsSection';
import type { Report, UserProfile } from './types';

// Use shared Report type from `src/types.ts`

function App() {
  const [activeSection, setActiveSection] = useState('prediction');
  const [reports, setReports] = useState<Report[]>([]);
  const [role, setRole] = useState<'Admin' | 'Household User'>('Household User');
  const [currentHouseholdId] = useState<string>(() => `hh-${Date.now()}`);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+250 78 123 4567',
    houseLocation: 'Kigali, Rwanda',
    profileImage: '',
  });

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
        return (
          <SettingsSection
            userProfile={userProfile}
            onUpdateUserProfile={setUserProfile}
            isAdmin={role === 'Admin'}
          />
        );
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
          userProfile={userProfile}
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
              {/* USSD Instructions */}
              <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-4 text-black">
                <h3 className="text-base font-bold text-orange-500 mb-3">🔌 Uko wagura umuriro ukoresheje USSD (*182#)</h3>
                <ol className="list-decimal ml-6 space-y-2">
                  <li>Andika <span className="font-mono font-semibold">*182#</span> kuri telefone yawe.</li>
                  <li>Hitamo <strong>2. Kugura (Buy)</strong>.</li>
                  <li>Hitamo <strong>2. Kugura umuriro (Buy Electricity)</strong>.</li>
                  <li>
                    Hanyuma:
                    <ul className="list-disc ml-6 mt-1 space-y-1">
                      <li>Hitamo <strong>1</strong> hanyuma wandike <strong>numero ya kashi</strong> (meter number), cyangwa</li>
                      <li>Hitamo <strong>2. Konti yanjye (My account)</strong> niba uyifite.</li>
                    </ul>
                  </li>
                  <li>Andika umubare w’amafaranga ushaka kuguraho umuriro.</li>
                  <li>Emeza ukoresheje <strong>PIN yawe ya MoMo</strong>.</li>
                  <li>
                    Reba ubutumwa (SMS) buzaza — buzaba burimo <strong>kode y’umuriro</strong> ifite:
                    <ul className="list-disc ml-6 mt-1 space-y-1">
                      <li>Imibare 16 (urugero: <span className="font-mono">1234 5678 9012 3456</span>), cyangwa</li>
                      <li>Imibare 20 (<span className="font-semibold">STS Type 1</span>) — iyi niyo winjiza muri kashi yawe.</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold py-3 rounded transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;