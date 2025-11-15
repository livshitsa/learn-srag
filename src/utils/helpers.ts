/**
 * Utility Helper Functions
 *
 * Common utility functions for file operations, JSON parsing, string manipulation,
 * type guards, and validations.
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { dirname } from 'path';
import { constants } from 'fs';

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

/**
 * Parse JSON with error handling
 *
 * @param jsonString - JSON string to parse
 * @returns Result with parsed data or error
 *
 * @example
 * ```typescript
 * const result = parseJSON('{"name": "test"}');
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function parseJSON<T = unknown>(jsonString: string): Result<T> {
  try {
    const data = JSON.parse(jsonString) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Parse JSON with fallback value
 *
 * @param jsonString - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed data or fallback value
 *
 * @example
 * ```typescript
 * const config = parseJSONWithFallback('invalid', { default: true });
 * ```
 */
export function parseJSONWithFallback<T>(jsonString: string, fallback: T): T {
  const result = parseJSON<T>(jsonString);
  return result.success ? result.data : fallback;
}

/**
 * Stringify JSON with error handling
 *
 * @param data - Data to stringify
 * @param pretty - Whether to pretty-print the JSON
 * @returns Result with stringified JSON or error
 *
 * @example
 * ```typescript
 * const result = stringifyJSON({ name: 'test' }, true);
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export function stringifyJSON(data: unknown, pretty = false): Result<string> {
  try {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    return { success: true, data: json };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Read file as text
 *
 * @param filePath - Path to file
 * @returns Result with file contents or error
 *
 * @example
 * ```typescript
 * const result = await readFileAsText('./data.txt');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export async function readFileAsText(filePath: string): Promise<Result<string>> {
  try {
    const data = await readFile(filePath, 'utf-8');
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Read JSON file
 *
 * @param filePath - Path to JSON file
 * @returns Result with parsed JSON or error
 *
 * @example
 * ```typescript
 * const result = await readJSONFile<Config>('./config.json');
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */
export async function readJSONFile<T = unknown>(filePath: string): Promise<Result<T>> {
  const fileResult = await readFileAsText(filePath);
  if (!fileResult.success) {
    return fileResult;
  }

  return parseJSON<T>(fileResult.data);
}

/**
 * Write text to file
 *
 * @param filePath - Path to file
 * @param content - Content to write
 * @param createDirs - Whether to create parent directories if they don't exist
 * @returns Result with void or error
 *
 * @example
 * ```typescript
 * const result = await writeFileAsText('./output.txt', 'Hello', true);
 * if (!result.success) {
 *   console.error(result.error);
 * }
 * ```
 */
export async function writeFileAsText(
  filePath: string,
  content: string,
  createDirs = false
): Promise<Result<void>> {
  try {
    if (createDirs) {
      const dir = dirname(filePath);
      await mkdir(dir, { recursive: true });
    }
    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Write JSON to file
 *
 * @param filePath - Path to file
 * @param data - Data to write
 * @param pretty - Whether to pretty-print the JSON
 * @param createDirs - Whether to create parent directories if they don't exist
 * @returns Result with void or error
 *
 * @example
 * ```typescript
 * const result = await writeJSONFile('./data.json', { name: 'test' }, true, true);
 * ```
 */
export async function writeJSONFile(
  filePath: string,
  data: unknown,
  pretty = true,
  createDirs = false
): Promise<Result<void>> {
  const jsonResult = stringifyJSON(data, pretty);
  if (!jsonResult.success) {
    return jsonResult;
  }

  return writeFileAsText(filePath, jsonResult.data, createDirs);
}

/**
 * Check if file exists
 *
 * @param filePath - Path to file
 * @returns True if file exists and is readable
 *
 * @example
 * ```typescript
 * if (await fileExists('./config.json')) {
 *   console.log('Config file found');
 * }
 * ```
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * await sleep(1000); // Wait 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds (doubles each retry)
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchData(),
 *   3,
 *   1000
 * );
 * ```
 */
export async function retry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Extract JSON from text that may contain other content
 *
 * Looks for JSON objects or arrays in the text and attempts to parse them.
 *
 * @param text - Text containing JSON
 * @returns Result with parsed JSON or error
 *
 * @example
 * ```typescript
 * const result = extractJSON('Here is the data: {"name": "test"} and more text');
 * if (result.success) {
 *   console.log(result.data); // { name: 'test' }
 * }
 * ```
 */
export function extractJSON<T = unknown>(text: string): Result<T> {
  // Try to find JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const result = parseJSON<T>(objectMatch[0]);
    if (result.success) {
      return result;
    }
  }

  // Try to find JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const result = parseJSON<T>(arrayMatch[0]);
    if (result.success) {
      return result;
    }
  }

  return {
    success: false,
    error: new Error('No valid JSON found in text'),
  };
}

