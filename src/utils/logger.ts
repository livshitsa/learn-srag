/**
 * Logging System
 *
 * Provides structured logging with multiple log levels, timestamps,
 * and context support. Log level is configurable via environment variables.
 */

import { getConfig, LogLevel } from './config.js';

/**
 * Log entry interface for structured logging
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * Logger class
 */
export class Logger {
  private logLevel: LogLevel;
  private pretty: boolean;

  /**
   * Create a new logger instance
   *
   * @param context - Optional context to include with all logs
   */
  constructor(private context?: Record<string, unknown>) {
    const config = getConfig();
    this.logLevel = config.LOG_LEVEL as LogLevel;
    this.pretty = config.LOG_PRETTY;
  }

  /**
   * Format timestamp in ISO format
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = [LogLevel.Debug, LogLevel.Info, LogLevel.Warn, LogLevel.Error];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log entry
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.pretty) {
      // Pretty formatted output for development
      const levelColors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m', // Green
        warn: '\x1b[33m', // Yellow
        error: '\x1b[31m', // Red
      };
      const resetColor = '\x1b[0m';
      const color = levelColors[entry.level];

      let output = `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${resetColor}: ${entry.message}`;

      if (entry.context || this.context) {
        const combinedContext = { ...this.context, ...entry.context };
        output += `\n  Context: ${JSON.stringify(combinedContext, null, 2)}`;
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  Stack: ${entry.error.stack}`;
        }
      }

      return output;
    } else {
      // JSON formatted output for production
      return JSON.stringify({
        ...entry,
        context: { ...this.context, ...entry.context },
      });
    }
  }

  /**
   * Write log entry to console
   */
  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const formatted = this.formatLogEntry(entry);

    switch (entry.level) {
      case LogLevel.Debug:
      case LogLevel.Info:
        console.log(formatted);
        break;
      case LogLevel.Warn:
        console.warn(formatted);
        break;
      case LogLevel.Error:
        console.error(formatted);
        break;
    }
  }

  /**
   * Log a debug message
   *
   * @param message - Log message
   * @param context - Optional context data
   *
   * @example
   * ```typescript
   * logger.debug('Processing document', { documentId: '123' });
   * ```
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.Debug,
      message,
      context,
    });
  }

  /**
   * Log an info message
   *
   * @param message - Log message
   * @param context - Optional context data
   *
   * @example
   * ```typescript
   * logger.info('Server started', { port: 3000 });
   * ```
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.Info,
      message,
      context,
    });
  }

  /**
   * Log a warning message
   *
   * @param message - Log message
   * @param context - Optional context data
   *
   * @example
   * ```typescript
   * logger.warn('API key missing', { provider: 'openai' });
   * ```
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.Warn,
      message,
      context,
    });
  }

  /**
   * Log an error message
   *
   * @param message - Log message
   * @param errorOrContext - Error object or context data
   * @param context - Optional context data (if first param is Error)
   *
   * @example
   * ```typescript
   * logger.error('Failed to process document', error, { documentId: '123' });
   * logger.error('Operation failed', { operation: 'delete' });
   * ```
   */
  error(
    message: string,
    errorOrContext?: Error | Record<string, unknown>,
    context?: Record<string, unknown>
  ): void {
    const isError = errorOrContext instanceof Error;
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.Error,
      message,
      error: isError ? errorOrContext : undefined,
      context: isError ? context : errorOrContext,
    });
  }

  /**
   * Create a child logger with additional context
   *
   * @param childContext - Additional context to merge with parent context
   * @returns New logger instance with merged context
   *
   * @example
   * ```typescript
   * const baseLogger = new Logger({ service: 'api' });
   * const requestLogger = baseLogger.child({ requestId: '123' });
   * requestLogger.info('Request processed'); // Includes both service and requestId
   * ```
   */
  child(childContext: Record<string, unknown>): Logger {
    return new Logger({ ...this.context, ...childContext });
  }

  /**
   * Set log level dynamically
   *
   * @param level - New log level
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.logLevel;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with specific context
 *
 * @param context - Context to include with all logs
 * @returns New logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger({ module: 'schema-predictor' });
 * logger.info('Starting schema prediction');
 * ```
 */
export function createLogger(context?: Record<string, unknown>): Logger {
  return new Logger(context);
}
