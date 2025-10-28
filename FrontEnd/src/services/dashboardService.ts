import { apiService } from './api';

// Dashboard API Service
export const dashboardService = {
  /**
   * Get dashboard overview statistics
   */
  async getOverview() {
    try {
      const response = await apiService.apiCall('/api/dashboard/overview');
      return response;
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      throw error;
    }
  },

  /**
   * Get weekly attendance overview
   */
  async getAttendanceOverview() {
    try {
      const response = await apiService.apiCall('/api/dashboard/attendance-overview');
      return response;
    } catch (error) {
      console.error('Error fetching attendance overview:', error);
      throw error;
    }
  },

  /**
   * Get employee distribution by department
   */
  async getEmployeeDistribution() {
    try {
      const response = await apiService.apiCall('/api/dashboard/employee-distribution');
      return response;
    } catch (error) {
      console.error('Error fetching employee distribution:', error);
      throw error;
    }
  },

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 10) {
    try {
      const response = await apiService.apiCall(`/api/dashboard/recent-activities?limit=${limit}`);
      return response;
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      throw error;
    }
  },

  /**
   * Get monthly attendance trends
   */
  async getAttendanceTrends(months: number = 6) {
    try {
      const response = await apiService.apiCall(`/api/dashboard/attendance-trends?months=${months}`);
      return response;
    } catch (error) {
      console.error('Error fetching attendance trends:', error);
      throw error;
    }
  }
};

export default dashboardService;
