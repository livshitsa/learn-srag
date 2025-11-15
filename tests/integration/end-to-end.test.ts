/**
 * End-to-end integration tests
 *
 * Tests the complete S-RAG workflow using the main index.ts functions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runIngestion, runQuery, runEvaluation } from '../../src/index.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

describe('End-to-End Integration Tests', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-e2e.db');

  // Clean up test database before and after tests
  beforeEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Complete Workflow', () => {
    it('should run ingestion and query end-to-end', async () => {
      // Sample documents
      const documents = [
        'Restaurant A: Cuisine Italian, Price $$, Rating 4.5, Location Downtown',
        'Restaurant B: Cuisine Chinese, Price $, Rating 4.0, Location Chinatown',
        'Restaurant C: Cuisine French, Price $$$, Rating 5.0, Location Downtown',
        'Restaurant D: Cuisine Italian, Price $$, Rating 4.2, Location Suburbs',
        'Restaurant E: Cuisine Japanese, Price $$$, Rating 4.8, Location Downtown',
      ];

      const questions = [
        'What cuisines are available?',
        'What is the average rating?',
        'How many restaurants are downtown?',
      ];

      // Mock LLM globally
      const mockGenerate = vi.fn().mockImplementation(async (prompt: string) => {
        // Mock schema generation
        if (prompt.includes('predict a JSON schema')) {
          return {
            content: JSON.stringify({
              title: 'Restaurant',
              description: 'Restaurant information',
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Restaurant name',
                  examples: ['Restaurant A'],
                },
                cuisine: {
                  type: 'string',
                  description: 'Cuisine type',
                  examples: ['Italian', 'Chinese'],
                },
                price_range: {
                  type: 'string',
                  description: 'Price range',
                  examples: ['$', '$$', '$$$'],
                },
                rating: {
                  type: 'number',
                  description: 'Rating out of 5',
                  examples: [4.5, 4.0],
                },
                location: {
                  type: 'string',
                  description: 'Location',
                  examples: ['Downtown', 'Chinatown'],
                },
              },
            }),
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          };
        }

        // Mock record extraction
        if (prompt.includes('extract structured data')) {
          const doc = prompt.match(/Document:\s*(.+?)(?:\n|$)/)?.[1] || '';
          const match = doc.match(
            /Restaurant ([A-Z]).*?Cuisine (\w+).*?Price (\$+).*?Rating ([\d.]+).*?Location (\w+)/
          );
          if (match) {
            return {
              content: JSON.stringify({
                name: `Restaurant ${match[1]}`,
                cuisine: match[2],
                price_range: match[3],
                rating: parseFloat(match[4]),
                location: match[5],
              }),
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            };
          }
        }

        // Mock SQL generation
        if (prompt.includes('Translate the following natural language question')) {
          return {
            content: 'SELECT AVG(rating) as average_rating FROM restaurants',
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }

        // Mock answer generation
        if (prompt.includes('Generate a natural language answer')) {
          return {
            content: 'The average rating across all restaurants is 4.5.',
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          };
        }

        return {
          content: '{}',
          model: 'gpt-4o',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
      });

      // Spy on LLMClient.prototype.generate
      vi.spyOn(LLMClient.prototype, 'generate').mockImplementation(mockGenerate);

      // Step 1: Run ingestion
      const ingestionResult = await runIngestion({
        documents,
        questions,
        dbPath: testDbPath,
        tableName: 'restaurants',
        sampleSize: 3,
        questionSampleSize: 3,
      });

      // Verify ingestion results
      expect(ingestionResult).toBeDefined();
      expect(ingestionResult.schema).toBeDefined();
      expect(ingestionResult.schema.title).toBe('Restaurant');
      expect(ingestionResult.recordCount).toBeGreaterThan(0);
      expect(ingestionResult.statistics).toBeDefined();
      expect(ingestionResult.tableName).toBe('restaurants');
      expect(existsSync(testDbPath)).toBe(true);

      // Step 2: Run query
      const queryResult = await runQuery({
        question: 'What is the average rating?',
        dbPath: testDbPath,
        tableName: 'restaurants',
        schema: ingestionResult.schema,
        statistics: ingestionResult.statistics,
      });

      // Verify query results
      expect(queryResult).toBeDefined();
      expect(queryResult.question).toBe('What is the average rating?');
      expect(queryResult.sql).toBeDefined();
      expect(queryResult.sql).toContain('SELECT');
      expect(queryResult.results).toBeDefined();
      expect(queryResult.answer).toBeDefined();
      expect(queryResult.metadata).toBeDefined();
      expect(queryResult.metadata?.totalTime).toBeGreaterThan(0);
    }, 30000);

    it('should handle evaluation workflow', async () => {
      const testCases = [
        {
          question: 'What is 2+2?',
          gold_answer: '4',
          predicted_answer: '4',
        },
        {
          question: 'What is the capital of France?',
          gold_answer: 'Paris',
          predicted_answer: 'Paris is the capital',
        },
        {
          question: 'What is 5*6?',
          gold_answer: '30',
          predicted_answer: '25', // Wrong answer
        },
      ];

      // Mock LLM for evaluation
      const mockGenerate = vi.fn().mockImplementation(async (prompt: string) => {
        // Mock answer comparison
        if (prompt.includes('Is the predicted answer correct')) {
          if (prompt.includes('2+2') || prompt.includes('Paris')) {
            return {
              content: 'Yes, the predicted answer is correct.',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            };
          } else {
            return {
              content: 'No, the predicted answer is incorrect.',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            };
          }
        }

        // Mock claim decomposition
        if (prompt.includes('Decompose the following answer into individual claims')) {
          if (prompt.includes('"4"')) {
            return {
              content: '1. The answer is 4',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            };
          } else if (prompt.includes('Paris')) {
            return {
              content: '1. The capital is Paris',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            };
          } else {
            return {
              content: '1. The answer is 30',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
            };
          }
        }

        // Mock claim coverage
        if (prompt.includes('Is the following claim covered')) {
          if (prompt.includes('answer is 4') && prompt.includes('"4"')) {
            return {
              content: 'Yes',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
            };
          } else if (prompt.includes('Paris') && prompt.includes('Paris')) {
            return {
              content: 'Yes',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
            };
          } else {
            return {
              content: 'No',
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
            };
          }
        }

        return {
          content: 'Unknown',
          model: 'gpt-4o',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
      });

      vi.spyOn(LLMClient.prototype, 'generate').mockImplementation(mockGenerate);

      // Run evaluation
      const result = await runEvaluation({ testCases });

      // Verify evaluation results
      expect(result).toBeDefined();
      expect(result.num_examples).toBe(3);
      expect(result.answer_comparison).toBeGreaterThan(0);
      expect(result.answer_comparison).toBeLessThanOrEqual(1);
      expect(result.answer_recall).toBeGreaterThan(0);
      expect(result.answer_recall).toBeLessThanOrEqual(1);
      expect(result.per_example_results).toHaveLength(3);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const documents = ['Test document'];
      const questions = ['Test question'];

      // Try to create table in invalid path
      await expect(
        runIngestion({
          documents,
          questions,
          dbPath: '/invalid/path/db.db',
          tableName: 'test',
        })
      ).rejects.toThrow();
    });

    it('should handle missing schema error', async () => {
      await expect(
        runQuery({
          question: 'Test question',
          dbPath: testDbPath,
          tableName: 'test',
          // No schema or schemaPath provided
        })
      ).rejects.toThrow('Schema or schemaPath must be provided');
    });
  });

  describe('Data Quality', () => {
    it('should handle various document formats', async () => {
      const documents = [
        // Different formats
        'Name: John, Age: 30, City: NYC',
        'Name=Jane|Age=25|City=LA',
        'Bob is 35 years old and lives in Chicago',
      ];

      const questions = ['What is the average age?'];

      const mockGenerate = vi.fn().mockImplementation(async (prompt: string) => {
        if (prompt.includes('predict a JSON schema')) {
          return {
            content: JSON.stringify({
              title: 'Person',
              description: 'Person info',
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name', examples: ['John'] },
                age: { type: 'integer', description: 'Age', examples: [30] },
                city: { type: 'string', description: 'City', examples: ['NYC'] },
              },
            }),
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          };
        }

        if (prompt.includes('extract structured data')) {
          const doc = prompt.match(/Document:\s*(.+?)(?:\n|$)/)?.[1] || '';
          if (doc.includes('John')) {
            return {
              content: JSON.stringify({ name: 'John', age: 30, city: 'NYC' }),
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            };
          } else if (doc.includes('Jane')) {
            return {
              content: JSON.stringify({ name: 'Jane', age: 25, city: 'LA' }),
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            };
          } else {
            return {
              content: JSON.stringify({ name: 'Bob', age: 35, city: 'Chicago' }),
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            };
          }
        }

        return {
          content: '{}',
          model: 'gpt-4o',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
      });

      vi.spyOn(LLMClient.prototype, 'generate').mockImplementation(mockGenerate);

      const result = await runIngestion({
        documents,
        questions,
        dbPath: testDbPath,
        tableName: 'people',
        sampleSize: 3,
        questionSampleSize: 1,
      });

      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.schema.title).toBe('Person');
    }, 30000);
  });
});
