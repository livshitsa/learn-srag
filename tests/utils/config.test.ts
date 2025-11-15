/**
 * Tests for configuration management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getConfig,
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  validateLLMConfig,
  resetConfig,
  Environment,
  LogLevel,
} from '../../src/utils/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    resetConfig();
  });

  describe('getConfig', () => {
    it('should load default configuration', () => {
      const config = getConfig();
      expect(config).toBeDefined();
      // When running tests, NODE_ENV is typically 'test'
      expect(['development', 'test']).toContain(config.NODE_ENV);
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.DB_PATH).toBe('data/databases/srag.db');
    });

    it('should parse environment variables correctly', () => {
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'error';
      process.env.DEFAULT_LLM_TEMPERATURE = '0.5';
      process.env.API_PORT = '8080';

      resetConfig();
      const config = getConfig();

      expect(config.NODE_ENV).toBe('production');
      expect(config.LOG_LEVEL).toBe('error');
      expect(config.DEFAULT_LLM_TEMPERATURE).toBe(0.5);
      expect(config.API_PORT).toBe(8080);
    });

    it('should cache configuration', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2); // Same object reference
    });

    it('should handle numeric string transformations', () => {
      process.env.SCHEMA_NUM_ITERATIONS = '6';
      process.env.EXTRACTION_BATCH_SIZE = '20';
      process.env.DEFAULT_LLM_MAX_TOKENS = '8192';

      resetConfig();
      const config = getConfig();

      expect(config.SCHEMA_NUM_ITERATIONS).toBe(6);
      expect(config.EXTRACTION_BATCH_SIZE).toBe(20);
      expect(config.DEFAULT_LLM_MAX_TOKENS).toBe(8192);
    });

    it('should handle boolean string transformations', () => {
      process.env.LOG_PRETTY = 'false';

      resetConfig();
      const config = getConfig();

      expect(config.LOG_PRETTY).toBe(false);
    });

    it('should validate environment values', () => {
      process.env.NODE_ENV = 'invalid';

      resetConfig();
      expect(() => getConfig()).toThrow(/validation failed/);
    });

    it('should validate numeric ranges', () => {
      process.env.DEFAULT_LLM_TEMPERATURE = '3.0'; // Too high

      resetConfig();
      expect(() => getConfig()).toThrow();
    });
  });

  describe('getEnvironment', () => {
    it('should return environment based on NODE_ENV', () => {
      // When running tests, NODE_ENV is typically 'test'
      const env = getEnvironment();
      expect([Environment.Development, Environment.Test]).toContain(env);
    });

    it('should return production environment', () => {
      process.env.NODE_ENV = 'production';
      resetConfig();
      expect(getEnvironment()).toBe(Environment.Production);
    });

    it('should return test environment', () => {
      process.env.NODE_ENV = 'test';
      resetConfig();
      expect(getEnvironment()).toBe(Environment.Test);
    });
  });

  describe('Environment helpers', () => {
    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      resetConfig();
      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      resetConfig();
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(true);
      expect(isTest()).toBe(false);
    });

    it('should detect test environment', () => {
      process.env.NODE_ENV = 'test';
      resetConfig();
      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(true);
    });
  });

  describe('validateLLMConfig', () => {
    it('should pass with OpenAI API key', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      resetConfig();
      expect(() => validateLLMConfig()).not.toThrow();
    });

    it('should pass with Anthropic API key', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      resetConfig();
      expect(() => validateLLMConfig()).not.toThrow();
    });

    it('should pass with both API keys', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      resetConfig();
      expect(() => validateLLMConfig()).not.toThrow();
    });

    it('should fail without any API keys', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      resetConfig();
      expect(() => validateLLMConfig()).toThrow(/at least one LLM API key/i);
    });
  });

  describe('resetConfig', () => {
    it('should clear cached configuration', () => {
      const config1 = getConfig();
      resetConfig();
      const config2 = getConfig();
      expect(config1).not.toBe(config2); // Different object reference
    });
  });

  describe('Default values', () => {
    it('should use correct defaults for LLM settings', () => {
      const config = getConfig();
      expect(config.DEFAULT_LLM_MODEL).toBe('gpt-4o');
      expect(config.DEFAULT_LLM_TEMPERATURE).toBe(0.7);
      expect(config.DEFAULT_LLM_MAX_TOKENS).toBe(4096);
    });

    it('should use correct defaults for schema settings', () => {
      const config = getConfig();
      expect(config.SCHEMA_NUM_ITERATIONS).toBe(4);
      expect(config.SCHEMA_NUM_SAMPLE_DOCS).toBe(12);
      expect(config.SCHEMA_NUM_SAMPLE_QUESTIONS).toBe(10);
    });

    it('should use correct defaults for extraction settings', () => {
      const config = getConfig();
      expect(config.EXTRACTION_BATCH_SIZE).toBe(10);
    });

    it('should use correct defaults for API settings', () => {
      const config = getConfig();
      expect(config.API_PORT).toBe(3000);
      expect(config.API_HOST).toBe('localhost');
    });
  });
});
