/**
 * Tests for JSONSchema model
 */

import { describe, it, expect } from 'vitest';
import { JSONSchema } from '../../src/models/schema.js';
import { ValidationError } from '../../src/models/types.js';

describe('JSONSchema', () => {
  const validSchema = {
    title: 'Test Schema',
    description: 'A test schema for unit tests',
    type: 'object' as const,
    properties: {
      name: {
        type: 'string' as const,
        description: 'Person name',
        examples: ['John Doe', 'Jane Smith'],
      },
      age: {
        type: 'integer' as const,
        description: 'Person age',
        examples: [25, 30, 45],
      },
      salary: {
        type: 'number' as const,
        description: 'Annual salary',
        examples: [50000.5, 75000.0],
      },
      isActive: {
        type: 'boolean' as const,
        description: 'Active status',
        examples: [true, false],
      },
    },
    required: ['name', 'age'],
  };

  describe('constructor', () => {
    it('should create a valid schema', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.title).toBe('Test Schema');
      expect(schema.description).toBe('A test schema for unit tests');
    });

    it('should throw ValidationError for missing title', () => {
      const invalid = { ...validSchema, title: '' };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for missing description', () => {
      const invalid = { ...validSchema, description: '' };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for wrong type', () => {
      const invalid = { ...validSchema, type: 'array' };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty properties', () => {
      const invalid = { ...validSchema, properties: {} };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for property without type', () => {
      const invalid = {
        ...validSchema,
        properties: {
          name: {
            description: 'Name',
            examples: ['test'],
          },
        },
      };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for property without description', () => {
      const invalid = {
        ...validSchema,
        properties: {
          name: {
            type: 'string' as const,
            examples: ['test'],
          },
        },
      };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for property without examples', () => {
      const invalid = {
        ...validSchema,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Name',
            examples: [],
          },
        },
      };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid property type', () => {
      const invalid = {
        ...validSchema,
        properties: {
          name: {
            type: 'array' as any,
            description: 'Name',
            examples: ['test'],
          },
        },
      };
      expect(() => new JSONSchema(invalid)).toThrow(ValidationError);
    });
  });

  describe('getters', () => {
    it('should return correct title', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.title).toBe('Test Schema');
    });

    it('should return correct description', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.description).toBe('A test schema for unit tests');
    });

    it('should return properties', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.properties).toEqual(validSchema.properties);
    });

    it('should return required fields', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.required).toEqual(['name', 'age']);
    });
  });

  describe('getProperty', () => {
    it('should return property definition', () => {
      const schema = new JSONSchema(validSchema);
      const property = schema.getProperty('name');
      expect(property).toEqual(validSchema.properties.name);
    });

    it('should return undefined for non-existent property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getProperty('nonexistent')).toBeUndefined();
    });
  });

  describe('getPropertyNames', () => {
    it('should return all property names', () => {
      const schema = new JSONSchema(validSchema);
      const names = schema.getPropertyNames();
      expect(names).toContain('name');
      expect(names).toContain('age');
      expect(names).toContain('salary');
      expect(names).toContain('isActive');
      expect(names).toHaveLength(4);
    });
  });

  describe('hasProperty', () => {
    it('should return true for existing property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.hasProperty('name')).toBe(true);
    });

    it('should return false for non-existent property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.hasProperty('nonexistent')).toBe(false);
    });
  });

  describe('isRequired', () => {
    it('should return true for required property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.isRequired('name')).toBe(true);
      expect(schema.isRequired('age')).toBe(true);
    });

    it('should return false for optional property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.isRequired('salary')).toBe(false);
      expect(schema.isRequired('isActive')).toBe(false);
    });

    it('should return false when no required fields defined', () => {
      const schemaNoRequired = { ...validSchema, required: undefined };
      const schema = new JSONSchema(schemaNoRequired);
      expect(schema.isRequired('name')).toBe(false);
    });
  });

  describe('getPropertyType', () => {
    it('should return correct type for string property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getPropertyType('name')).toBe('string');
    });

    it('should return correct type for integer property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getPropertyType('age')).toBe('integer');
    });

    it('should return correct type for number property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getPropertyType('salary')).toBe('number');
    });

    it('should return correct type for boolean property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getPropertyType('isActive')).toBe('boolean');
    });

    it('should return undefined for non-existent property', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.getPropertyType('nonexistent')).toBeUndefined();
    });
  });

  describe('validatePropertyValue', () => {
    const schema = new JSONSchema(validSchema);

    it('should validate string values', () => {
      expect(schema.validatePropertyValue('name', 'John')).toBe(true);
      expect(schema.validatePropertyValue('name', 123)).toBe(false);
      expect(schema.validatePropertyValue('name', true)).toBe(false);
    });

    it('should validate integer values', () => {
      expect(schema.validatePropertyValue('age', 25)).toBe(true);
      expect(schema.validatePropertyValue('age', 25.5)).toBe(false);
      expect(schema.validatePropertyValue('age', '25')).toBe(false);
    });

    it('should validate number values', () => {
      expect(schema.validatePropertyValue('salary', 50000)).toBe(true);
      expect(schema.validatePropertyValue('salary', 50000.5)).toBe(true);
      expect(schema.validatePropertyValue('salary', '50000')).toBe(false);
    });

    it('should validate boolean values', () => {
      expect(schema.validatePropertyValue('isActive', true)).toBe(true);
      expect(schema.validatePropertyValue('isActive', false)).toBe(true);
      expect(schema.validatePropertyValue('isActive', 'true')).toBe(false);
      expect(schema.validatePropertyValue('isActive', 1)).toBe(false);
    });

    it('should allow null for optional properties', () => {
      expect(schema.validatePropertyValue('salary', null)).toBe(true);
      expect(schema.validatePropertyValue('isActive', null)).toBe(true);
    });

    it('should reject null for required properties', () => {
      expect(schema.validatePropertyValue('name', null)).toBe(false);
      expect(schema.validatePropertyValue('age', null)).toBe(false);
    });

    it('should reject non-existent properties', () => {
      expect(schema.validatePropertyValue('nonexistent', 'value')).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON object', () => {
      const schema = new JSONSchema(validSchema);
      const json = schema.toJSON();
      expect(json).toEqual(validSchema);
    });

    it('should return a copy, not the original', () => {
      const schema = new JSONSchema(validSchema);
      const json = schema.toJSON();
      json.title = 'Modified';
      expect(schema.title).toBe('Test Schema');
    });
  });

  describe('toString', () => {
    it('should serialize to JSON string', () => {
      const schema = new JSONSchema(validSchema);
      const str = schema.toString();
      const parsed = JSON.parse(str);
      expect(parsed).toEqual(validSchema);
    });

    it('should pretty-print when requested', () => {
      const schema = new JSONSchema(validSchema);
      const str = schema.toString(true);
      expect(str).toContain('\n');
      expect(str).toContain('  ');
    });
  });

  describe('fromString', () => {
    it('should create schema from JSON string', () => {
      const str = JSON.stringify(validSchema);
      const schema = JSONSchema.fromString(str);
      expect(schema.title).toBe('Test Schema');
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => JSONSchema.fromString('invalid json')).toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid schema', () => {
      const invalid = JSON.stringify({ title: '' });
      expect(() => JSONSchema.fromString(invalid)).toThrow(ValidationError);
    });
  });

  describe('fromObject', () => {
    it('should create schema from object', () => {
      const schema = JSONSchema.fromObject(validSchema);
      expect(schema.title).toBe('Test Schema');
    });
  });

  describe('isPrimitiveOnly', () => {
    it('should return true for primitive-only schema', () => {
      const schema = new JSONSchema(validSchema);
      expect(schema.isPrimitiveOnly()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('should return schema summary', () => {
      const schema = new JSONSchema(validSchema);
      const summary = schema.getSummary();
      expect(summary).toContain('Test Schema');
      expect(summary).toContain('4 properties');
      expect(summary).toContain('2 required');
    });
  });

  describe('clone', () => {
    it('should create a copy of the schema', () => {
      const schema1 = new JSONSchema(validSchema);
      const schema2 = schema1.clone();
      expect(schema2.title).toBe(schema1.title);
      expect(schema2.toJSON()).toEqual(schema1.toJSON());
    });

    it('should create independent instances', () => {
      const schema1 = new JSONSchema(validSchema);
      const schema2 = schema1.clone();
      // They should be different instances
      expect(schema1).not.toBe(schema2);
    });
  });
});
