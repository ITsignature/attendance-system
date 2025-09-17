const fs = require('fs').promises;
const path = require('path');

class PayrollLogger {
    constructor() {
        this.logs = [];
        this.isActive = false;
        this.logFilePath = null;
        this.originalConsoleLog = console.log;
        this.originalConsoleError = console.error;
        this.originalConsoleWarn = console.warn;
    }

    /**
     * Start capturing console logs for payroll calculation
     * @param {string} runId - Payroll run ID
     */
    startLogging(runId) {
        this.isActive = true;
        this.logs = [];

        // Create logs directory if it doesn't exist
        const logsDir = path.join(__dirname, '../../logs');
        this.ensureDirectoryExists(logsDir);

        // Create unique log file with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFilePath = path.join(logsDir, `payroll-run-${runId}-${timestamp}.txt`);

        // Override console methods to capture logs
        console.log = (...args) => {
            this.captureLog('LOG', ...args);
            this.originalConsoleLog(...args); // Still show in console
        };

        console.error = (...args) => {
            this.captureLog('ERROR', ...args);
            this.originalConsoleError(...args); // Still show in console
        };

        console.warn = (...args) => {
            this.captureLog('WARN', ...args);
            this.originalConsoleWarn(...args); // Still show in console
        };

        this.addLog('INFO', `🚀 Payroll calculation logging started for run: ${runId}`);
        this.addLog('INFO', `📁 Log file: ${this.logFilePath}`);
        this.addLog('INFO', `⏰ Started at: ${new Date().toISOString()}`);
        this.addLog('INFO', '=' .repeat(80));
    }

    /**
     * Stop capturing logs and save to file
     */
    async stopLogging() {
        if (!this.isActive) return null;

        this.addLog('INFO', '=' .repeat(80));
        this.addLog('INFO', `⏰ Completed at: ${new Date().toISOString()}`);
        this.addLog('INFO', `📊 Total log entries: ${this.logs.length}`);

        // Restore original console methods
        console.log = this.originalConsoleLog;
        console.error = this.originalConsoleError;
        console.warn = this.originalConsoleWarn;

        // Save logs to file
        try {
            const logContent = this.logs.join('\n');
            await fs.writeFile(this.logFilePath, logContent, 'utf8');

            this.originalConsoleLog(`✅ Payroll logs saved to: ${this.logFilePath}`);

            const filePath = this.logFilePath;
            this.reset();

            return filePath;
        } catch (error) {
            this.originalConsoleError('❌ Error saving payroll logs:', error);
            this.reset();
            return null;
        }
    }

    /**
     * Capture console output
     * @private
     */
    captureLog(level, ...args) {
        if (!this.isActive) return;

        const timestamp = new Date().toISOString();
        const message = args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');

        const logEntry = `[${timestamp}] [${level}] ${message}`;
        this.logs.push(logEntry);
    }

    /**
     * Add custom log entry
     * @private
     */
    addLog(level, message) {
        if (!this.isActive) return;

        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        this.logs.push(logEntry);
    }

    /**
     * Ensure directory exists
     * @private
     */
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.mkdir(dirPath, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    /**
     * Reset logger state
     * @private
     */
    reset() {
        this.isActive = false;
        this.logs = [];
        this.logFilePath = null;
    }

    /**
     * Get current log file path
     */
    getLogFilePath() {
        return this.logFilePath;
    }

    /**
     * Check if logging is active
     */
    isLogging() {
        return this.isActive;
    }
}

// Export singleton instance
module.exports = new PayrollLogger();