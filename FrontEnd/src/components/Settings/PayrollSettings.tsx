import React, { useState } from 'react';
import { Settings, DollarSign, Minus, Calculator } from 'lucide-react';
import PayrollComponents from './PayrollTabs/PayrollComponents';
import EmployeeAllowances from './PayrollTabs/EmployeeAllowances';
import EmployeeDeductions from './PayrollTabs/EmployeeDeductions';

type PayrollTab = 'components' | 'allowances' | 'deductions';

const PayrollSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PayrollTab>('components');

  const tabs = [
    {
      id: 'components' as PayrollTab,
      name: 'Components',
      icon: Calculator,
      description: 'Manage payroll components and calculation methods'
    },
    {
      id: 'allowances' as PayrollTab,
      name: 'Employee Allowances',
      icon: DollarSign,
      description: 'Assign allowances to individual employees'
    },
    {
      id: 'deductions' as PayrollTab,
      name: 'Employee Deductions',
      icon: Minus,
      description: 'Manage employee-specific deductions'
    }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'components':
        return <PayrollComponents />;
      case 'allowances':
        return <EmployeeAllowances />;
      case 'deductions':
        return <EmployeeDeductions />;
      default:
        return <PayrollComponents />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center mb-2">
          <Settings className="w-6 h-6 mr-3 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Payroll Component Configuration
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Configure payroll components, employee allowances, and deductions
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon
                  className={`-ml-0.5 mr-2 h-5 w-5 transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                  }`}
                />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg">
        <div className="p-6">
          {/* Tab Description */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>

          {/* Tab Content */}
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default PayrollSettings;