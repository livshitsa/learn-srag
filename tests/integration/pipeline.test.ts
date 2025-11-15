/**
 * Integration tests for orchestration pipeline
 *
 * Tests end-to-end ingestion and inference workflows.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ingestDocuments, answerQuestion, runFullPipeline } from '../../src/orchestration/pipeline.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

describe('Pipeline Integration Tests', () => {
  const testDbPath = path.resolve(__dirname, '../../data/test-integration.db');

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

  describe('ingestDocuments', () => {
    it('should complete full ingestion pipeline', async () => {
      // Sample documents (hotels)
      const documents = [
        'Hotel A: Located in Sydney, 5 stars, pool and gym, $200/night',
        'Hotel B: Located in Melbourne, 4 stars, wifi and parking, $150/night',
        'Hotel C: Located in Brisbane, 3 stars, breakfast included, $100/night',
        'Hotel D: Located in Sydney, 4 stars, spa and pool, $180/night',
        'Hotel E: Located in Perth, 5 stars, ocean view, $250/night',
      ];

      const questions = [
        'What is the average price for hotels in Sydney?',
        'How many 5-star hotels are there?',
        'Which hotels have a pool?',
      ];

      // Mock LLM client
      const llmClient = new LLMClient();

      // Mock schema generation
      vi.spyOn(llmClient, 'generate').mockImplementation(async (prompt: string) => {
        if (prompt.includes('predict a JSON schema')) {
          return {
            content: JSON.stringify({
              title: 'Hotel',
              description: 'Hotel information',
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Hotel name',
                  examples: ['Hotel A', 'Hotel B'],
                },
                location: {
                  type: 'string',
                  description: 'City location',
                  examples: ['Sydney', 'Melbourne'],
                },
                stars: {
                  type: 'integer',
                  description: 'Star rating',
                  examples: [5, 4, 3],
                },
                price: {
                  type: 'number',
                  description: 'Price per night in dollars',
                  examples: [200, 150, 100],
                },
              },
              required: ['name', 'location', 'stars', 'price'],
            }),
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          };
        }

        // Mock record extraction
        if (prompt.includes('extract structured data')) {
          const doc = prompt.match(/Document:\s*(.+?)(?:\n|$)/)?.[1] || '';
          const match = doc.match(/Hotel ([A-Z]).*?(\d+) stars.*?\$(\d+)/);
          if (match) {
            return {
              content: JSON.stringify({
                name: `Hotel ${match[1]}`,
                location: doc.includes('Sydney')
                  ? 'Sydney'
                  : doc.includes('Melbourne')
                    ? 'Melbourne'
                    : doc.includes('Brisbane')
                      ? 'Brisbane'
                      : 'Perth',
                stars: parseInt(match[2]),
                price: parseInt(match[3]),
              }),
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

      // Run ingestion
      const result = await ingestDocuments(
        documents,
        questions,
        {
          dbPath: testDbPath,
          tableName: 'hotels',
          numSampleDocs: 3,
          numSampleQuestions: 3,
          refinementIterations: 1, // Reduce iterations for faster tests
        },
        llmClient
      );

      // Verify results
      expect(result.schema).toBeDefined();
      expect(result.schema.title).toBe('Hotel');
      expect(result.recordCount).toBeGreaterThan(0);
      expect(result.statistics).toBeDefined();
      expect(result.tableName).toBe('hotels');
      expect(result.dbPath).toBe(testDbPath);

      // Verify database was created
      expect(existsSync(testDbPath)).toBe(true);

      // Verify table exists
      const db = new DatabaseManager(testDbPath);
      expect(db.tableExists('hotels')).toBe(true);
      expect(db.getRowCount('hotels')).toBe(result.recordCount);
      db.close();
    }, 30000); // 30 second timeout for integration test

    it('should handle errors gracefully', async () => {
      const documents = ['Invalid document'];
      const questions = ['Test question'];

      const llmClient = new LLMClient();

      // Mock LLM to throw error
      vi.spyOn(llmClient, 'generate').mockRejectedValue(new Error('LLM API error'));

      await expect(
        ingestDocuments(
          documents,
          questions,
          {
            dbPath: testDbPath,
            tableName: 'test',
          },
          llmClient
        )
      ).rejects.toThrow('LLM API error');
    });
  });

  describe('answerQuestion', () => {
    it('should complete full inference pipeline', async () => {
      // First, set up a test database with data
      const db = new DatabaseManager(testDbPath);

      // Create a simple table
      db.executeQuery(`
        CREATE TABLE hotels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          location TEXT,
          stars INTEGER,
          price REAL
        )
      `);

      // Insert test data
      db.executeQuery(
        `
        INSERT INTO hotels (name, location, stars, price) VALUES
        ('Hotel A', 'Sydney', 5, 200),
        ('Hotel B', 'Melbourne', 4, 150),
        ('Hotel C', 'Brisbane', 3, 100),
        ('Hotel D', 'Sydney', 4, 180),
        ('Hotel E', 'Perth', 5, 250)
      `
      );

      // Calculate statistics
      const statistics = db.getColumnStatistics('hotels');
      db.close();

      // Create mock schema
      const schema = {
        title: 'Hotel',
        description: 'Hotel information',
        type: 'object' as const,
        properties: {
          name: {
            type: 'string' as const,
            description: 'Hotel name',
            examples: ['Hotel A'],
          },
          location: {
            type: 'string' as const,
            description: 'City',
            examples: ['Sydney'],
          },
          stars: {
            type: 'integer' as const,
            description: 'Star rating',
            examples: [5],
          },
          price: {
            type: 'number' as const,
            description: 'Price per night',
            examples: [200],
          },
        },
        required: ['name', 'location', 'stars', 'price'],
      };

      // Mock LLM client
      const llmClient = new LLMClient();

      vi.spyOn(llmClient, 'generate').mockImplementation(async (prompt: string) => {
        // Mock SQL generation
        if (prompt.includes('Translate the following natural language question')) {
          return {
            content: 'SELECT AVG(price) as average_price FROM hotels WHERE location = "Sydney"',
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }

        // Mock answer generation
        if (prompt.includes('Generate a natural language answer')) {
          return {
            content: 'The average price for hotels in Sydney is $190.',
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
          };
        }

        return {
          content: 'Unknown',
          model: 'gpt-4o',
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };
      });

      // Run inference
      const result = await answerQuestion(
        'What is the average price for hotels in Sydney?',
        {
          dbPath: testDbPath,
          tableName: 'hotels',
          schema,
          statistics,
        },
        llmClient
      );

      // Verify results
      expect(result.question).toBe('What is the average price for hotels in Sydney?');
      expect(result.sql).toContain('SELECT');
      expect(result.results).toBeDefined();
      expect(result.answer).toBeDefined();
      expect(result.answer).toContain('190');
      expect(result.executionTime).toBeGreaterThan(0);
    }, 30000);
  });

  describe('runFullPipeline', () => {
    it('should run complete ingestion and inference workflow', async () => {
      const documents = [
        'Product A: Price $100, Category Electronics, Rating 4.5',
        'Product B: Price $50, Category Books, Rating 4.0',
        'Product C: Price $200, Category Electronics, Rating 5.0',
      ];

      const questions = [
        'What categories are available?',
        'What is the average rating?',
      ];

      const questionsToAnswer = ['What is the average price of electronics?'];

      // Mock LLM client
      const llmClient = new LLMClient();

      vi.spyOn(llmClient, 'generate').mockImplementation(async (prompt: string) => {
        // Mock schema generation
        if (prompt.includes('predict a JSON schema')) {
          return {
            content: JSON.stringify({
              title: 'Product',
              description: 'Product information',
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Product name', examples: ['Product A'] },
                price: { type: 'number', description: 'Price in dollars', examples: [100] },
                category: { type: 'string', description: 'Category', examples: ['Electronics'] },
                rating: { type: 'number', description: 'Rating out of 5', examples: [4.5] },
              },
            }),
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
          };
        }

        // Mock record extraction
        if (prompt.includes('extract structured data')) {
          const doc = prompt.match(/Document:\s*(.+?)(?:\n|$)/)?.[1] || '';
          const match = doc.match(/Product ([A-Z]).*?Price \$(\d+).*?Category (\w+).*?Rating ([\d.]+)/);
          if (match) {
            return {
              content: JSON.stringify({
                name: `Product ${match[1]}`,
                price: parseInt(match[2]),
                category: match[3],
                rating: parseFloat(match[4]),
              }),
              model: 'gpt-4o',
              usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
            };
          }
        }

        // Mock SQL generation
        if (prompt.includes('Translate the following natural language question')) {
          return {
            content: 'SELECT AVG(price) as average_price FROM products WHERE category = "Electronics"',
            model: 'gpt-4o',
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }

        // Mock answer generation
        if (prompt.includes('Generate a natural language answer')) {
          return {
            content: 'The average price of electronics is $150.',
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

      // Run full pipeline
      const result = await runFullPipeline(
        documents,
        questions,
        {
          dbPath: testDbPath,
          tableName: 'products',
          numSampleDocs: 3,
          numSampleQuestions: 2,
          refinementIterations: 1,
        },
        questionsToAnswer,
        llmClient
      );

      // Verify ingestion results
      expect(result.ingestion).toBeDefined();
      expect(result.ingestion.recordCount).toBeGreaterThan(0);
      expect(result.ingestion.schema.title).toBe('Product');

      // Verify inference results
      expect(result.answers).toHaveLength(1);
      expect(result.answers[0].question).toBe('What is the average price of electronics?');
      expect(result.answers[0].answer).toBeDefined();
      expect(result.answers[0].sql).toBeDefined();
    }, 30000);
  });
});
