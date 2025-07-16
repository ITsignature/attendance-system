import React, { useState } from 'react';
import { Select } from "flowbite-react";

interface SettingOption {
  id: string;
  title: string;
  description: string;
  type: 'toggle' | 'dropdown';
  value?: boolean | string;
  options?: string[];
}

const SettingsPage = () => {
  const [settings, setSettings] = useState<Record<string, boolean | string>>({
    appearance: 'Light',
    language: 'English',
    twoFactorAuth: true,
    mobilePushNotifications: true,
    desktopNotifications: true,
    emailNotifications: true,
  });

  const toggleSetting = (settingId: string) => {
    setSettings(prev => ({
      ...prev,
      [settingId]: !prev[settingId]
    }));
  };

  const updateDropdownSetting = (settingId: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [settingId]: value
    }));
  };

  const settingsConfig: SettingOption[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      description: 'Customize how your theme looks on your device',
      type: 'dropdown',
      options: ['Light', 'Dark', 'System']
    },
    {
      id: 'language',
      title: 'Language',
      description: 'Select your language',
      type: 'dropdown',
      options: ['English', 'Spanish', 'French', 'German']
    },
    {
      id: 'twoFactorAuth',
      title: 'Two-factor Authentication',
      description: 'Keep your account secure by enabling 2FA via mail',
      type: 'toggle'
    },
    {
      id: 'mobilePushNotifications',
      title: 'Mobile Push Notifications',
      description: 'Receive push notification',
      type: 'toggle'
    },
    {
      id: 'desktopNotifications',
      title: 'Desktop Notification',
      description: 'Receive push notification in desktop',
      type: 'toggle'
    },
    {
      id: 'emailNotifications',
      title: 'Email Notifications',
      description: 'Receive email notification',
      type: 'toggle'
    }
  ];

  const ToggleSwitch = ({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={isOn}
        onChange={onToggle}
        className="sr-only peer"
      />
      <div className={`
        relative w-11 h-6 rounded-full peer-focus:outline-none transition-colors duration-200 ease-in-out
        ${isOn ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
      `}>
        <div className={`
          absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 transition-transform duration-200 ease-in-out
          ${isOn ? 'translate-x-5' : 'translate-x-0'}
        `} />
      </div>
    </label>
  );

  return (
    <div className="rounded-xl dark:shadow-dark-md shadow-md bg-white dark:bg-darkgray p-6 relative w-full break-words">
      <div className="mb-6">
        <h5 className="card-title text-2xl font-bold text-gray-800 dark:text-white">Settings</h5>
        <p className="text-gray-600 dark:text-gray-400 mt-1">All System settings</p>
      </div>
      
      <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-6 bg-blue-50/30 dark:bg-blue-900/10">
        <div className="space-y-8">
          {settingsConfig.map((setting) => (
            <div key={setting.id} className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">
                  {setting.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {setting.description}
                </p>
              </div>
              
              <div className="ml-6 flex-shrink-0">
                {setting.type === 'toggle' ? (
                  <ToggleSwitch
                    isOn={Boolean(settings[setting.id])}
                    onToggle={() => toggleSetting(setting.id)}
                  />
                ) : (
                  <div className="w-32">
                    <Select
                      value={String(settings[setting.id])}
                      onChange={(e) => updateDropdownSetting(setting.id, e.target.value)}
                      className="text-sm"
                      sizing="sm"
                    >
                      {setting.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Bottom Action Buttons */}
      <div className="mt-8 flex justify-end space-x-4">
        <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
          Reset to Default
        </button>
        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
