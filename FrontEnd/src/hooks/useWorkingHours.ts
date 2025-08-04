import { useState, useEffect } from 'react';
import settingsApi from '../services/settingsApi';

export const useWorkingHours = () => {
  const [workingHours, setWorkingHours] = useState({
    start_time: '09:00',
    end_time: '17:00',
    hours_per_day: 8,
    late_threshold: 15,
    overtime_rate: 1.5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkingHours = async () => {
      try {
        const hours = await settingsApi.getWorkingHours();
        setWorkingHours(hours);
      } catch (error) {
        console.error('Failed to fetch working hours:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkingHours();
  }, []);

  return { workingHours, loading };
};