/**
 * Tests for helper utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseJSON,
  parseJSONWithFallback,
  stringifyJSON,
  readFileAsText,
  readJSONFile,
  writeFileAsText,
  writeJSONFile,
  fileExists,
  sleep,
  retry,
  extractJSON,
  truncateString,
  capitalize,
  toCamelCase,
  toSnakeCase,
  isString,
  isNumber,
  isBoolean,
  isNull,
  isUndefined,
  isNullOrUndefined,
  isObject,
  isArray,
  isError,
  chunkArray,
  unique,
  getNestedProperty,
  deepClone,
} from '../../src/utils/helpers.js';

describe('Helpers', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for file tests
    tempDir = await mkdtemp(join(tmpdir(), 'srag-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore errors
    }
  });

  describe('JSON parsing', () => {
    describe('parseJSON', () => {
      it('should parse valid JSON', () => {
        const result = parseJSON('{"name": "test"}');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'test' });
        }
      });

      it('should handle parse errors', () => {
        const result = parseJSON('invalid json');
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBeInstanceOf(Error);
        }
      });

      it('should parse arrays', () => {
        const result = parseJSON('[1, 2, 3]');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([1, 2, 3]);
        }
      });

      it('should parse primitive values', () => {
        const result = parseJSON('"hello"');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('hello');
        }
      });
    });

    describe('parseJSONWithFallback', () => {
      it('should return parsed data on success', () => {
        const result = parseJSONWithFallback('{"name": "test"}', {});
        expect(result).toEqual({ name: 'test' });
      });

      it('should return fallback on error', () => {
        const fallback = { default: true };
        const result = parseJSONWithFallback('invalid', fallback);
        expect(result).toEqual(fallback);
      });
    });

    describe('stringifyJSON', () => {
      it('should stringify object', () => {
        const result = stringifyJSON({ name: 'test' });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('{"name":"test"}');
        }
      });

      it('should pretty print when requested', () => {
        const result = stringifyJSON({ name: 'test' }, true);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toContain('\n');
          expect(result.data).toContain('  ');
        }
      });

      it('should handle circular references', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        const result = stringifyJSON(circular);
        expect(result.success).toBe(false);
      });
    });

    describe('extractJSON', () => {
      it('should extract JSON object from text', () => {
        const result = extractJSON('Here is data: {"name": "test"} and more');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'test' });
        }
      });

      it('should extract JSON array from text', () => {
        const result = extractJSON('Data: [1, 2, 3]');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual([1, 2, 3]);
        }
      });

      it('should handle text without JSON', () => {
        const result = extractJSON('No JSON here');
        expect(result.success).toBe(false);
      });

      it('should prefer object over array', () => {
        const result = extractJSON('[1, 2] and {"name": "test"}');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'test' });
        }
      });
    });
  });

  describe('File operations', () => {
    describe('readFileAsText', () => {
      it('should read file contents', async () => {
        const filePath = join(tempDir, 'test.txt');
        await writeFileAsText(filePath, 'Hello, World!');

        const result = await readFileAsText(filePath);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe('Hello, World!');
        }
      });

      it('should handle missing files', async () => {
        const result = await readFileAsText(join(tempDir, 'missing.txt'));
        expect(result.success).toBe(false);
      });
    });

    describe('readJSONFile', () => {
      it('should read and parse JSON file', async () => {
        const filePath = join(tempDir, 'data.json');
        await writeJSONFile(filePath, { name: 'test' });

        const result = await readJSONFile(filePath);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual({ name: 'test' });
        }
      });

      it('should handle invalid JSON in file', async () => {
        const filePath = join(tempDir, 'invalid.json');
        await writeFileAsText(filePath, 'not json');

        const result = await readJSONFile(filePath);
        expect(result.success).toBe(false);
      });
    });

    describe('writeFileAsText', () => {
      it('should write text to file', async () => {
        const filePath = join(tempDir, 'output.txt');
        const result = await writeFileAsText(filePath, 'Test content');

        expect(result.success).toBe(true);
        expect(await fileExists(filePath)).toBe(true);
      });

      it('should create directories when requested', async () => {
        const filePath = join(tempDir, 'nested', 'dir', 'file.txt');
        const result = await writeFileAsText(filePath, 'Test', true);

        expect(result.success).toBe(true);
        expect(await fileExists(filePath)).toBe(true);
      });

      it('should fail if directory does not exist and createDirs is false', async () => {
        const filePath = join(tempDir, 'missing', 'file.txt');
        const result = await writeFileAsText(filePath, 'Test', false);

        expect(result.success).toBe(false);
      });
    });

    describe('writeJSONFile', () => {
      it('should write JSON to file', async () => {
        const filePath = join(tempDir, 'data.json');
        const data = { name: 'test', value: 123 };

        const result = await writeJSONFile(filePath, data);
        expect(result.success).toBe(true);

        const readResult = await readJSONFile(filePath);
        if (readResult.success) {
          expect(readResult.data).toEqual(data);
        }
      });

      it('should pretty print JSON by default', async () => {
        const filePath = join(tempDir, 'pretty.json');
        await writeJSONFile(filePath, { name: 'test' });

        const readResult = await readFileAsText(filePath);
        if (readResult.success) {
          expect(readResult.data).toContain('\n');
        }
      });

      it('should create directories when requested', async () => {
        const filePath = join(tempDir, 'nested', 'data.json');
        const result = await writeJSONFile(filePath, { test: true }, true, true);

        expect(result.success).toBe(true);
        expect(await fileExists(filePath)).toBe(true);
      });
    });

    describe('fileExists', () => {
      it('should return true for existing file', async () => {
        const filePath = join(tempDir, 'exists.txt');
        await writeFileAsText(filePath, 'content');

        expect(await fileExists(filePath)).toBe(true);
      });

      it('should return false for missing file', async () => {
        expect(await fileExists(join(tempDir, 'missing.txt'))).toBe(false);
      });
    });
  });

  describe('Async utilities', () => {
    describe('sleep', () => {
      it('should delay execution', async () => {
        const start = Date.now();
        await sleep(100);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(90); // Allow small margin
      });
    });

    describe('retry', () => {
      it('should succeed on first attempt', async () => {
        let attempts = 0;
        const result = await retry(async () => {
          attempts++;
          return 'success';
        });

        expect(result).toBe('success');
        expect(attempts).toBe(1);
      });

      it('should retry on failure', async () => {
        let attempts = 0;
        const result = await retry(
          async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Fail');
            }
            return 'success';
          },
          3,
          10
        );

        expect(result).toBe('success');
        expect(attempts).toBe(3);
      });

      it('should throw after max retries', async () => {
        await expect(
          retry(
            async () => {
              throw new Error('Always fails');
            },
            3,
            10
          )
        ).rejects.toThrow('Always fails');
      });
    });
  });

  describe('String utilities', () => {
    describe('truncateString', () => {
      it('should truncate long strings', () => {
        expect(truncateString('Hello, World!', 8)).toBe('Hello...');
      });

      it('should not truncate short strings', () => {
        expect(truncateString('Hello', 10)).toBe('Hello');
      });

      it('should use custom suffix', () => {
        expect(truncateString('Hello, World!', 8, '…')).toBe('Hello, …');
      });
    });

    describe('capitalize', () => {
      it('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
      });

      it('should handle already capitalized', () => {
        expect(capitalize('Hello')).toBe('Hello');
      });

      it('should handle empty string', () => {
        expect(capitalize('')).toBe('');
      });
    });

    describe('toCamelCase', () => {
      it('should convert snake_case to camelCase', () => {
        expect(toCamelCase('hello_world')).toBe('helloWorld');
      });

      it('should convert spaces to camelCase', () => {
        expect(toCamelCase('Hello World')).toBe('helloWorld');
      });

      it('should handle already camelCase', () => {
        expect(toCamelCase('helloWorld')).toBe('helloworld');
      });
    });

    describe('toSnakeCase', () => {
      it('should convert camelCase to snake_case', () => {
        expect(toSnakeCase('helloWorld')).toBe('hello_world');
      });

      it('should convert spaces to snake_case', () => {
        expect(toSnakeCase('Hello World')).toBe('hello_world');
      });

      it('should handle already snake_case', () => {
        expect(toSnakeCase('hello_world')).toBe('hello_world');
      });
    });
  });

  describe('Type guards', () => {
    it('should detect strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString(123)).toBe(false);
    });

    it('should detect numbers', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber(NaN)).toBe(false);
      expect(isNumber('123')).toBe(false);
    });

    it('should detect booleans', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
      expect(isBoolean(1)).toBe(false);
    });

    it('should detect null', () => {
      expect(isNull(null)).toBe(true);
      expect(isNull(undefined)).toBe(false);
      expect(isNull(0)).toBe(false);
    });

    it('should detect undefined', () => {
      expect(isUndefined(undefined)).toBe(true);
      expect(isUndefined(null)).toBe(false);
    });

    it('should detect null or undefined', () => {
      expect(isNullOrUndefined(null)).toBe(true);
      expect(isNullOrUndefined(undefined)).toBe(true);
      expect(isNullOrUndefined(0)).toBe(false);
    });

    it('should detect objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ name: 'test' })).toBe(true);
      expect(isObject([])).toBe(false);
      expect(isObject(null)).toBe(false);
    });

    it('should detect arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray({})).toBe(false);
    });

    it('should detect errors', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError({ message: 'test' })).toBe(false);
    });
  });

  describe('Array utilities', () => {
    describe('chunkArray', () => {
      it('should chunk array into smaller arrays', () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      });

      it('should handle empty array', () => {
        expect(chunkArray([], 2)).toEqual([]);
      });

      it('should handle chunk size larger than array', () => {
        expect(chunkArray([1, 2], 5)).toEqual([[1, 2]]);
      });
    });

    describe('unique', () => {
      it('should remove duplicates', () => {
        expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      });

      it('should handle empty array', () => {
        expect(unique([])).toEqual([]);
      });

      it('should preserve order', () => {
        expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
      });
    });
  });

  describe('Object utilities', () => {
    describe('getNestedProperty', () => {
      it('should get nested property', () => {
        const obj = { a: { b: { c: 123 } } };
        expect(getNestedProperty(obj, 'a.b.c', 0)).toBe(123);
      });

      it('should return default for missing property', () => {
        const obj = { a: { b: {} } };
        expect(getNestedProperty(obj, 'a.b.c', 'default')).toBe('default');
      });

      it('should handle top-level properties', () => {
        const obj = { name: 'test' };
        expect(getNestedProperty(obj, 'name', '')).toBe('test');
      });
    });

    describe('deepClone', () => {
      it('should deep clone object', () => {
        const original = { a: 1, b: { c: 2 } };
        const cloned = deepClone(original);

        cloned.b.c = 3;
        expect(original.b.c).toBe(2);
        expect(cloned.b.c).toBe(3);
      });

      it('should clone arrays', () => {
        const original = [1, [2, 3]];
        const cloned = deepClone(original);

        cloned[1][0] = 999;
        expect(original[1][0]).toBe(2);
      });
    });
  });
});
