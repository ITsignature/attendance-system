import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = `${import.meta.env?.VITE_API_URL || 'http://localhost:5000'}/api`;

// Create axios instance with auth
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add auth token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    console.log('🔍 Holiday Service Interceptor - Token:', token ? `${token.substring(0, 20)}...` : 'NULL');
    console.log('🔍 Holiday Service Interceptor - Headers before:', config.headers);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Holiday Service Interceptor - Added Authorization header');
    } else {
      console.warn('⚠️ Holiday Service Interceptor - No token found in localStorage');
    }

    console.log('🔍 Holiday Service Interceptor - Headers after:', config.headers);
    return config;
  },
  (error) => {
    console.error('❌ Holiday Service Interceptor - Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token is invalid, clear it but don't auto-redirect
      console.error('Authentication failed. Please log in again.');
      localStorage.removeItem('accessToken');
      // Let the component handle the error instead of auto-redirecting
    }
    return Promise.reject(error);
  }
);

export interface Holiday {
  id?: string;
  name: string;
  date: string;
  description?: string;
  is_optional?: boolean;
  applies_to_all?: boolean;
  department_ids?: string[] | null;
  department_names?: string;
  created_at?: string;
  updated_at?: string;
}

export interface HolidayFilters {
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}

export interface WorkingDaysCalculation {
  start_date: string;
  end_date: string;
  working_days: number;
  total_days: number;
  holidays_excluded: number;
  include_holidays: boolean;
}

export interface BulkHolidayResult {
  success: boolean;
  total_processed: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  details: {
    created: Array<{ id: string; name: string; date: string }>;
    updated: Array<{ id: string; name: string; date: string; previous_name: string }>;
    skipped: Array<{ name: string; date: string; reason: string }>;
    errors: Array<{ name: string; date: string; error: string }>;
  };
}

class HolidayService {
  
  // =============================================
  // CRUD OPERATIONS
  // =============================================
  