/**
 * Truncate string to specified length
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to append if truncated (default: '...')
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * truncateString('Hello, World!', 8); // 'Hello...'
 * ```
 */
export function truncateString(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter of string
 *
 * @param str - String to capitalize
 * @returns Capitalized string
 *
 * @example
 * ```typescript
 * capitalize('hello'); // 'Hello'
 * ```
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert string to camelCase
 *
 * @param str - String to convert
 * @returns camelCase string
 *
 * @example
 * ```typescript
 * toCamelCase('hello_world'); // 'helloWorld'
 * toCamelCase('Hello World'); // 'helloWorld'
 * ```
 */
export function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match: string, chr: string) => chr.toUpperCase());
}

/**
 * Convert string to snake_case
 *
 * @param str - String to convert
 * @returns snake_case string
 *
 * @example
 * ```typescript
 * toSnakeCase('helloWorld'); // 'hello_world'
 * toSnakeCase('Hello World'); // 'hello_world'
 * ```
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_'); // Replace multiple underscores with single
}

/**
 * Type guard: check if value is string
 *
 * @param value - Value to check
 * @returns True if value is string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard: check if value is number
 *
 * @param value - Value to check
 * @returns True if value is number and not NaN
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard: check if value is boolean
 *
 * @param value - Value to check
 * @returns True if value is boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard: check if value is null
 *
 * @param value - Value to check
 * @returns True if value is null
 */
export function isNull(value: unknown): value is null {
  return value === null;
}

/**
 * Type guard: check if value is undefined
 *
 * @param value - Value to check
 * @returns True if value is undefined
 */
export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

/**
 * Type guard: check if value is null or undefined
 *
 * @param value - Value to check
 * @returns True if value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Type guard: check if value is object (excluding null and arrays)
 *
 * @param value - Value to check
 * @returns True if value is an object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: check if value is array
 *
 * @param value - Value to check
 * @returns True if value is array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard: check if value is Error
 *
 * @param value - Value to check
 * @returns True if value is Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Chunk array into smaller arrays
 *
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 *
 * @example
 * ```typescript
 * chunkArray([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Remove duplicates from array
 *
 * @param array - Array with potential duplicates
 * @returns Array with unique values
 *
 * @example
 * ```typescript
 * unique([1, 2, 2, 3, 3, 3]); // [1, 2, 3]
 * ```
 */
export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Safely get nested property from object
 *
 * @param obj - Object to access
 * @param path - Path to property (e.g., 'a.b.c')
 * @param defaultValue - Default value if path not found
 * @returns Value at path or default value
 *
 * @example
 * ```typescript
 * const obj = { a: { b: { c: 123 } } };
 * getNestedProperty(obj, 'a.b.c', 0); // 123
 * getNestedProperty(obj, 'a.b.d', 0); // 0
 * ```
 */
export function getNestedProperty<T>(
  obj: Record<string, unknown>,
  path: string,
  defaultValue: T
): T {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (isObject(current) && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current as T;
}

/**
 * Deep clone an object (JSON-serializable objects only)
 *
 * @param obj - Object to clone
 * @returns Cloned object
 *
 * @example
 * ```typescript
 * const original = { a: 1, b: { c: 2 } };
 * const cloned = deepClone(original);
 * cloned.b.c = 3; // original.b.c is still 2
 * ```
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Debounce function execution
 *
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```typescript
 * const debouncedLog = debounce(console.log, 1000);
 * debouncedLog('Hello'); // Only logs if no other call within 1 second
 * ```
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function execution
 *
 * @param fn - Function to throttle
 * @param limit - Minimum time between executions in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```typescript
 * const throttledLog = throttle(console.log, 1000);
 * throttledLog('Hello'); // Executes immediately
 * throttledLog('World'); // Ignored if within 1 second
 * ```
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
