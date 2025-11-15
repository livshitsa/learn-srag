/**
 * Configuration Management
 *
 * Handles loading and validation of environment variables using Zod.
 * Supports multiple environments (development, production, test) with
 * appropriate defaults and type-safe configuration objects.
 */

import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

/**
 * Load environment variables from .env file
 */
loadEnv({ path: join(PROJECT_ROOT, '.env') });

/**
 * Environment type enum
 */
export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Log level enum
 */
export enum LogLevel {
  Debug = 'debug',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

/**
 * Zod schema for environment variables
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // LLM API keys (at least one required for LLM operations)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Database configuration
  DB_PATH: z.string().default('data/databases/srag.db'),

  // LLM configuration
  DEFAULT_LLM_MODEL: z.string().default('gpt-4o'),
  DEFAULT_LLM_TEMPERATURE: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().min(0).max(2))
    .default('0.7'),
  DEFAULT_LLM_MAX_TOKENS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('4096'),

  // Schema prediction configuration
  SCHEMA_NUM_ITERATIONS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('4'),
  SCHEMA_NUM_SAMPLE_DOCS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('12'),
  SCHEMA_NUM_SAMPLE_QUESTIONS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),

  // Record extraction configuration
  EXTRACTION_BATCH_SIZE: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('10'),

  // Query configuration
  QUERY_TIMEOUT_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('30000'),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .default('true'),

  // API configuration
  API_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('3000'),
  API_HOST: z.string().default('localhost'),

  // Evaluation configuration
  EVAL_NUM_PARALLEL: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive())
    .default('5'),
});

/**
 * Type-safe configuration object
 */
export type Config = z.infer<typeof envSchema>;

/**
 * Parsed and validated configuration
 */
let cachedConfig: Config | null = null;

/**
 * Get validated configuration
 *
 * Loads environment variables and validates them against the schema.
 * Caches the result for performance.
 *
 * @returns Validated configuration object
 * @throws {Error} If validation fails
 *
 * @example
 * ```typescript
 * const config = getConfig();
 * console.log(config.OPENAI_API_KEY);
 * console.log(config.DEFAULT_LLM_MODEL);
 * ```
 */
export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    cachedConfig = envSchema.parse(process.env);
    return cachedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('\n');
      throw new Error(`Environment variable validation failed:\n${errorMessages}`);
    }
    throw error;
  }
}

/**
 * Get environment type
 *
 * @returns Current environment (development, production, or test)
 *
 * @example
 * ```typescript
 * if (getEnvironment() === Environment.Development) {
 *   console.log('Running in development mode');
 * }
 * ```
 */
export function getEnvironment(): Environment {
  const config = getConfig();
  return config.NODE_ENV as Environment;
}

/**
 * Check if running in development mode
 *
 * @returns True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return getEnvironment() === Environment.Development;
}

/**
 * Check if running in production mode
 *
 * @returns True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return getEnvironment() === Environment.Production;
}

/**
 * Check if running in test mode
 *
 * @returns True if NODE_ENV is 'test'
 */
export function isTest(): boolean {
  return getEnvironment() === Environment.Test;
}

/**
 * Validate that required LLM API keys are present
 *
 * @throws {Error} If no API keys are configured
 */
export function validateLLMConfig(): void {
  const config = getConfig();
  if (!config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY) {
    throw new Error(
      'At least one LLM API key must be configured (OPENAI_API_KEY or ANTHROPIC_API_KEY)'
    );
  }
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}
