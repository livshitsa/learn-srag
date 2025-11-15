/**
 * Tests for Schema Predictor
 *
 * Tests schema generation with mocked LLM calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchemaPredictor, createSchemaPredictor } from '../../src/ingestion/schema-predictor.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { JSONSchema } from '../../src/models/schema.js';
import { ValidationError } from '../../src/models/types.js';

// Mock LLM client
vi.mock('../../src/llm/llm-client.js');

describe('SchemaPredictor', () => {
  let predictor: SchemaPredictor;
  let mockLLMClient: any;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generate: vi.fn(),
    };

    predictor = new SchemaPredictor(mockLLMClient as LLMClient);
  });

  describe('constructor', () => {
    it('should create a new SchemaPredictor instance', () => {
      expect(predictor).toBeInstanceOf(SchemaPredictor);
    });

    it('should accept an LLM client', () => {
      const newPredictor = new SchemaPredictor(mockLLMClient as LLMClient);
      expect(newPredictor).toBeInstanceOf(SchemaPredictor);
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse valid JSON from LLM response', () => {
      const response = `
Here's the schema:

\`\`\`json
{
  "title": "Hotel",
  "description": "Hotel information",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Hotel name",
      "examples": ["Grand Hotel", "Ocean View"]
    },
    "rating": {
      "type": "integer",
      "description": "Star rating",
      "examples": [4, 5]
    }
  },
  "required": ["name"]
}
\`\`\`
      `;

      const result = predictor.parseJsonResponse(response);

      expect(result).toBeDefined();
      expect(result.title).toBe('Hotel');
      expect(result.properties).toBeDefined();
      expect(result.properties.name).toBeDefined();
      expect(result.properties.rating).toBeDefined();
    });

    it('should parse JSON without markdown code blocks', () => {
      const response = `
{
  "title": "Test Schema",
  "description": "A test schema",
  "type": "object",
  "properties": {
    "test_field": {
      "type": "string",
      "description": "Test field",
      "examples": ["test"]
    }
  }
}
      `;

      const result = predictor.parseJsonResponse(response);

      expect(result.title).toBe('Test Schema');
      expect(result.properties.test_field).toBeDefined();
    });

    it('should handle JSON with extra text before and after', () => {
      const response = `
Some explanation text here...

{
  "title": "Schema",
  "description": "Description",
  "type": "object",
  "properties": {
    "field": {
      "type": "string",
      "description": "Field",
      "examples": ["value"]
    }
  }
}

Some closing remarks...
      `;

      const result = predictor.parseJsonResponse(response);

      expect(result.title).toBe('Schema');
    });

    it('should throw ValidationError if no JSON found', () => {
      const response = 'This is just plain text with no JSON';

      expect(() => predictor.parseJsonResponse(response)).toThrow(ValidationError);
      expect(() => predictor.parseJsonResponse(response)).toThrow('No JSON found');
    });

    it('should throw ValidationError if JSON is invalid', () => {
      const response = '{ invalid json: missing quotes }';

      expect(() => predictor.parseJsonResponse(response)).toThrow(ValidationError);
      expect(() => predictor.parseJsonResponse(response)).toThrow('No JSON found');
    });

    it('should throw ValidationError if response is not an object', () => {
      const response = '["array", "instead", "of", "object"]';

      expect(() => predictor.parseJsonResponse(response)).toThrow(ValidationError);
      expect(() => predictor.parseJsonResponse(response)).toThrow('must be a JSON object');
    });

    it('should throw ValidationError if title is missing', () => {
      const response = `
{
  "description": "Missing title",
  "type": "object",
  "properties": {}
}
      `;

      expect(() => predictor.parseJsonResponse(response)).toThrow(ValidationError);
      expect(() => predictor.parseJsonResponse(response)).toThrow('missing required field: title');
    });

    it('should throw ValidationError if properties is missing', () => {
      const response = `
{
  "title": "Schema",
  "description": "Missing properties",
  "type": "object"
}
      `;

      expect(() => predictor.parseJsonResponse(response)).toThrow(ValidationError);
      expect(() => predictor.parseJsonResponse(response)).toThrow(
        'missing required field: properties'
      );
    });
  });

  describe('buildFirstIterationPrompt', () => {
    it('should build prompt with sample documents', async () => {
      const documents = ['Document 1 content', 'Document 2 content', 'Document 3 content'];

      const prompt = await predictor.buildFirstIterationPrompt(documents);

      expect(prompt).toContain('Document 1');
      expect(prompt).toContain('Document 1 content');
      expect(prompt).toContain('Document 2');
      expect(prompt).toContain('Document 2 content');
      expect(prompt).toContain('Document 3');
      expect(prompt).toContain('Document 3 content');
    });

    it('should include instructions for primitive types only', async () => {
      const documents = ['Test document'];

      const prompt = await predictor.buildFirstIterationPrompt(documents);

      expect(prompt.toLowerCase()).toContain('primitive');
      expect(prompt).toContain('string');
      expect(prompt).toContain('number');
      expect(prompt).toContain('integer');
      expect(prompt).toContain('boolean');
    });

    it('should include instructions for examples', async () => {
      const documents = ['Test document'];

      const prompt = await predictor.buildFirstIterationPrompt(documents);

      expect(prompt.toLowerCase()).toContain('example');
    });

    it('should include instructions for descriptions', async () => {
      const documents = ['Test document'];

      const prompt = await predictor.buildFirstIterationPrompt(documents);

      expect(prompt.toLowerCase()).toContain('description');
    });

    it('should handle empty document list', async () => {
      const documents: string[] = [];

      const prompt = await predictor.buildFirstIterationPrompt(documents);

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('validateSchemaStructure', () => {
    it('should validate a correct schema', () => {
      const schema = {
        title: 'Test Schema',
        description: 'A test schema',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name field',
            examples: ['John', 'Jane'],
          },
          age: {
            type: 'integer',
            description: 'Age in years',
            examples: [25, 30],
          },
        },
      };

      expect(predictor.validateSchemaStructure(schema)).toBe(true);
    });

    it('should throw if title is missing', () => {
      const schema = {
        description: 'Missing title',
        type: 'object',
        properties: {
          field: { type: 'string', description: 'Field', examples: ['test'] },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('must have a string title');
    });

    it('should throw if description is missing', () => {
      const schema = {
        title: 'Schema',
        type: 'object',
        properties: {
          field: { type: 'string', description: 'Field', examples: ['test'] },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow(
        'must have a string description'
      );
    });

    it('should throw if type is not "object"', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'string',
        properties: {},
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('type must be "object"');
    });

    it('should throw if properties is missing', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('must have properties');
    });

    it('should throw if properties is empty', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {},
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('at least one property');
    });

    it('should throw if property has invalid type', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {
          invalid: {
            type: 'array', // Not a primitive type
            description: 'Invalid field',
            examples: [[]],
          },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('valid primitive type');
    });

    it('should throw if property is missing description', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {
          field: {
            type: 'string',
            examples: ['test'],
          },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('must have a description');
    });

    it('should throw if property is missing examples', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Field description',
          },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('at least one example');
    });

    it('should throw if property has empty examples array', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Field description',
            examples: [],
          },
        },
      };

      expect(() => predictor.validateSchemaStructure(schema)).toThrow(ValidationError);
      expect(() => predictor.validateSchemaStructure(schema)).toThrow('at least one example');
    });

    it('should accept all primitive types', () => {
      const schema = {
        title: 'Schema',
        description: 'Description',
        type: 'object',
        properties: {
          str_field: {
            type: 'string',
            description: 'String field',
            examples: ['test'],
          },
          num_field: {
            type: 'number',
            description: 'Number field',
            examples: [3.14],
          },
          int_field: {
            type: 'integer',
            description: 'Integer field',
            examples: [42],
          },
          bool_field: {
            type: 'boolean',
            description: 'Boolean field',
            examples: [true],
          },
        },
      };

      expect(predictor.validateSchemaStructure(schema)).toBe(true);
    });
  });

  describe('generateInitialSchema', () => {
    const mockValidSchemaResponse = {
      content: `
{
  "title": "Hotel Information",
  "description": "Schema for hotel data",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Hotel name",
      "examples": ["Grand Hotel", "Ocean Resort"]
    },
    "rating": {
      "type": "integer",
      "description": "Star rating (1-5)",
      "examples": [4, 5]
    },
    "price_per_night": {
      "type": "number",
      "description": "Price per night in USD",
      "examples": [150.00, 299.99]
    },
    "has_pool": {
      "type": "boolean",
      "description": "Has swimming pool",
      "examples": [true, false]
    }
  },
  "required": ["name", "rating"]
}
      `,
      model: 'gpt-4o',
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      },
    };

    it('should generate initial schema from documents', async () => {
      mockLLMClient.generate.mockResolvedValue(mockValidSchemaResponse);

      const documents = [
        'Grand Hotel: 5 stars, $299/night, pool, wifi',
        'Ocean Resort: 4 stars, $150/night, beach access',
        'City Inn: 3 stars, $89/night, parking',
      ];

      const schema = await predictor.generateInitialSchema(documents);

      expect(schema).toBeInstanceOf(JSONSchema);
      expect(schema.title).toBe('Hotel Information');
      expect(schema.getPropertyNames()).toContain('name');
      expect(schema.getPropertyNames()).toContain('rating');
      expect(schema.isPrimitiveOnly()).toBe(true);
    });

    it('should call LLM with correct model', async () => {
      mockLLMClient.generate.mockResolvedValue(mockValidSchemaResponse);

      const documents = ['Test document'];

      await predictor.generateInitialSchema(documents, 'gpt-4o');

      expect(mockLLMClient.generate).toHaveBeenCalledWith(expect.any(String), {
        model: 'gpt-4o',
      });
    });

    it('should use default model if not specified', async () => {
      mockLLMClient.generate.mockResolvedValue(mockValidSchemaResponse);

      const documents = ['Test document'];

      await predictor.generateInitialSchema(documents);

      expect(mockLLMClient.generate).toHaveBeenCalledWith(expect.any(String), {
        model: 'gpt-4o',
      });
    });

    it('should throw if LLM returns invalid JSON', async () => {
      mockLLMClient.generate.mockResolvedValue({
        content: 'Not valid JSON at all',
        model: 'gpt-4o',
      });

      const documents = ['Test document'];

      await expect(predictor.generateInitialSchema(documents)).rejects.toThrow(ValidationError);
    });

    it('should throw if schema contains non-primitive types', async () => {
      mockLLMClient.generate.mockResolvedValue({
        content: `
{
  "title": "Invalid Schema",
  "description": "Has nested object",
  "type": "object",
  "properties": {
    "nested": {
      "type": "object",
      "description": "Nested object",
      "examples": [{}]
    }
  }
}
        `,
        model: 'gpt-4o',
      });

      const documents = ['Test document'];

      await expect(predictor.generateInitialSchema(documents)).rejects.toThrow();
    });

    it('should throw if LLM call fails', async () => {
      mockLLMClient.generate.mockRejectedValue(new Error('API error'));

      const documents = ['Test document'];

      await expect(predictor.generateInitialSchema(documents)).rejects.toThrow('API error');
    });

    it('should handle documents with special characters', async () => {
      mockLLMClient.generate.mockResolvedValue(mockValidSchemaResponse);

      const documents = [
        'Hotel "Château": €200/night, 5★ rating',
        'Hotel <Renaissance>: $150/night & breakfast',
      ];

      const schema = await predictor.generateInitialSchema(documents);

      expect(schema).toBeInstanceOf(JSONSchema);
    });

    it('should handle empty documents array', async () => {
      mockLLMClient.generate.mockResolvedValue(mockValidSchemaResponse);

      const documents: string[] = [];

      const schema = await predictor.generateInitialSchema(documents);

      expect(schema).toBeInstanceOf(JSONSchema);
    });

    it('should validate schema has required fields', async () => {
      mockLLMClient.generate.mockResolvedValue({
        content: `
{
  "description": "Missing title",
  "type": "object",
  "properties": {
    "field": {
      "type": "string",
      "description": "Field",
      "examples": ["test"]
    }
  }
}
        `,
        model: 'gpt-4o',
      });

      const documents = ['Test document'];

      await expect(predictor.generateInitialSchema(documents)).rejects.toThrow();
    });
  });

  describe('createSchemaPredictor', () => {
    it('should create a SchemaPredictor instance', () => {
      const predictor = createSchemaPredictor(mockLLMClient as LLMClient);

      expect(predictor).toBeInstanceOf(SchemaPredictor);
    });
  });

  // ============================================================================
  // Iteration 6B Tests: Refinement and Full Pipeline
  // ============================================================================

  describe('buildRefinementPrompt', () => {
    const mockSchema = new JSONSchema({
      title: 'Hotel Schema',
      description: 'Schema for hotel data',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Hotel name',
          examples: ['Grand Hotel', 'Ocean Resort'],
        },
        rating: {
          type: 'integer',
          description: 'Star rating',
          examples: [4, 5],
        },
      },
      required: ['name'],
    });

    it('should build refinement prompt with schema, documents, and questions', async () => {
      const documents = ['Doc 1 content', 'Doc 2 content'];
      const questions = ['Question 1?', 'Question 2?'];

      const prompt = await predictor.buildRefinementPrompt(mockSchema, documents, questions);

      expect(prompt).toContain('Hotel Schema');
      expect(prompt).toContain('Doc 1 content');
      expect(prompt).toContain('Doc 2 content');
      expect(prompt).toContain('Question 1?');
      expect(prompt).toContain('Question 2?');
    });

    it('should include current schema in prompt', async () => {
      const documents = ['Test doc'];
      const questions = ['Test question?'];

      const prompt = await predictor.buildRefinementPrompt(mockSchema, documents, questions);

      expect(prompt).toContain('"name"');
      expect(prompt).toContain('"rating"');
      expect(prompt).toContain('string');
      expect(prompt).toContain('integer');
    });

    it('should format documents with headers', async () => {
      const documents = ['First', 'Second', 'Third'];
      const questions = ['Q'];

      const prompt = await predictor.buildRefinementPrompt(mockSchema, documents, questions);

      expect(prompt).toContain('Document 1');
      expect(prompt).toContain('Document 2');
      expect(prompt).toContain('Document 3');
    });

    it('should format questions with numbers', async () => {
      const documents = ['Doc'];
      const questions = ['First question?', 'Second question?', 'Third question?'];

      const prompt = await predictor.buildRefinementPrompt(mockSchema, documents, questions);

      expect(prompt).toContain('1. First question?');
      expect(prompt).toContain('2. Second question?');
      expect(prompt).toContain('3. Third question?');
    });

    it('should handle empty question list', async () => {
      const documents = ['Doc'];
      const questions: string[] = [];

      const prompt = await predictor.buildRefinementPrompt(mockSchema, documents, questions);

      expect(prompt).toBeDefined();
      expect(prompt.length).toBeGreaterThan(0);
    });
  });

  describe('refineSchema', () => {
    const mockCurrentSchema = new JSONSchema({
      title: 'Hotel Schema',
      description: 'Initial schema',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Hotel name',
          examples: ['Grand Hotel'],
        },
      },
      required: ['name'],
    });

    const mockRefinedResponse = {
      content: `
{
  "title": "Hotel Schema",
  "description": "Refined schema with more properties",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Hotel name",
      "examples": ["Grand Hotel", "Ocean Resort"]
    },
    "location": {
      "type": "string",
      "description": "City location",
      "examples": ["New York", "Los Angeles"]
    },
    "rating": {
      "type": "integer",
      "description": "Star rating 1-5",
      "examples": [4, 5]
    }
  },
  "required": ["name", "location"]
}
      `,
      model: 'gpt-4o',
      usage: {
        promptTokens: 1200,
        completionTokens: 600,
        totalTokens: 1800,
      },
    };

    it('should refine schema based on documents and questions', async () => {
      mockLLMClient.generate.mockResolvedValue(mockRefinedResponse);

      const documents = ['Hotel in NYC', 'Resort in LA'];
      const questions = ['Which hotels are in New York?'];

      const refined = await predictor.refineSchema(mockCurrentSchema, documents, questions);

      expect(refined).toBeInstanceOf(JSONSchema);
      expect(refined.getPropertyNames()).toContain('location');
      expect(refined.getPropertyNames().length).toBeGreaterThan(
        mockCurrentSchema.getPropertyNames().length
      );
    });

    it('should call LLM with correct model', async () => {
      mockLLMClient.generate.mockResolvedValue(mockRefinedResponse);

      await predictor.refineSchema(mockCurrentSchema, ['doc'], ['q'], 'gpt-4o');

      expect(mockLLMClient.generate).toHaveBeenCalledWith(expect.any(String), {
        model: 'gpt-4o',
      });
    });

    it('should validate refined schema has primitive types only', async () => {
      mockLLMClient.generate.mockResolvedValue({
        content: `
{
  "title": "Invalid Refined",
  "description": "Has nested type",
  "type": "object",
  "properties": {
    "nested": {
      "type": "object",
      "description": "Nested",
      "examples": [{}]
    }
  }
}
        `,
        model: 'gpt-4o',
      });

      await expect(predictor.refineSchema(mockCurrentSchema, ['doc'], ['q'])).rejects.toThrow();
    });

    it('should throw if refinement returns invalid JSON', async () => {
      mockLLMClient.generate.mockResolvedValue({
        content: 'Not valid JSON',
        model: 'gpt-4o',
      });

      await expect(predictor.refineSchema(mockCurrentSchema, ['doc'], ['q'])).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle LLM errors gracefully', async () => {
      mockLLMClient.generate.mockRejectedValue(new Error('LLM API error'));

      await expect(predictor.refineSchema(mockCurrentSchema, ['doc'], ['q'])).rejects.toThrow(
        'LLM API error'
      );
    });
  });

  describe('validateSchema', () => {
    it('should validate a correct primitive-only schema', () => {
      const schema = new JSONSchema({
        title: 'Test Schema',
        description: 'Valid schema with primitives',
        type: 'object',
        properties: {
          str_field: {
            type: 'string',
            description: 'A string field with description',
            examples: ['value1', 'value2'],
          },
          int_field: {
            type: 'integer',
            description: 'An integer field with description',
            examples: [1, 2, 3],
          },
        },
        required: ['str_field'],
      });

      expect(predictor.validateSchema(schema)).toBe(true);
    });

    it('should throw if schema has no properties', () => {
      // This should fail at JSONSchema constructor level
      expect(() => {
        new JSONSchema({
          title: 'Empty Schema',
          description: 'No properties',
          type: 'object',
          properties: {},
        });
      }).toThrow();
    });

    it('should throw if required property does not exist', () => {
      // Create schema with mismatched required field
      const invalidSchema = {
        title: 'Invalid Schema',
        description: 'Required field mismatch',
        type: 'object',
        properties: {
          existing_field: {
            type: 'string',
            description: 'This field exists',
            examples: ['test'],
          },
        },
        required: ['non_existing_field'], // This field doesn't exist
      };

      // This should fail validation
      expect(() => {
        const schema = new JSONSchema(invalidSchema);
        predictor.validateSchema(schema);
      }).toThrow();
    });

    it('should warn about schemas with many properties', () => {
      // Create schema with many properties
      const manyProps: any = {};
      for (let i = 0; i < 55; i++) {
        manyProps[`field_${i}`] = {
          type: 'string',
          description: `Field number ${i}`,
          examples: [`value${i}`],
        };
      }

      const schema = new JSONSchema({
        title: 'Large Schema',
        description: 'Schema with many properties',
        type: 'object',
        properties: manyProps,
      });

      // Should still pass validation but log a warning
      expect(predictor.validateSchema(schema)).toBe(true);
    });

    it('should validate all primitive types', () => {
      const schema = new JSONSchema({
        title: 'All Types',
        description: 'Schema with all primitive types',
        type: 'object',
        properties: {
          str: {
            type: 'string',
            description: 'String type field',
            examples: ['test'],
          },
          num: {
            type: 'number',
            description: 'Number type field',
            examples: [3.14],
          },
          int: {
            type: 'integer',
            description: 'Integer type field',
            examples: [42],
          },
          bool: {
            type: 'boolean',
            description: 'Boolean type field',
            examples: [true],
          },
        },
      });

      expect(predictor.validateSchema(schema)).toBe(true);
    });
  });

  describe('predictSchema - Full Pipeline', () => {
    const mockInitialResponse = {
      content: `
{
  "title": "Hotel Schema v1",
  "description": "Initial schema from documents",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Hotel name",
      "examples": ["Grand Hotel", "Ocean Resort"]
    }
  },
  "required": ["name"]
}
      `,
      model: 'gpt-4o',
      usage: { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 },
    };

    const mockRefinementResponse = {
      content: `
{
  "title": "Hotel Schema Refined",
  "description": "Refined schema with more properties",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Hotel name",
      "examples": ["Grand Hotel", "Ocean Resort"]
    },
    "location": {
      "type": "string",
      "description": "City location",
      "examples": ["New York", "Los Angeles"]
    },
    "rating": {
      "type": "integer",
      "description": "Star rating 1-5",
      "examples": [4, 5]
    }
  },
  "required": ["name", "location"]
}
      `,
      model: 'gpt-4o',
      usage: { promptTokens: 1200, completionTokens: 600, totalTokens: 1800 },
    };

    it('should run full 4-iteration pipeline', async () => {
      // First call: initial schema
      // Next 3 calls: refinements
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents = ['Hotel doc 1', 'Hotel doc 2', 'Hotel doc 3'];
      const questions = ['Where is the hotel?', 'What is the rating?'];

      const schema = await predictor.predictSchema(documents, questions, 3, 2);

      expect(schema).toBeInstanceOf(JSONSchema);
      expect(mockLLMClient.generate).toHaveBeenCalledTimes(4); // 1 initial + 3 refinements
    });

    it('should use default sample sizes', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents = Array(20).fill('Document');
      const questions = Array(15).fill('Question?');

      await predictor.predictSchema(documents, questions);

      expect(mockLLMClient.generate).toHaveBeenCalledTimes(4);
    });

    it('should limit documents to numDocs parameter', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents = Array(20).fill('Document');
      const questions = Array(15).fill('Question?');

      await predictor.predictSchema(documents, questions, 5, 3);

      // Check that first call only uses 5 documents
      const firstCallArgs = mockLLMClient.generate.mock.calls[0];
      const firstPrompt = firstCallArgs[0];
      // Count "Document 1", "Document 2", etc.
      const docMatches = firstPrompt.match(/Document \d+/g) || [];
      expect(docMatches.length).toBe(5);
    });

    it('should validate final schema', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents = ['Doc'];
      const questions = ['Q?'];

      const schema = await predictor.predictSchema(documents, questions, 1, 1);

      expect(schema.isPrimitiveOnly()).toBe(true);
    });

    it('should throw if any iteration fails', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockRejectedValueOnce(new Error('Refinement failed'));

      const documents = ['Doc'];
      const questions = ['Q?'];

      await expect(predictor.predictSchema(documents, questions, 1, 1)).rejects.toThrow(
        'Refinement failed'
      );
    });

    it('should use specified model for all iterations', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents = ['Doc'];
      const questions = ['Q?'];

      await predictor.predictSchema(documents, questions, 1, 1, 'gpt-4-turbo');

      // Check all 4 calls used the specified model
      mockLLMClient.generate.mock.calls.forEach((call: any) => {
        expect(call[1].model).toBe('gpt-4-turbo');
      });
    });

    it('should handle empty document arrays', async () => {
      mockLLMClient.generate
        .mockResolvedValueOnce(mockInitialResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse)
        .mockResolvedValueOnce(mockRefinementResponse);

      const documents: string[] = [];
      const questions: string[] = [];

      const schema = await predictor.predictSchema(documents, questions);

      expect(schema).toBeInstanceOf(JSONSchema);
    });
  });

  describe('saveSchema and loadSchema', () => {
    it('should save and load schema', async () => {
      const schema = new JSONSchema({
        title: 'Test Schema',
        description: 'For save/load test',
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Test field',
            examples: ['test'],
          },
        },
      });

      const tmpPath = '/tmp/test-schema.json';

      // Save schema
      const savedPath = await predictor.saveSchema(schema, tmpPath);
      expect(savedPath).toBe(tmpPath);

      // Load schema
      const loaded = await predictor.loadSchema(tmpPath);
      expect(loaded.title).toBe(schema.title);
      expect(loaded.description).toBe(schema.description);
      expect(loaded.getPropertyNames()).toEqual(schema.getPropertyNames());
    });

    it('should save schema with version suffix', async () => {
      const schema = new JSONSchema({
        title: 'Versioned Schema',
        description: 'Test versioning',
        type: 'object',
        properties: {
          field: {
            type: 'string',
            description: 'Field',
            examples: ['val'],
          },
        },
      });

      const tmpPath = '/tmp/versioned-schema.json';

      const savedPath = await predictor.saveSchema(schema, tmpPath, 4);
      expect(savedPath).toBe('/tmp/versioned-schema.v4.json');

      const loaded = await predictor.loadSchema(savedPath);
      expect(loaded.title).toBe('Versioned Schema');
    });

    it('should throw when loading non-existent file', async () => {
      await expect(
        predictor.loadSchema('/tmp/non-existent-schema-file.json')
      ).rejects.toThrow(ValidationError);
    });

    it('should validate loaded schema', async () => {
      const schema = new JSONSchema({
        title: 'Valid Schema',
        description: 'Should validate after load',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name field',
            examples: ['test'],
          },
        },
      });

      const tmpPath = '/tmp/valid-schema.json';
      await predictor.saveSchema(schema, tmpPath);

      const loaded = await predictor.loadSchema(tmpPath);
      expect(loaded.isPrimitiveOnly()).toBe(true);
    });
  });
});
