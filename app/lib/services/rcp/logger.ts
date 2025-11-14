/**
 * Structured logging for RCP extraction
 */

import { LogEntry, ProviderName } from './types';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableSteps: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG',
  enableConsole: true,
  enableSteps: process.env.LOG_EXTRACTION_STEPS === 'true',
};

/**
 * Log level priorities
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Structured logger for RCP extraction
 */
export class Logger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a debug message
   */
  debug(
    requestId: string,
    message: string,
    data?: any,
    provider?: ProviderName,
    step?: string,
    duration?: number
  ): void {
    this.log('DEBUG', requestId, message, data, provider, step, duration);
  }

  /**
   * Log an info message
   */
  info(
    requestId: string,
    message: string,
    data?: any,
    provider?: ProviderName,
    step?: string,
    duration?: number
  ): void {
    this.log('INFO', requestId, message, data, provider, step, duration);
  }

  /**
   * Log a warning message
   */
  warn(
    requestId: string,
    message: string,
    data?: any,
    provider?: ProviderName,
    step?: string,
    duration?: number
  ): void {
    this.log('WARN', requestId, message, data, provider, step, duration);
  }

  /**
   * Log an error message
   */
  error(
    requestId: string,
    message: string,
    data?: any,
    provider?: ProviderName,
    step?: string,
    duration?: number
  ): void {
    this.log('ERROR', requestId, message, data, provider, step, duration);
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    requestId: string,
    message: string,
    data?: any,
    provider?: ProviderName,
    step?: string,
    duration?: number
  ): void {
    // Check if this log level should be recorded
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    // Skip step logs if not enabled
    if (step && !this.config.enableSteps && level === 'DEBUG') {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
      provider,
      step,
      data,
      duration,
    };

    // Store log entry
    this.logs.push(entry);

    // Console output if enabled
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }
  }

  /**
   * Output log entry to console
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level}] [${entry.requestId}]`;
    const providerStr = entry.provider ? ` [${entry.provider}]` : '';
    const stepStr = entry.step ? ` [${entry.step}]` : '';
    const durationStr = entry.duration !== undefined ? ` (${entry.duration}ms)` : '';
    
    const message = `${prefix}${providerStr}${stepStr} ${entry.message}${durationStr}`;

    switch (entry.level) {
      case 'DEBUG':
        console.debug(message, entry.data || '');
        break;
      case 'INFO':
        console.info(message, entry.data || '');
        break;
      case 'WARN':
        console.warn(message, entry.data || '');
        break;
      case 'ERROR':
        console.error(message, entry.data || '');
        break;
    }
  }

  /**
   * Get all logs for a request
   */
  getLogsForRequest(requestId: string): LogEntry[] {
    return this.logs.filter(log => log.requestId === requestId);
  }

  /**
   * Get all logs
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Enable/disable console output
   */
  setConsoleOutput(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  /**
   * Enable/disable step logging
   */
  setStepLogging(enabled: boolean): void {
    this.config.enableSteps = enabled;
  }
}

/**
 * Singleton logger instance
 */
export const logger = new Logger();
