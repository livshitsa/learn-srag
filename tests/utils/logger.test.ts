/**
 * Tests for logging system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Logger, createLogger, logger } from '../../src/utils/logger.js';
import { resetConfig, LogLevel } from '../../src/utils/config.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetConfig();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env = originalEnv;
    resetConfig();
  });

  describe('Logger instance', () => {
    it('should create logger instance', () => {
      const testLogger = new Logger();
      expect(testLogger).toBeDefined();
    });

    it('should create logger with context', () => {
      const testLogger = new Logger({ module: 'test' });
      testLogger.info('Test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Log levels', () => {
    it('should log debug messages', () => {
      process.env.LOG_LEVEL = 'debug';
      resetConfig();
      const testLogger = new Logger();
      testLogger.debug('Debug message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });

    it('should log info messages', () => {
      const testLogger = new Logger();
      testLogger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalledOnce();
    });

    it('should log warn messages', () => {
      const testLogger = new Logger();
      testLogger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledOnce();
    });

    it('should log error messages', () => {
      const testLogger = new Logger();
      testLogger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it('should not log debug when level is info', () => {
      process.env.LOG_LEVEL = 'info';
      resetConfig();
      const testLogger = new Logger();
      testLogger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should only log errors when level is error', () => {
      process.env.LOG_LEVEL = 'error';
      resetConfig();
      const testLogger = new Logger();

      testLogger.debug('Debug');
      testLogger.info('Info');
      testLogger.warn('Warn');
      testLogger.error('Error');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Context logging', () => {
    it('should include context in log output', () => {
      const testLogger = new Logger();
      testLogger.info('Test', { userId: '123' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('userId');
    });

    it('should merge constructor and call context', () => {
      const testLogger = new Logger({ module: 'test' });
      testLogger.info('Test', { action: 'create' });

      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('module');
      expect(logOutput).toContain('action');
    });
  });

  describe('Error logging', () => {
    it('should log error object', () => {
      const testLogger = new Logger();
      const error = new Error('Test error');
      testLogger.error('Operation failed', error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('Test error');
    });

    it('should log error with context', () => {
      const testLogger = new Logger();
      const error = new Error('Test error');
      testLogger.error('Operation failed', error, { userId: '123' });

      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('Test error');
      expect(logOutput).toContain('userId');
    });

    it('should log error without error object', () => {
      const testLogger = new Logger();
      testLogger.error('Operation failed', { userId: '123' });

      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('Operation failed');
      expect(logOutput).toContain('userId');
    });
  });

  describe('Child logger', () => {
    it('should create child logger with merged context', () => {
      const parentLogger = new Logger({ service: 'api' });
      const childLogger = parentLogger.child({ requestId: '123' });

      childLogger.info('Request processed');

      const logOutput = consoleLogSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('service');
      expect(logOutput).toContain('requestId');
    });

    it('should not affect parent logger context', () => {
      const parentLogger = new Logger({ service: 'api' });
      const childLogger = parentLogger.child({ requestId: '123' });

      parentLogger.info('Parent log');
      childLogger.info('Child log');

      const parentOutput = consoleLogSpy.mock.calls[0][0] as string;
      const childOutput = consoleLogSpy.mock.calls[1][0] as string;

      expect(parentOutput).toContain('service');
      expect(parentOutput).not.toContain('requestId');
      expect(childOutput).toContain('service');
      expect(childOutput).toContain('requestId');
    });
  });

  describe('Log level management', () => {
    it('should get current log level', () => {
      const testLogger = new Logger();
      expect(testLogger.getLevel()).toBe(LogLevel.Info);
    });

    it('should set log level dynamically', () => {
      const testLogger = new Logger();
      testLogger.setLevel(LogLevel.Error);
      expect(testLogger.getLevel()).toBe(LogLevel.Error);

      testLogger.info('Info message');
      testLogger.error('Error message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('Log formatting', () => {
    it('should format with pretty output in development', () => {
      process.env.LOG_PRETTY = 'true';
      resetConfig();
      const testLogger = new Logger();
      testLogger.info('Test message');

      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain('Test message');
      expect(output).toContain('INFO');
    });

    it('should format as JSON when not pretty', () => {
      process.env.LOG_PRETTY = 'false';
      resetConfig();
      const testLogger = new Logger();
      testLogger.info('Test message', { key: 'value' });

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.message).toBe('Test message');
      expect(parsed.level).toBe('info');
      expect(parsed.context.key).toBe('value');
    });

    it('should include timestamp in logs', () => {
      const testLogger = new Logger();
      testLogger.info('Test');

      const output = consoleLogSpy.mock.calls[0][0] as string;
      // Check for ISO timestamp format
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('createLogger', () => {
    it('should create logger with context', () => {
      const testLogger = createLogger({ module: 'test' });
      testLogger.info('Test');

      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain('module');
    });

    it('should create logger without context', () => {
      const testLogger = createLogger();
      testLogger.info('Test');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Default logger export', () => {
    it('should export default logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toBeInstanceOf(Logger);
    });
  });
});
