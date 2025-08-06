export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
  overtime_hours?: number;
  break_duration?: number;
  arrival_status: 'on_time' | 'late' | 'absent';
  work_duration: 'full_day' | 'half_day' | 'short_leave' | 'on_leave';
  work_type: 'office' | 'remote' | 'hybrid';
  notes?: string;
  scheduled_in_time?: string;
  scheduled_out_time?: string;
  follows_company_schedule?: boolean;
  department_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceFilters {
  page: number;
  limit: number;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  arrival_status?: string;
  work_duration?: string;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
}

export interface AttendanceFormData {
  employee_id: string;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  arrival_status?: 'on_time' | 'late' | 'absent';
  work_duration?: 'full_day' | 'half_day' | 'short_leave' | 'on_leave';
  break_duration?: number;
  work_type: 'office' | 'remote' | 'hybrid';
  notes?: string;
}

export interface CalculationInfo {
  scheduled_start: string;
  scheduled_end: string;
  late_threshold_minutes: number;
  standard_working_hours: number;
  duration_thresholds: {
    full_day_minimum_hours: number;
    half_day_minimum_hours: number;
    short_leave_minimum_hours: number;
    working_hours_per_day: number;
  };
  arrival_status_auto_determined: boolean;
  work_duration_auto_determined: boolean;
  follows_company_schedule: boolean;
}