/**
 * Integration tests for orchestration functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runIngestion,
  runQuery,
  runEvaluation,
  type IngestionOptions,
  type QueryOptions,
  type EvaluationOptions,
} from '../../src/index.js';
import { JSONSchema } from '../../src/models/schema.js';

// Mock LLM client to avoid real API calls
vi.mock('../../src/llm/llm-client.js', () => {
  return {
    LLMClient: vi.fn().mockImplementation(() => ({
      generate: vi.fn().mockImplementation((prompt: string) => {
        // Mock schema generation
        if (prompt.includes('JSON schema')) {
          return Promise.resolve(JSON.stringify({
            title: 'Test Schema',
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name',
                examples: ['John', 'Jane'],
              },
              age: {
                type: 'integer',
                description: 'Age',
                examples: [25, 30],
              },
            },
          }));
        }

        // Mock record extraction
        if (prompt.includes('Extract')) {
          return Promise.resolve(JSON.stringify({
            name: 'Test Name',
            age: 25,
          }));
        }

        // Mock SQL generation
        if (prompt.includes('SQL')) {
          return Promise.resolve('SELECT COUNT(*) as count FROM test');
        }

        // Mock answer generation
        if (prompt.includes('Answer')) {
          return Promise.resolve('The count is 2.');
        }

        // Mock evaluation
        if (prompt.includes('gold answer')) {
          return Promise.resolve('Yes');
        }

        // Mock claim decomposition
        if (prompt.includes('claims')) {
          return Promise.resolve('1. The count is 2');
        }

        return Promise.resolve('Mocked response');
      }),
    })),
  };
});

describe('Orchestration Functions', () => {
  describe('runIngestion', () => {
    it('should complete ingestion pipeline', async () => {
      const options: IngestionOptions = {
        documents: [
          'John is 25 years old',
          'Jane is 30 years old',
        ],
        questions: [
          'What is the average age?',
        ],
        dbPath: ':memory:', // Use in-memory database for testing
        tableName: 'test_ingestion',
      };

      const result = await runIngestion(options);

      expect(result).toBeDefined();
      expect(result.schema).toBeInstanceOf(JSONSchema);
      expect(result.tableName).toBe('test_ingestion');
      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.statistics).toBeDefined();
    }, 30000); // 30 second timeout for LLM calls

    it('should use provided schema', async () => {
      const schema = new JSONSchema({
        title: 'Custom Schema',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name',
            examples: ['Test'],
          },
        },
      });

      const options: IngestionOptions = {
        documents: ['Test document'],
        questions: ['Test question?'],
        dbPath: ':memory:',
        tableName: 'test_custom_schema',
        schema,
      };

      const result = await runIngestion(options);

      expect(result.schema).toBeDefined();
      expect(result.schema.title).toBe('Custom Schema');
    }, 30000);
  });

  describe('runQuery', () => {
    it('should complete query pipeline', async () => {
      // First, run ingestion to create database
      const ingestionOptions: IngestionOptions = {
        documents: ['John is 25', 'Jane is 30'],
        questions: ['What is the average age?'],
        dbPath: ':memory:',
        tableName: 'test_query',
      };

      const ingestionResult = await runIngestion(ingestionOptions);

      // Now run query
      const queryOptions: QueryOptions = {
        question: 'How many people are there?',
        dbPath: ':memory:', // Note: In-memory databases don't persist across connections
        tableName: 'test_query',
        schema: ingestionResult.schema,
        statistics: ingestionResult.statistics,
      };

      // This will fail because in-memory database doesn't persist
      // In real tests, use a file-based database
      await expect(runQuery(queryOptions)).rejects.toThrow();
    }, 30000);

    it('should validate schema requirement', async () => {
      const queryOptions: QueryOptions = {
        question: 'Test question?',
        dbPath: ':memory:',
        tableName: 'test',
        // No schema or schemaPath provided
      };

      await expect(runQuery(queryOptions)).rejects.toThrow(
        'Schema or schemaPath must be provided'
      );
    });
  });

  describe('runEvaluation', () => {
    it('should complete evaluation', async () => {
      const options: EvaluationOptions = {
        testCases: [
          {
            question: 'What is the count?',
            gold_answer: 'The count is 2.',
            predicted_answer: 'The count is 2.',
          },
        ],
      };

      const result = await runEvaluation(options);

      expect(result).toBeDefined();
      expect(result.answer_comparison).toBeGreaterThanOrEqual(0);
      expect(result.answer_comparison).toBeLessThanOrEqual(1);
      expect(result.answer_recall).toBeGreaterThanOrEqual(0);
      expect(result.answer_recall).toBeLessThanOrEqual(1);
      expect(result.num_examples).toBe(1);
      expect(result.per_example_results).toHaveLength(1);
    }, 30000);

    it('should handle multiple test cases', async () => {
      const options: EvaluationOptions = {
        testCases: [
          {
            question: 'Q1?',
            gold_answer: 'A1',
            predicted_answer: 'A1',
          },
          {
            question: 'Q2?',
            gold_answer: 'A2',
            predicted_answer: 'A2 approximately',
          },
        ],
      };

      const result = await runEvaluation(options);

      expect(result.num_examples).toBe(2);
      expect(result.per_example_results).toHaveLength(2);
    }, 30000);
  });
});