  /**
   * Get all holidays with optional filters
   */
  async getHolidays(filters: HolidayFilters = {}): Promise<{ 
    data: Holiday[]; 
    pagination: any 
  }> {
    try {
      const response = await api.get('/holidays', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching holidays:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific holiday by ID
   */
  async getHoliday(id: string): Promise<Holiday> {
    try {
      const response = await api.get(`/holidays/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching holiday:', error);
      throw error;
    }
  }
  
  /**
   * Create a new holiday
   */
  async createHoliday(holiday: Omit<Holiday, 'id'>): Promise<Holiday> {
    try {
      const response = await api.post('/holidays', holiday);
      return response.data.data;
    } catch (error) {
      console.error('Error creating holiday:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing holiday
   */
  async updateHoliday(id: string, holiday: Partial<Holiday>): Promise<Holiday> {
    try {
      const response = await api.put(`/holidays/${id}`, holiday);
      return response.data.data;
    } catch (error) {
      console.error('Error updating holiday:', error);
      throw error;
    }
  }
  
  /**
   * Delete a holiday
   */
  async deleteHoliday(id: string): Promise<void> {
    try {
      await api.delete(`/holidays/${id}`);
    } catch (error) {
      console.error('Error deleting holiday:', error);
      throw error;
    }
  }
  
  // =============================================
  // UTILITY OPERATIONS
  // =============================================
  
  /**
   * Calculate working days in a period
   */
  async calculateWorkingDays(
    startDate: string, 
    endDate: string, 
    includeHolidays = false
  ): Promise<WorkingDaysCalculation> {
    try {
      const response = await api.get('/holidays/utils/working-days', {
        params: {
          start_date: startDate,
          end_date: endDate,
          include_holidays: includeHolidays
        }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error calculating working days:', error);
      throw error;
    }
  }
  
  /**
   * Bulk create holidays
   */
  async bulkCreateHolidays(holidays: Omit<Holiday, 'id'>[]): Promise<BulkHolidayResult> {
    try {
      const response = await api.post('/holidays/bulk', { holidays });
      return response.data;
    } catch (error) {
      console.error('Error bulk creating holidays:', error);
      throw error;
    }
  }
  
  // =============================================
  // HELPER FUNCTIONS FOR FRONTEND
  // =============================================
  
  /**
   * Get holidays for a specific year
   */
  async getHolidaysForYear(year: number): Promise<Holiday[]> {
    try {
      const response = await this.getHolidays({ year, limit: 100 });
      return response.data;
    } catch (error) {
      console.error(`Error fetching holidays for year ${year}:`, error);
      return [];
    }
  }
  
  /**
   * Check if a date is a holiday
   */
  async isHoliday(date: string): Promise<boolean> {
    try {
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const holidays = await this.getHolidaysForYear(year);
      
      return holidays.some(holiday => holiday.date === date);
    } catch (error) {
      console.error('Error checking if date is holiday:', error);
      return false;
    }
  }
  
  /**
   * Get holiday name for a specific date
   */
  async getHolidayForDate(date: string): Promise<Holiday | null> {
    try {
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const holidays = await this.getHolidaysForYear(year);
      
      return holidays.find(holiday => holiday.date === date) || null;
    } catch (error) {
      console.error('Error getting holiday for date:', error);
      return null;
    }
  }
  
  /**
   * Format date for display
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    });
  }
  
  /**
   * Get day of week for a date
   */
  getDay(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  /**
   * Generate Sri Lankan holidays for a year (using backend)
   */
  async importSriLankanHolidays(year: number): Promise<BulkHolidayResult> {
    // Generate Sri Lankan holidays
    const holidays = this.generateSriLankanHolidayList(year);
    
    // Bulk import them
    return await this.bulkCreateHolidays(holidays);
  }
  
  /**
   * Generate Sri Lankan holiday list for a specific year
   */
  private generateSriLankanHolidayList(year: number): Omit<Holiday, 'id'>[] {
    return [
      { name: "New Year's Day", date: `${year}-01-01`, is_optional: false },
      { name: "Duruthu Full Moon Poya Day", date: `${year}-01-13`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Tamil Thai Pongal Day", date: `${year}-01-14`, is_optional: false },
      { name: "Independence Day", date: `${year}-02-04`, is_optional: false },
      { name: "Navam Full Moon Poya Day", date: `${year}-02-12`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Mahasivarathri Day", date: `${year}-02-26`, is_optional: false },
      { name: "Medin Full Moon Poya Day", date: `${year}-03-13`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Id-Ul-Fitr (Ramazan Festival Day)", date: `${year}-03-31`, is_optional: false },
      { name: "Bak Full Moon Poya Day", date: `${year}-04-12`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Day prior to Sinhala & Tamil New Year", date: `${year}-04-13`, is_optional: false },
      { name: "Sinhala & Tamil New Year Day", date: `${year}-04-14`, is_optional: false },
      { name: "Good Friday", date: `${year}-04-18`, is_optional: false },
      { name: "May Day (International Workers' Day)", date: `${year}-05-01`, is_optional: false },
      { name: "Vesak Full Moon Poya Day", date: `${year}-05-12`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Day following Vesak Full Moon Poya Day", date: `${year}-05-13`, is_optional: false },
      { name: "Id-Ul-Alha (Hadji Festival Day)", date: `${year}-06-07`, is_optional: false },
      { name: "Poson Full Moon Poya Day", date: `${year}-06-10`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Esala Full Moon Poya Day", date: `${year}-07-10`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Nikini Full Moon Poya Day", date: `${year}-08-08`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Milad-Un-Nabi (Holy Prophet's Birthday)", date: `${year}-09-05`, is_optional: false },
      { name: "Binara Full Moon Poya Day", date: `${year}-09-07`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Vap Full Moon Poya Day", date: `${year}-10-06`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Deepavali Festival Day", date: `${year}-10-20`, is_optional: false },
      { name: "Ill Full Moon Poya Day", date: `${year}-11-05`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Unduvap Full Moon Poya Day", date: `${year}-12-04`, is_optional: false, description: "Full Moon Poya Day" },
      { name: "Christmas Day", date: `${year}-12-25`, is_optional: false }
    ];
  }
}

export const holidayService = new HolidayService();
export default holidayService;