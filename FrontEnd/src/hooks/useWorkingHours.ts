import { useState, useEffect } from 'react';
import settingsApi from '../services/settingsApi';

export const useWorkingHours = () => {
  const [workingHours, setWorkingHours] = useState({
    start_time: '09:00',
    end_time: '17:00',
    hours_per_day: 8,
    late_threshold: 15,
    overtime_rate: 1.5,
    full_day_minimum_hours: 7,
    half_day_minimum_hours: 4,
    short_leave_minimum_hours: 1,
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

  // Updated helper methods with new parameter names
  const isShortLeave = (totalHours: number) => {
    return totalHours >= workingHours.short_leave_minimum_hours && 
           totalHours < workingHours.half_day_minimum_hours;
  };

  const isHalfDay = (totalHours: number) => {
    return totalHours >= workingHours.half_day_minimum_hours && 
           totalHours < workingHours.full_day_minimum_hours;
  };

  const isFullDay = (totalHours: number) => {
    return totalHours >= workingHours.full_day_minimum_hours;
  };

  const getWorkDurationType = (totalHours: number) => {
    if (totalHours === 0) return 'absent';
    if (totalHours < workingHours.short_leave_minimum_hours) return 'absent'; // Less than 1 hour
    if (isShortLeave(totalHours)) return 'short_leave';
    if (isHalfDay(totalHours)) return 'half_day';
    if (isFullDay(totalHours)) return 'full_day';
    return 'full_day'; // Default fallback
  };

  const calculateTotalHours = (checkInTime: string, checkOutTime: string, breakMinutes: number = 0) => {
    if (!checkInTime || !checkOutTime) return 0;
    
    try {
      const checkIn = new Date(`2000-01-01 ${checkInTime}`);
      const checkOut = new Date(`2000-01-01 ${checkOutTime}`);
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const totalMinutes = Math.max(0, (diffMs / (1000 * 60)) - breakMinutes);
      return Math.round(totalMinutes / 60 * 100) / 100; // Convert to hours with 2 decimal places
    } catch (error) {
      console.error('Error calculating hours:', error);
      return 0;
    }
  };

  const calculateOvertimeHours = (totalHours: number) => {
    const dailyHours = workingHours.hours_per_day;
    return totalHours > dailyHours ? totalHours - dailyHours : 0;
  };

  return { 
    workingHours, 
    loading,
    // Updated helper methods
    isShortLeave,
    isHalfDay,
    isFullDay,
    getWorkDurationType, // Renamed from getAttendanceType
    calculateTotalHours,
    calculateOvertimeHours
  };
};