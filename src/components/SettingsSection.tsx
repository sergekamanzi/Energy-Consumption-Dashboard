import { Settings, Bell, User, Camera, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { UserProfile as SharedUserProfile } from '../types';

interface SettingsState {
  notifications: boolean;
  darkMode: boolean;
  autoSave: boolean;
  currency: string;
  language: string;
  budgetAlerts: boolean;
  highConsumptionWarnings: boolean;
  weeklyReports: boolean;
}


interface SettingsProps {
  userProfile: SharedUserProfile;
  onUpdateUserProfile: (u: SharedUserProfile) => void;
  isAdmin?: boolean;
}

const SettingsSection = ({ userProfile: initialProfile, onUpdateUserProfile, isAdmin = false }: SettingsProps) => {
  const [settings, setSettings] = useState<SettingsState>({
    notifications: true,
    darkMode: true,
    autoSave: true,
    currency: 'Rwandan Franc (RWF)',
    language: 'English',
    budgetAlerts: true,
    highConsumptionWarnings: true,
    weeklyReports: false,
  });

  const [userProfile, setUserProfile] = useState<SharedUserProfile>(initialProfile);

  useEffect(() => {
    setUserProfile(initialProfile);
  }, [initialProfile]);

  const [password, setPassword] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${
  checked ? 'bg-darkgreen-500' : 'bg-gray-300'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUserProfile({
          ...userProfile,
          profileImage: e.target?.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUserProfile(userProfile);
    alert('Profile updated successfully!');
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.newPassword !== password.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }
    // Handle password change logic here
    console.log('Changing password:', password);
    alert('Password changed successfully!');
    setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
  <div className="min-h-screen bg-gray-50 text-black p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Settings</h1>
          <p className="text-black">Manage your account and dashboard preferences</p>
        </div>

    {/* User Account Management Section (hide for Admin) */}
    {!isAdmin && (
      <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-blue-500" size={28} />
            <h2 className="text-2xl font-bold text-blue-500">Account Management</h2>
          </div>
          <p className="text-black mb-8">Manage your personal information and account settings</p>

          {/* Profile Image Section */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-darkgreen-500 flex items-center justify-center overflow-hidden">
                {userProfile.profileImage ? (
                  <img 
                    src={userProfile.profileImage} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={40} className="text-black" />
                )}
              </div>
              <label htmlFor="imageUpload" className="absolute bottom-0 right-0 bg-darkgreen-500 p-2 rounded-full cursor-pointer hover:bg-darkgreen-600 transition">
                <Camera size={16} className="text-white" />
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <h3 className="text-lg font-semibold">Profile Photo</h3>
              <p className="text-black text-sm">Click the camera icon to upload a new photo</p>
            </div>
          </div>

          {/* Personal Information Form */}
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-3">First Name</label>
                <input
                  type="text"
                  value={userProfile.firstName}
                  onChange={(e) => setUserProfile({...userProfile, firstName: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Last Name</label>
                <input
                  type="text"
                  value={userProfile.lastName}
                  onChange={(e) => setUserProfile({...userProfile, lastName: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-3">Email Address</label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Phone Number</label>
                <input
                  type="tel"
                  value={userProfile.phone}
                  onChange={(e) => setUserProfile({...userProfile, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 flex items-center gap-2">
                <MapPin size={16} />
                House Location
              </label>
              <input
                type="text"
                value={userProfile.houseLocation}
                onChange={(e) => setUserProfile({...userProfile, houseLocation: e.target.value})}
                placeholder="Enter your complete address"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                required
              />
              <p className="text-black text-sm mt-2">
                This helps us provide location-specific energy insights
              </p>
            </div>

            <button 
              type="submit"
              className="bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold px-8 py-3 rounded-lg transition"
            >
              Update Profile
            </button>
          </form>
  </div>
  )}

  {/* Change Password Section (hide for Admin) */}
  {!isAdmin && (
  <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-orange-500 mb-6">Change Password</h2>
          
          <form onSubmit={handlePasswordChange} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Current Password</label>
              <input
                type="password"
                value={password.currentPassword}
                onChange={(e) => setPassword({...password, currentPassword: e.target.value})}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-3">New Password</label>
                <input
                  type="password"
                  value={password.newPassword}
                  onChange={(e) => setPassword({...password, newPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Confirm New Password</label>
                <input
                  type="password"
                  value={password.confirmPassword}
                  onChange={(e) => setPassword({...password, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-lg transition"
            >
              Change Password
            </button>
          </form>
  </div>
  )}

        {/* General Settings Section */}
  <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-darkgreen-500" size={28} />
            <h2 className="text-2xl font-bold text-darkgreen-500">General Settings</h2>
          </div>
          <p className="text-black mb-8">Configure your dashboard preferences</p>

          <div className="space-y-6">
            {/* Enable Notifications */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">Enable Notifications</p>
                <p className="text-black text-sm">Receive alerts about energy consumption</p>
              </div>
              <ToggleSwitch
                checked={settings.notifications}
                onChange={() => setSettings({...settings, notifications: !settings.notifications})}
              />
            </div>

            {/* Dark Mode */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">Dark Mode</p>
                <p className="text-black text-sm">Use dark theme for the dashboard</p>
              </div>
              <ToggleSwitch
                checked={settings.darkMode}
                onChange={() => setSettings({...settings, darkMode: !settings.darkMode})}
              />
            </div>

            {/* Auto-Save Reports */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">Auto-Save Reports</p>
                <p className="text-black text-sm">Automatically save prediction reports</p>
              </div>
              <ToggleSwitch
                checked={settings.autoSave}
                onChange={() => setSettings({...settings, autoSave: !settings.autoSave})}
              />
            </div>

            {/* Currency and Language */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div>
                <label className="block text-sm font-medium mb-3">Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => setSettings({...settings, currency: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                >
                  <option>Rwandan Franc (RWF)</option>
                  <option>US Dollar (USD)</option>
                  <option>Euro (EUR)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => setSettings({...settings, language: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-black focus:outline-none focus:border-darkgreen-500"
                >
                  <option>English</option>
                  <option>Kinyarwanda</option>
                  <option>French</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button className="mt-8 bg-darkgreen-500 hover:bg-darkgreen-600 text-white font-bold px-8 py-3 rounded-lg transition">
            Save Settings
          </button>
        </div>

        {/* Notification Preferences Section */}
  <div className="bg-white rounded-2xl p-8 border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="text-orange-500" size={28} />
            <h2 className="text-2xl font-bold text-orange-500">Notification Preferences</h2>
          </div>
          <p className="text-black mb-8">Choose what notifications you want to receive</p>

          <div className="space-y-6">
            {/* Budget Alerts */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">Budget Alerts</p>
                <p className="text-black text-sm">Alert when bill exceeds budget</p>
              </div>
              <ToggleSwitch
                checked={settings.budgetAlerts}
                onChange={() => setSettings({...settings, budgetAlerts: !settings.budgetAlerts})}
              />
            </div>

            {/* High Consumption Warnings */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">High Consumption Warnings</p>
                <p className="text-black text-sm">Notify about unusual consumption patterns</p>
              </div>
              <ToggleSwitch
                checked={settings.highConsumptionWarnings}
                onChange={() => setSettings({...settings, highConsumptionWarnings: !settings.highConsumptionWarnings})}
              />
            </div>

            {/* Weekly Reports */}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold mb-1">Weekly Reports</p>
                <p className="text-black text-sm">Receive weekly energy summary</p>
              </div>
              <ToggleSwitch
                checked={settings.weeklyReports}
                onChange={() => setSettings({...settings, weeklyReports: !settings.weeklyReports})}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSection;