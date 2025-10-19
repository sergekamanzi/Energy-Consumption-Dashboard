import { useState } from 'react';
import { ChevronDown, CreditCard, User } from 'lucide-react';
import type { UserProfile } from '../types';

interface NavbarProps {
  setShowPaymentModal: (show: boolean) => void;
  selectedRole: 'Admin' | 'Household User';
  setSelectedRole: (r: 'Admin' | 'Household User') => void;
  householdId?: string;
  userProfile?: UserProfile;
}

const Navbar = ({ setShowPaymentModal, selectedRole, setSelectedRole, householdId, userProfile }: NavbarProps) => {
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const handlePaymentSelect = () => {
    setShowPaymentModal(true);
    setShowPaymentDropdown(false);
  };

  return (
  <nav className="bg-white border-b-2 border-darkgreen-500 p-4 flex justify-between items-center">
      <div>
        <h2 className="text-2xl font-bold text-orange-500">Dashboard</h2>
  <p className="text-sm text-darkgreen-500">Household Energy Management</p>
      </div>

  <div className="flex items-center gap-6">
        {/* Role dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="bg-gray-100 hover:bg-gray-200 text-black px-4 py-2 rounded flex items-center space-x-2 transition"
          >
            <User size={18} />
            <span className="text-sm">{selectedRole}</span>
            <ChevronDown size={14} />
          </button>
          {/** small household id badge shown for household users */}
          {selectedRole === 'Household User' && householdId && (
            <div className="ml-2 inline-block bg-gray-100 border border-darkgreen-600 text-sm text-black px-2 py-1 rounded">
              {householdId}
            </div>
          )}

          {showRoleDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-darkgreen-500 rounded shadow-lg z-50">
              <button
                onClick={() => { setSelectedRole('Admin'); setShowRoleDropdown(false); }}
                className={`w-full px-4 py-3 text-left hover:bg-darkgreen-500 hover:text-black transition border-b border-gray-200 ${selectedRole === 'Admin' ? 'font-bold' : ''}`}
              >
                Admin
              </button>
              <button
                onClick={() => { setSelectedRole('Household User'); setShowRoleDropdown(false); }}
                className={`w-full px-4 py-3 text-left hover:bg-darkgreen-500 hover:text-black transition ${selectedRole === 'Household User' ? 'font-bold' : ''}`}
              >
                Household User
              </button>
            </div>
          )}
        </div>

        {selectedRole === 'Household User' && (
        <div className="hidden md:flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 border border-darkgreen-500 overflow-hidden flex items-center justify-center">
            {userProfile?.profileImage ? (
              <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-black" />
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-black">{userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Guest User'}</p>
            <p className="text-xs text-gray-500">{selectedRole}</p>
          </div>
        </div>
        )}

        {selectedRole === 'Household User' && (
        <div className="relative">
        <button
          onClick={() => setShowPaymentDropdown(!showPaymentDropdown)}
          className="bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold px-6 py-3 rounded flex items-center space-x-2 transition"
        >
          <CreditCard size={20} />
          <span>Pay Energy Bill</span>
          <ChevronDown size={16} />
        </button>

        {showPaymentDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white border-2 border-darkgreen-500 rounded shadow-lg z-50">
            <button
              onClick={handlePaymentSelect}
              className="w-full px-4 py-3 text-left hover:bg-darkgreen-500 hover:text-white transition"
            >
              MTN MoMo
            </button>
          </div>
        )}
  </div>
  )}
      </div>
    </nav>
  );
};

export default Navbar;
