import { LayoutGrid, Target, BarChart3, FileText, Settings, LucideIcon } from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  role: 'Admin' | 'Household User';
}

const Sidebar = ({ activeSection, setActiveSection, role }: SidebarProps) => {
  const adminMenu: MenuItem[] = [
    { id: 'admin', label: 'Admin', icon: LayoutGrid },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'report', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const householdMenu: MenuItem[] = [
    { id: 'prediction', label: 'Prediction', icon: Target },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'report', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const menuItems = role === 'Admin' ? adminMenu : householdMenu;

  return (
  <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-0 border-b border-gray-200">
        <img
          src="/logo1.png"
          alt="Rwanda Energy logo"
          className="h-42 w-60 object-contain"
        />
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-6 px-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full px-6 py-4 mb-2 flex items-center space-x-4 rounded-xl transition font-medium text-lg ${
                  isActive
                    ? 'bg-darkgreen-100 text-darkgreen-600 border border-darkgreen-200'
                    : 'text-black hover:bg-gray-100 hover:text-black'
                }`}
            >
              <Icon size={24} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Version Info */}
      <div className="p-6 border-t border-gray-200">
        <div className="bg-gray-50 rounded-lg p-4">
          <img
            src="/logo2.png"
            alt="Rwanda Energy logo"
            className="h-15 w-50 object-contain mx-auto"
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;