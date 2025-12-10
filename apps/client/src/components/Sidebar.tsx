import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiLogOut, FiHome, FiLayers, FiSettings, FiX } from 'react-icons/fi';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [llmProvider, setLlmProvider] = useState<string>('azure');
  const [isLoadingLLM, setIsLoadingLLM] = useState(false);

  const navItems = [
    { label: 'Capability Master', path: '/dashboard', icon: FiHome },
    { label: 'Capability Compass', path: '/dashboard/research-agent', icon: FiLayers },
  ];

  // Load current LLM provider on mount
  useEffect(() => {
    const fetchLLMProvider = async () => {
      try {
        const response = await fetch('/api/settings/llm-provider');
        const data = await response.json();
        setLlmProvider(data.provider);
      } catch (error) {
        console.error('Failed to fetch LLM provider:', error);
      }
    };
    fetchLLMProvider();
  }, []);

  const handleLLMChange = async (provider: string) => {
    setIsLoadingLLM(true);
    try {
      const response = await fetch('/api/settings/llm-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error('Failed to change LLM provider');
      await response.json();
      setLlmProvider(provider);
      toast.success(`Switched to ${provider.toUpperCase()} LLM`);
    } catch (error) {
      console.error('Error changing LLM provider:', error);
      toast.error('Failed to change LLM provider');
    } finally {
      setIsLoadingLLM(false);
    }
  };

  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && <h2 className="font-bold text-lg text-gray-900">Compass</h2>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-gray-100 rounded-md"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={collapsed ? item.label : ''}
            >
              <Icon size={20} />
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer with Settings */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
          title={collapsed ? 'Settings' : ''}
        >
          <FiSettings size={20} />
          {!collapsed && <span className="text-sm">Settings</span>}
        </button>

        {showSettings && !collapsed && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">LLM Provider</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                <FiX size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="llm-provider"
                  value="azure"
                  checked={llmProvider === 'azure'}
                  onChange={() => handleLLMChange('azure')}
                  disabled={isLoadingLLM}
                  className="cursor-pointer"
                />
                <span className="text-sm text-gray-700">Azure OpenAI</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="llm-provider"
                  value="gemini"
                  checked={llmProvider === 'gemini'}
                  onChange={() => handleLLMChange('gemini')}
                  disabled={isLoadingLLM}
                  className="cursor-pointer"
                />
                <span className="text-sm text-gray-700">Google Gemini</span>
              </label>
            </div>
            {isLoadingLLM && <p className="text-xs text-gray-500 mt-2">Updating...</p>}
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
          title={collapsed ? 'Logout' : ''}
        >
          <FiLogOut size={20} />
          {!collapsed && <span className="text-sm">Exit</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;


