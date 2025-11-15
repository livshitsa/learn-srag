/**
 * Tests for Record model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSONSchema } from '../../src/models/schema.js';
import { Record } from '../../src/models/record.js';
import { ValidationError } from '../../src/models/types.js';

describe('Record', () => {
  let schema: JSONSchema;

  beforeEach(() => {
    schema = new JSONSchema({
      title: 'Person Schema',
      description: 'Schema for person records',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Person name',
          examples: ['John Doe'],
        },
        age: {
          type: 'integer',
          description: 'Person age',
          examples: [25],
        },
        salary: {
          type: 'number',
          description: 'Annual salary',
          examples: [50000.5],
        },
        isActive: {
          type: 'boolean',
          description: 'Active status',
          examples: [true],
        },
      },
      required: ['name', 'age'],
    });
  });

  describe('constructor', () => {
    it('should create a valid record', () => {
      const data = {
        name: 'John Doe',
        age: 30,
        salary: 75000,
        isActive: true,
      };
      const record = new Record(data, schema);
      expect(record.getValue('name')).toBe('John Doe');
      expect(record.getValue('age')).toBe(30);
    });

    it('should throw ValidationError for invalid type', () => {
      const data = {
        name: 123, // Should be string
        age: 30,
      };
      expect(() => new Record(data, schema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing required field', () => {
      const data = {
        name: 'John Doe',
        // age is missing but required
      };
      expect(() => new Record(data, schema)).toThrow(ValidationError);
    });

    it('should throw ValidationError for extra fields', () => {
      const data = {
        name: 'John Doe',
        age: 30,
        extraField: 'not in schema',
      };
      expect(() => new Record(data, schema)).toThrow(ValidationError);
    });

    it('should allow optional fields to be missing', () => {
      const data = {
        name: 'John Doe',
        age: 30,
        // salary and isActive are optional
      };
      const record = new Record(data, schema);
      expect(record.getValue('name')).toBe('John Doe');
    });

    it('should allow optional fields to be null', () => {
      const data = {
        name: 'John Doe',
        age: 30,
        salary: null,
        isActive: null,
      };
      const record = new Record(data, schema);
      expect(record.getValue('salary')).toBeNull();
    });

    it('should skip validation when validate is false', () => {
      const data = {
        name: 123, // Invalid type
        age: 30,
      };
      const record = new Record(data, schema, false);
      expect(record.getValue('name')).toBe(123);
    });
  });

  describe('getValue', () => {
    it('should return field value', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      expect(record.getValue('name')).toBe('John');
      expect(record.getValue('age')).toBe(25);
    });

    it('should return undefined for non-existent field', () => {
      const record = new Record({ name: 'John', age: 25 }, schema, false);
      expect(record.getValue('nonexistent')).toBeUndefined();
    });
  });

  describe('setValue', () => {
    it('should set field value', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      record.setValue('name', 'Jane');
      expect(record.getValue('name')).toBe('Jane');
    });

    it('should throw ValidationError for non-existent field', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      expect(() => record.setValue('nonexistent', 'value')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid type', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      expect(() => record.setValue('age', 'not a number' as any)).toThrow(ValidationError);
    });

    it('should skip validation when validate is false', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      record.setValue('age', 'not a number' as any, false);
      expect(record.getValue('age')).toBe('not a number');
    });
  });

  describe('hasField', () => {
    it('should return true for existing field', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      expect(record.hasField('name')).toBe(true);
    });

    it('should return false for non-existent field', () => {
      const record = new Record({ name: 'John', age: 25 }, schema);
      expect(record.hasField('nonexistent')).toBe(false);
    });
  });

  describe('getFieldNames', () => {
    it('should return all field names', () => {
      const data = { name: 'John', age: 25, salary: 50000 };
      const record = new Record(data, schema);
      const fields = record.getFieldNames();
      expect(fields).toContain('name');
      expect(fields).toContain('age');
      expect(fields).toContain('salary');
    });
  });

  describe('standardizeInteger', () => {
    it('should handle plain numbers', () => {
      const value = Record.standardizeValue(42, 'integer');
      expect(value).toBe(42);
    });

    it('should handle K suffix', () => {
      const value = Record.standardizeValue('10K', 'integer');
      expect(value).toBe(10_000);
    });

    it('should handle M suffix', () => {
      const value = Record.standardizeValue('5M', 'integer');
      expect(value).toBe(5_000_000);
    });

    it('should handle B suffix', () => {
      const value = Record.standardizeValue('2B', 'integer');
      expect(value).toBe(2_000_000_000);
    });

    it('should handle T suffix', () => {
      const value = Record.standardizeValue('1T', 'integer');
      expect(value).toBe(1_000_000_000_000);
    });

    it('should handle comma separators', () => {
      const value = Record.standardizeValue('1,000,000', 'integer');
      expect(value).toBe(1_000_000);
    });

    it('should handle decimal with suffix', () => {
      const value = Record.standardizeValue('1.5M', 'integer');
      expect(value).toBe(1_500_000);
    });

    it('should floor decimal numbers', () => {
      const value = Record.standardizeValue(42.7, 'integer');
      expect(value).toBe(42);
    });

    it('should return null for invalid input', () => {
      const value = Record.standardizeValue('invalid', 'integer');
      expect(value).toBeNull();
    });
  });

  describe('standardizeNumber', () => {
    it('should handle plain numbers', () => {
      const value = Record.standardizeValue(42.5, 'number');
      expect(value).toBe(42.5);
    });

    it('should handle percentage', () => {
      const value = Record.standardizeValue('25%', 'number');
      expect(value).toBe(0.25);
    });

    it('should handle K suffix', () => {
      const value = Record.standardizeValue('10K', 'number');
      expect(value).toBe(10_000);
    });

    it('should handle M suffix', () => {
      const value = Record.standardizeValue('5.5M', 'number');
      expect(value).toBe(5_500_000);
    });

    it('should handle comma separators', () => {
      const value = Record.standardizeValue('1,234.56', 'number');
      expect(value).toBe(1234.56);
    });

    it('should return null for invalid input', () => {
      const value = Record.standardizeValue('invalid', 'number');
      expect(value).toBeNull();
    });
  });

  describe('standardizeBoolean', () => {
    it('should handle boolean values', () => {
      expect(Record.standardizeValue(true, 'boolean')).toBe(true);
      expect(Record.standardizeValue(false, 'boolean')).toBe(false);
    });

    it('should handle "yes" variations', () => {
      expect(Record.standardizeValue('yes', 'boolean')).toBe(true);
      expect(Record.standardizeValue('YES', 'boolean')).toBe(true);
      expect(Record.standardizeValue('Yes', 'boolean')).toBe(true);
      expect(Record.standardizeValue('y', 'boolean')).toBe(true);
      expect(Record.standardizeValue('Y', 'boolean')).toBe(true);
    });

    it('should handle "true" variations', () => {
      expect(Record.standardizeValue('true', 'boolean')).toBe(true);
      expect(Record.standardizeValue('TRUE', 'boolean')).toBe(true);
      expect(Record.standardizeValue('t', 'boolean')).toBe(true);
      expect(Record.standardizeValue('1', 'boolean')).toBe(true);
    });

    it('should handle "no" variations', () => {
      expect(Record.standardizeValue('no', 'boolean')).toBe(false);
      expect(Record.standardizeValue('NO', 'boolean')).toBe(false);
      expect(Record.standardizeValue('n', 'boolean')).toBe(false);
    });

    it('should handle "false" variations', () => {
      expect(Record.standardizeValue('false', 'boolean')).toBe(false);
      expect(Record.standardizeValue('FALSE', 'boolean')).toBe(false);
      expect(Record.standardizeValue('f', 'boolean')).toBe(false);
      expect(Record.standardizeValue('0', 'boolean')).toBe(false);
    });

    it('should handle numeric values', () => {
      expect(Record.standardizeValue(1, 'boolean')).toBe(true);
      expect(Record.standardizeValue(0, 'boolean')).toBe(false);
      expect(Record.standardizeValue(42, 'boolean')).toBe(true);
    });

    it('should return null for invalid input', () => {
      expect(Record.standardizeValue('invalid', 'boolean')).toBeNull();
    });
  });

  describe('standardizeString', () => {
    it('should trim strings', () => {
      const value = Record.standardizeValue('  hello  ', 'string');
      expect(value).toBe('hello');
    });

    it('should convert numbers to strings', () => {
      const value = Record.standardizeValue(42, 'string');
      expect(value).toBe('42');
    });

    it('should convert booleans to strings', () => {
      const value = Record.standardizeValue(true, 'string');
      expect(value).toBe('true');
    });

    it('should return null for null input', () => {
      const value = Record.standardizeValue(null, 'string');
      expect(value).toBeNull();
    });
  });

  describe('standardize', () => {
    it('should standardize all fields', () => {
      const data = {
        name: '  John Doe  ',
        age: '25',
        salary: '50K',
        isActive: 'yes',
      };
      const record = new Record(data, schema, false);
      const standardized = record.standardize();

      expect(standardized.getValue('name')).toBe('John Doe');
      expect(standardized.getValue('age')).toBe(25);
      expect(standardized.getValue('salary')).toBe(50_000);
      expect(standardized.getValue('isActive')).toBe(true);
    });
  });

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const data = { name: 'John', age: 25 };
      const record = new Record(data, schema);
      const json = record.toJSON();
      expect(json).toEqual(data);
    });

    it('should return a copy', () => {
      const data = { name: 'John', age: 25 };
      const record = new Record(data, schema);
      const json = record.toJSON();
      json.name = 'Modified';
      expect(record.getValue('name')).toBe('John');
    });
  });

  describe('toString', () => {
    it('should serialize to JSON string', () => {
      const data = { name: 'John', age: 25 };
      const record = new Record(data, schema);
      const str = record.toString();
      const parsed = JSON.parse(str);
      expect(parsed).toEqual(data);
    });

    it('should pretty-print when requested', () => {
      const data = { name: 'John', age: 25 };
      const record = new Record(data, schema);
      const str = record.toString(true);
      expect(str).toContain('\n');
    });
  });

  describe('fromObject', () => {
    it('should create record from object', () => {
      const data = { name: 'John', age: 25 };
      const record = Record.fromObject(data, schema);
      expect(record.getValue('name')).toBe('John');
    });
  });

  describe('fromString', () => {
    it('should create record from JSON string', () => {
      const data = { name: 'John', age: 25 };
      const str = JSON.stringify(data);
      const record = Record.fromString(str, schema);
      expect(record.getValue('name')).toBe('John');
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => Record.fromString('invalid', schema)).toThrow(ValidationError);
    });
  });

  describe('clone', () => {
    it('should create a copy of the record', () => {
      const data = { name: 'John', age: 25 };
      const record1 = new Record(data, schema);
      const record2 = record1.clone();
      expect(record2.getValue('name')).toBe('John');
      expect(record2.getValue('age')).toBe(25);
    });

    it('should create independent instances', () => {
      const data = { name: 'John', age: 25 };
      const record1 = new Record(data, schema);
      const record2 = record1.clone();
      record2.setValue('name', 'Jane', false);
      expect(record1.getValue('name')).toBe('John');
      expect(record2.getValue('name')).toBe('Jane');
    });
  });
});
