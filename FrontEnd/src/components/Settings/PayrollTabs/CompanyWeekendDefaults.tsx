import React, { useState, useEffect } from 'react';
import { Button, Spinner, Alert, ToggleSwitch } from 'flowbite-react';
import settingsApiService from '../../../services/settingsApi';

interface DaySchedule {
  working: boolean;
  full_day_salary: boolean;
  monthly_schedule: Record<string, number[]>;
}

interface WeekendConfig {
  saturday: DaySchedule;
  sunday: DaySchedule;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ORDINALS = ['1st','2nd','3rd','4th','5th'];

const emptyDay = (): DaySchedule => ({
  working: false,
  full_day_salary: false,
  monthly_schedule: {},
});

const emptyConfig = (): WeekendConfig => ({
  saturday: emptyDay(),
  sunday: emptyDay(),
});

// ---- month-picker helpers ----

function getDayOccurrences(year: number, month: number, dayOfWeek: number) {
  const result: { date: Date; nth: number }[] = [];
  const d = new Date(year, month, 1);
  let nth = 0;
  while (d.getMonth() === month) {
    if (d.getDay() === dayOfWeek) { nth++; result.push({ date: new Date(d), nth }); }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function MonthPicker({
  label,
  dayOfWeek,
  schedule,
  viewYear,
  viewMonth,
  onPrev,
  onNext,
  onToggle,
}: {
  label: string;
  dayOfWeek: number;
  schedule: Record<string, number[]>;
  viewYear: number;
  viewMonth: number;
  onPrev: () => void;
  onNext: () => void;
  onToggle: (yearMonth: string, nth: number, checked: boolean) => void;
}) {
  const yearMonth = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const occurrences = getDayOccurrences(viewYear, viewMonth, dayOfWeek);
  const currentPattern: number[] = schedule[yearMonth] || [];

  return (
    <div className="mt-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onPrev}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          &#8592;
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[80px] text-center">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
        >
          &#8594;
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {occurrences.map(({ date, nth }) => {
          const checked = currentPattern.includes(nth);
          return (
            <label key={nth} className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(yearMonth, nth, checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {ORDINALS[nth - 1]} ({date.getDate()}/{date.getMonth() + 1})
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Configure each month separately. Use arrows to switch months.
      </p>
    </div>
  );
}

// ---- main component ----

const CompanyWeekendDefaults: React.FC = () => {
  const now = new Date();
  const [config, setConfig] = useState<WeekendConfig>(emptyConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [satViewYear, setSatViewYear] = useState(now.getFullYear());
  const [satViewMonth, setSatViewMonth] = useState(now.getMonth());
  const [sunViewYear, setSunViewYear] = useState(now.getFullYear());
  const [sunViewMonth, setSunViewMonth] = useState(now.getMonth());

  useEffect(() => {
    (async () => {
      try {
        const res = await settingsApiService.getCompanyWeekendDefaults();
        if (res.success && res.data) {
          setConfig({
            saturday: { ...emptyDay(), ...res.data.saturday },
            sunday: { ...emptyDay(), ...res.data.sunday },
          });
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load company weekend defaults');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateDay = (day: 'saturday' | 'sunday', patch: Partial<DaySchedule>) => {
    setConfig(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const toggleOccurrence = (day: 'saturday' | 'sunday', yearMonth: string, nth: number, wasChecked: boolean) => {
    const prev = config[day].monthly_schedule;
    const current: number[] = prev[yearMonth] || [];
    const updated = wasChecked ? current.filter(n => n !== nth) : [...current, nth].sort((a, b) => a - b);
    updateDay(day, { monthly_schedule: { ...prev, [yearMonth]: updated } });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        saturday: config.saturday.working ? config.saturday : { working: false, full_day_salary: false, monthly_schedule: {} },
        sunday: config.sunday.working ? config.sunday : { working: false, full_day_salary: false, monthly_schedule: {} },
      };
      const res = await settingsApiService.updateCompanyWeekendDefaults(payload);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.message || 'Failed to save');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
        <span className="ml-3 text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Company Default Weekend Schedule</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Set the default monthly working Saturday/Sunday schedule for the company.
          Employees configured to "Use company default" will automatically follow this schedule.
        </p>
      </div>

      {error && <Alert color="failure" onDismiss={() => setError(null)}>{error}</Alert>}
      {success && <Alert color="success" onDismiss={() => setSuccess(false)}>Company weekend defaults saved successfully.</Alert>}

      {/* Saturday */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-medium text-gray-800 dark:text-white">Saturday</h4>
          <ToggleSwitch
            checked={config.saturday.working}
            label={config.saturday.working ? 'Working day' : 'Non-working day'}
            onChange={(v) => updateDay('saturday', { working: v })}
          />
        </div>

        {config.saturday.working && (
          <div className="space-y-3 ml-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.saturday.full_day_salary}
                onChange={(e) => updateDay('saturday', { full_day_salary: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Full day salary (same weight as weekday)</span>
            </label>

            <MonthPicker
              label="Working Saturdays per month"
              dayOfWeek={6}
              schedule={config.saturday.monthly_schedule}
              viewYear={satViewYear}
              viewMonth={satViewMonth}
              onPrev={() => { const d = new Date(satViewYear, satViewMonth - 1); setSatViewYear(d.getFullYear()); setSatViewMonth(d.getMonth()); }}
              onNext={() => { const d = new Date(satViewYear, satViewMonth + 1); setSatViewYear(d.getFullYear()); setSatViewMonth(d.getMonth()); }}
              onToggle={(ym, nth, was) => toggleOccurrence('saturday', ym, nth, was)}
            />
          </div>
        )}
      </div>

      {/* Sunday */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-base font-medium text-gray-800 dark:text-white">Sunday</h4>
          <ToggleSwitch
            checked={config.sunday.working}
            label={config.sunday.working ? 'Working day' : 'Non-working day'}
            onChange={(v) => updateDay('sunday', { working: v })}
          />
        </div>

        {config.sunday.working && (
          <div className="space-y-3 ml-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.sunday.full_day_salary}
                onChange={(e) => updateDay('sunday', { full_day_salary: e.target.checked })}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Full day salary (same weight as weekday)</span>
            </label>

            <MonthPicker
              label="Working Sundays per month"
              dayOfWeek={0}
              schedule={config.sunday.monthly_schedule}
              viewYear={sunViewYear}
              viewMonth={sunViewMonth}
              onPrev={() => { const d = new Date(sunViewYear, sunViewMonth - 1); setSunViewYear(d.getFullYear()); setSunViewMonth(d.getMonth()); }}
              onNext={() => { const d = new Date(sunViewYear, sunViewMonth + 1); setSunViewYear(d.getFullYear()); setSunViewMonth(d.getMonth()); }}
              onToggle={(ym, nth, was) => toggleOccurrence('sunday', ym, nth, was)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button color="blue" onClick={handleSave} disabled={saving}>
          {saving ? <><Spinner size="sm" className="mr-2" />Saving...</> : 'Save Defaults'}
        </Button>
      </div>
    </div>
  );
};

export default CompanyWeekendDefaults;
