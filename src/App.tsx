import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AdminSection from './components/AdminSection';
import PredictionSection, { type Predictions } from './components/PredictionSection';
import AnalysisSection from './components/AnalysisSection';
import ReportSection from './components/ReportSection';
import SettingsSection from './components/SettingsSection';
import FeedbackWidget from './components/FeedbackWidget';
import type { Report, UserProfile } from './types';

// Use shared Report type from `src/types.ts`

function App() {
  const BACKEND_BASE_URL = 'http://localhost:4000/api';
  const [activeSection, setActiveSection] = useState('prediction');
  const [reports, setReports] = useState<Report[]>([]);
  const [role, setRole] = useState<'Admin' | 'Household User'>('Household User');
  const [currentHouseholdId] = useState<string>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pl_household_id') : null;
    if (stored && stored.trim()) return stored;
    const generated = `hh-${Date.now()}`;
  try { localStorage.setItem('pl_household_id', generated); } catch { /* ignore */ }
    return generated;
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    firstName: 'Kamanzi',
    lastName: 'Serge',
    email: 'serge@gmail.com',
    phone: '+250 78 123 4567',
    houseLocation: 'Kigali, Rwanda',
    profileImage: '',
  });

  // Ensure landing pages by role:
  // - Admin -> AdminSection
  // - Household User -> PredictionSection
  useEffect(() => {
    setActiveSection(role === 'Admin' ? 'admin' : 'prediction');
  }, [role]);

  // Fetch reports from backend (MongoDB)
  const fetchReportsFromDB = async () => {
    try {
      type ReportDoc = {
        id?: number;
        _id?: string;
        timestamp?: string | Date;
        createdAt?: string | Date;
        consumption?: number | string;
        bill?: number | string;
        total_kwh?: number;
        total_bill?: number;
        tariffBracket?: string;
        tariff_bracket?: string;
        householdData?: {
          region?: string;
          incomeLevel?: string;
          householdSize?: number | string;
          monthlyBudget?: number | string;
        };
        region?: string;
        income_level?: string;
        household_size?: number;
        budget?: number;
        appliances?: Array<{ name?: string; consumption?: string | number; bill?: string | number; percentage?: string | number; powerWatts?: number; }>;
        breakdown?: unknown[];
        ownerId?: string;
      };
      // 1) Primary fetch based on role/ownerId
      const url = role === 'Admin'
        ? `${BACKEND_BASE_URL}/reports?limit=200`
        : `${BACKEND_BASE_URL}/reports?ownerId=${encodeURIComponent(currentHouseholdId)}&limit=200`;
      let res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let data = await res.json();
      let mapped: Report[] = (Array.isArray(data) ? data : []).map((doc: ReportDoc, idx: number) => {
        const ts = doc.timestamp ? new Date(doc.timestamp).toISOString() : new Date(doc.createdAt || Date.now()).toISOString();
        const idNum = typeof doc.id === 'number' ? doc.id : Date.parse(ts) + idx;
        return {
          id: idNum,
          timestamp: ts,
          consumption: doc.consumption,
          bill: doc.bill,
          total_kwh: doc.total_kwh,
          total_bill: doc.total_bill,
          tariffBracket: doc.tariffBracket || doc.tariff_bracket,
          householdData: doc.householdData || {
            region: doc.region,
            incomeLevel: doc.income_level,
            householdSize: doc.household_size,
            monthlyBudget: doc.budget
          },
          appliances: doc.appliances || [],
          breakdown: doc.breakdown || [],
          ownerId: doc.ownerId
        } as Report;
      });

      // 2) Household fallback: if no owner-specific reports, load recent all to populate AnalysisSection
      if (role !== 'Admin' && mapped.length === 0) {
        res = await fetch(`${BACKEND_BASE_URL}/reports?limit=200`);
        if (res.ok) {
          data = await res.json();
          mapped = (Array.isArray(data) ? data : []).map((doc: ReportDoc, idx: number) => {
            const ts = doc.timestamp ? new Date(doc.timestamp).toISOString() : new Date(doc.createdAt || Date.now()).toISOString();
            const idNum = typeof doc.id === 'number' ? doc.id : Date.parse(ts) + idx;
            return {
              id: idNum,
              timestamp: ts,
              consumption: doc.consumption,
              bill: doc.bill,
              total_kwh: doc.total_kwh,
              total_bill: doc.total_bill,
              tariffBracket: doc.tariffBracket || doc.tariff_bracket,
              householdData: doc.householdData || {
                region: doc.region,
                incomeLevel: doc.income_level,
                householdSize: doc.household_size,
                monthlyBudget: doc.budget
              },
              appliances: doc.appliances || [],
              breakdown: doc.breakdown || [],
              ownerId: doc.ownerId
            } as Report;
          });
        }
      }
      setReports(mapped);
    } catch (e) {
      console.warn('Failed to fetch reports from backend:', e);
    }
  };

  // Keep UI in the right landing section by role; also (re)load reports when role/household changes
  useEffect(() => {
    fetchReportsFromDB();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, currentHouseholdId]);

  const handleGenerateReport = async (reportData: Predictions) => {
    const newReport: Report = {
      ...reportData,
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ownerId: currentHouseholdId
    };
    setReports([...reports, newReport]);
    // Sync state with canonical DB data after save completes in PredictionSection
    try { await fetchReportsFromDB(); } catch (err) { console.warn('Refresh reports failed:', err); }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'admin':
  return role === 'Admin' ? <AdminSection reports={reports} /> : <div className="text-center text-black">Access denied.</div>;
      case 'prediction':
  return role === 'Household User' ? <PredictionSection onGenerateReport={handleGenerateReport} ownerId={currentHouseholdId} /> : <div className="text-center text-black">Prediction accessible to household users only.</div>;
      case 'analysis':
        return <AnalysisSection isAdmin={role === 'Admin'} reports={reports} />;
      case 'report':
        return <ReportSection isAdmin={role === 'Admin'} reports={reports} />;
      case 'settings':
        return (
          <SettingsSection
            userProfile={userProfile}
            onUpdateUserProfile={setUserProfile}
            isAdmin={role === 'Admin'}
          />
        );
      default:
        return <PredictionSection onGenerateReport={handleGenerateReport} ownerId={currentHouseholdId} />;
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

      {/* Household-only floating Feedback widget */}
      {role === 'Household User' && (
        <FeedbackWidget isAdmin={false} backendBaseUrl={BACKEND_BASE_URL} householdId={currentHouseholdId} />
      )}
    </div>
  );
}

export default App;