const { getDB } = require('../config/database');

class SessionCleanupService {
  constructor() {
    this.intervalId = null;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const db = getDB();
      
      // Update all expired sessions to inactive
      const [result] = await db.execute(`
        UPDATE user_sessions 
        SET is_active = FALSE 
        WHERE expires_at < NOW() 
        AND is_active = TRUE
      `);

      if (result.affectedRows > 0) {
        console.log(`[SessionCleanup] Deactivated ${result.affectedRows} expired sessions at ${new Date().toISOString()}`);
      }

      // Optional: Delete very old sessions (older than 30 days)
      const [deleteResult] = await db.execute(`
        DELETE FROM user_sessions 
        WHERE expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);

      if (deleteResult.affectedRows > 0) {
        console.log(`[SessionCleanup] Deleted ${deleteResult.affectedRows} old sessions`);
      }

      return {
        deactivated: result.affectedRows,
        deleted: deleteResult.affectedRows
      };
    } catch (error) {
      console.error('[SessionCleanup] Error during cleanup:', error);
      // Don't throw - let the service continue running
    }
  }

  /**
   * Start the cleanup service
   * @param {number} intervalMinutes - Interval in minutes (default: 30)
   */
  start(intervalMinutes = 30) {
    // Run cleanup immediately on start
    console.log(`[SessionCleanup] Starting session cleanup service...`);
    this.cleanupExpiredSessions();

    // Set up recurring cleanup
    this.intervalId = setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMinutes * 60 * 1000);

    console.log(`[SessionCleanup] Service running every ${intervalMinutes} minutes`);
  }

  /**
   * Stop the cleanup service
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SessionCleanup] Service stopped');
    }
  }
}

// Create and export singleton instance
module.exports = new SessionCleanupService();