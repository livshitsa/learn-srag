/**
 * Tests for Answer Generator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnswerGenerator, createAnswerGenerator } from '../../src/inference/answer-generator.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { LLMResponse } from '../../src/models/types.js';

describe('AnswerGenerator', () => {
  let mockLLMClient: LLMClient;
  let generator: AnswerGenerator;

  beforeEach(() => {
    // Create a mock LLM client
    mockLLMClient = {
      generate: vi.fn(),
      hasProvider: vi.fn(),
      getAvailableModels: vi.fn(),
    } as any;

    generator = new AnswerGenerator(mockLLMClient);
  });

  describe('formatResults', () => {
    it('should format empty results', () => {
      const formatted = generator.formatResults([]);
      expect(formatted).toBe('No results found.');
    });

    it('should format null results', () => {
      const formatted = generator.formatResults(null as any);
      expect(formatted).toBe('No results found.');
    });

    it('should format single result with one field', () => {
      const results = [{ count: 42 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('count');
      expect(formatted).toContain('42');
    });

    it('should format single result with multiple fields', () => {
      const results = [{ name: 'Hotel A', rating: 4.5, city: 'NYC' }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('Hotel A');
      expect(formatted).toContain('4.5');
      expect(formatted).toContain('NYC');
    });

    it('should format multiple results with one column', () => {
      const results = [{ name: 'Hotel A' }, { name: 'Hotel B' }, { name: 'Hotel C' }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('Hotel A');
      expect(formatted).toContain('Hotel B');
      expect(formatted).toContain('Hotel C');
      expect(formatted).toMatch(/1\./); // Should be numbered
    });

    it('should format multiple results with few columns', () => {
      const results = [
        { name: 'Hotel A', rating: 4.5 },
        { name: 'Hotel B', rating: 4.2 },
      ];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('Hotel A');
      expect(formatted).toContain('4.50'); // Should format numbers
      expect(formatted).toContain('Hotel B');
    });

    it('should format single result with many columns as JSON', () => {
      const results = [
        { id: 1, name: 'Hotel A', rating: 4.5, city: 'NYC', country: 'USA', price: 200 },
      ];
      const formatted = generator.formatResults(results);
      // Single result with many fields should be JSON formatted
      expect(formatted).toContain('"name": "Hotel A"');
      expect(formatted).toContain('"rating": 4.5');
    });

    it('should truncate large result sets', () => {
      const results = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));
      const formatted = generator.formatResults(results, 100);
      expect(formatted).toContain('100');
      expect(formatted).toContain('50 more row(s)');
      expect(formatted).not.toContain('id: 150');
    });

    it('should handle null values', () => {
      const results = [{ name: 'Hotel A', rating: null }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('null');
    });

    it('should format boolean values', () => {
      const results = [{ name: 'Hotel A', available: true }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('true');
    });

    it('should format numbers with appropriate precision', () => {
      const results = [{ integer: 42, float: 3.14159 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('42'); // Integer
      expect(formatted).toContain('3.14'); // Float rounded
    });
  });

  describe('generateAnswer', () => {
    it('should generate answer for empty results', async () => {
      const mockResponse: LLMResponse = {
        content: 'No hotels were found matching your criteria.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const result = await generator.generateAnswer(
        'What hotels are available?',
        [],
        'SELECT * FROM hotels WHERE available = true'
      );

      expect(result.answer).toBe('No hotels were found matching your criteria.');
      expect(result.resultCount).toBe(0);
      expect(result.wasTruncated).toBe(false);
      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.stringContaining('No results found'),
        expect.objectContaining({ model: 'gpt-4o', temperature: 0.3 })
      );
    });

    it('should generate answer for single result (count)', async () => {
      const mockResponse: LLMResponse = {
        content: 'There are 42 hotels in the database.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = [{ count: 42 }];
      const result = await generator.generateAnswer(
        'How many hotels are there?',
        results,
        'SELECT COUNT(*) as count FROM hotels'
      );

      expect(result.answer).toBe('There are 42 hotels in the database.');
      expect(result.resultCount).toBe(1);
      expect(result.wasTruncated).toBe(false);
      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.stringContaining('count: 42'),
        expect.any(Object)
      );
    });

    it('should generate answer for multiple results', async () => {
      const mockResponse: LLMResponse = {
        content: 'The top 3 hotels by rating are Grand Hotel (4.8), Plaza Hotel (4.7), and Ritz Hotel (4.6).',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = [
        { name: 'Grand Hotel', rating: 4.8 },
        { name: 'Plaza Hotel', rating: 4.7 },
        { name: 'Ritz Hotel', rating: 4.6 },
      ];

      const result = await generator.generateAnswer(
        'What are the top 3 hotels by rating?',
        results,
        'SELECT name, rating FROM hotels ORDER BY rating DESC LIMIT 3'
      );

      expect(result.answer).toContain('Grand Hotel');
      expect(result.resultCount).toBe(3);
      expect(result.wasTruncated).toBe(false);
    });

    it('should indicate truncation for large result sets', async () => {
      const mockResponse: LLMResponse = {
        content: 'There are 150 hotels in total.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, name: `Hotel ${i + 1}` }));

      const result = await generator.generateAnswer(
        'List all hotels',
        results,
        'SELECT * FROM hotels',
        { maxRows: 50 }
      );

      expect(result.resultCount).toBe(150);
      expect(result.wasTruncated).toBe(true);
      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.stringContaining('100 more row(s)'),
        expect.any(Object)
      );
    });

    it('should use custom model and temperature', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        model: 'gpt-4o-mini',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      await generator.generateAnswer('Question?', [{ count: 1 }], 'SELECT COUNT(*)', {
        model: 'gpt-4o-mini',
        temperature: 0.5,
      });

      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: 'gpt-4o-mini', temperature: 0.5 })
      );
    });

    it('should handle aggregation questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'The average hotel rating is 4.2 out of 5.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = [{ avg_rating: 4.23 }];
      const result = await generator.generateAnswer(
        'What is the average hotel rating?',
        results,
        'SELECT AVG(rating) as avg_rating FROM hotels'
      );

      expect(result.answer).toContain('4.2');
    });

    it('should handle filtering questions', async () => {
      const mockResponse: LLMResponse = {
        content: 'The hotels in New York are Grand Hotel and Plaza Hotel.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = [{ name: 'Grand Hotel' }, { name: 'Plaza Hotel' }];
      const result = await generator.generateAnswer(
        'Which hotels are in New York?',
        results,
        "SELECT name FROM hotels WHERE city = 'New York'"
      );

      expect(result.answer).toContain('Grand Hotel');
      expect(result.answer).toContain('Plaza Hotel');
    });

    it('should handle LLM errors gracefully', async () => {
      vi.mocked(mockLLMClient.generate).mockRejectedValue(new Error('LLM API error'));

      await expect(
        generator.generateAnswer('Question?', [{ count: 1 }], 'SELECT COUNT(*)')
      ).rejects.toThrow('LLM API error');
    });

    it('should include question, query, and results in prompt', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const question = 'How many hotels?';
      const query = 'SELECT COUNT(*) FROM hotels';
      const results = [{ count: 42 }];

      await generator.generateAnswer(question, results, query);

      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain(question);
      expect(prompt).toContain(query);
      expect(prompt).toContain('42');
    });
  });

  describe('generateAnswerWithCitation', () => {
    it('should include SQL query in answer', async () => {
      const mockResponse: LLMResponse = {
        content: 'There are 42 hotels.',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const query = 'SELECT COUNT(*) as count FROM hotels';
      const result = await generator.generateAnswerWithCitation(
        'How many hotels?',
        [{ count: 42 }],
        query
      );

      expect(result.answer).toContain('There are 42 hotels');
      expect(result.answer).toContain('SQL Query Used:');
      expect(result.answer).toContain(query);
      expect(result.answer).toContain('```sql');
    });

    it('should include metadata from base generateAnswer', async () => {
      const mockResponse: LLMResponse = {
        content: 'Answer',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);

      const results = Array.from({ length: 150 }, (_, i) => ({ id: i + 1 }));
      const result = await generator.generateAnswerWithCitation('Question?', results, 'SELECT *', {
        maxRows: 50,
      });

      expect(result.resultCount).toBe(150);
      expect(result.wasTruncated).toBe(true);
      expect(result.answer).toContain('SQL Query Used:');
    });
  });

  describe('getResultsSummary', () => {
    it('should summarize empty results', () => {
      const summary = generator.getResultsSummary([]);
      expect(summary.count).toBe(0);
      expect(summary.isEmpty).toBe(true);
      expect(summary.columns).toEqual([]);
      expect(summary.sampleRow).toBeUndefined();
    });

    it('should summarize single result', () => {
      const results = [{ name: 'Hotel A', rating: 4.5 }];
      const summary = generator.getResultsSummary(results);
      expect(summary.count).toBe(1);
      expect(summary.isEmpty).toBe(false);
      expect(summary.columns).toEqual(['name', 'rating']);
      expect(summary.sampleRow).toEqual({ name: 'Hotel A', rating: 4.5 });
    });

    it('should summarize multiple results', () => {
      const results = [
        { id: 1, name: 'Hotel A' },
        { id: 2, name: 'Hotel B' },
        { id: 3, name: 'Hotel C' },
      ];
      const summary = generator.getResultsSummary(results);
      expect(summary.count).toBe(3);
      expect(summary.isEmpty).toBe(false);
      expect(summary.columns).toEqual(['id', 'name']);
      expect(summary.sampleRow).toEqual({ id: 1, name: 'Hotel A' });
    });

    it('should handle null results', () => {
      const summary = generator.getResultsSummary(null as any);
      expect(summary.count).toBe(0);
      expect(summary.isEmpty).toBe(true);
    });
  });

  describe('createAnswerGenerator', () => {
    it('should create generator with provided LLM client', () => {
      const generator = createAnswerGenerator(mockLLMClient);
      expect(generator).toBeInstanceOf(AnswerGenerator);
    });

    it('should create generator with default LLM client', () => {
      // This will fail if env vars are not set, but that's expected
      // In real usage, env vars should be set
      try {
        const generator = createAnswerGenerator();
        expect(generator).toBeInstanceOf(AnswerGenerator);
      } catch (error) {
        // Expected if API keys are not set
        expect((error as Error).message).toContain('LLM API key');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle results with special characters', () => {
      const results = [{ name: "O'Reilly's Hotel & Spa", city: 'São Paulo' }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain("O'Reilly's Hotel & Spa");
      expect(formatted).toContain('São Paulo');
    });

    it('should handle very large numbers', () => {
      const results = [{ revenue: 1234567890.123 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('1234567890.12');
    });

    it('should handle very small numbers', () => {
      const results = [{ probability: 0.0001 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('0.00');
    });

    it('should handle zero', () => {
      const results = [{ count: 0 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('0');
    });

    it('should handle negative numbers', () => {
      const results = [{ profit: -1000.50 }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('-1000.50');
    });

    it('should handle undefined values', () => {
      const results = [{ name: 'Hotel A', rating: undefined }];
      const formatted = generator.formatResults(results);
      // Undefined values should be formatted as 'null' in inline format
      expect(formatted).toContain('name: Hotel A');
      expect(formatted).toContain('rating: null');
    });

    it('should handle empty strings', () => {
      const results = [{ name: '', city: 'NYC' }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('NYC');
    });

    it('should handle nested objects', () => {
      const results = [{ data: { nested: { value: 42 } } }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('nested');
      expect(formatted).toContain('42');
    });

    it('should handle arrays in results', () => {
      const results = [{ tags: ['luxury', 'pool', 'spa'] }];
      const formatted = generator.formatResults(results);
      expect(formatted).toContain('luxury');
      expect(formatted).toContain('pool');
    });
  });

  describe('different question types', () => {
    beforeEach(() => {
      const mockResponse: LLMResponse = {
        content: 'Generated answer',
        model: 'gpt-4o',
      };
      vi.mocked(mockLLMClient.generate).mockResolvedValue(mockResponse);
    });

    it('should handle COUNT queries', async () => {
      await generator.generateAnswer('How many hotels?', [{ count: 42 }], 'SELECT COUNT(*)');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('count: 42');
    });

    it('should handle SUM queries', async () => {
      await generator.generateAnswer('Total revenue?', [{ total: 1000000 }], 'SELECT SUM(revenue)');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('total: 1000000');
    });

    it('should handle AVG queries', async () => {
      await generator.generateAnswer('Average rating?', [{ avg: 4.23 }], 'SELECT AVG(rating)');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('avg: 4.23');
    });

    it('should handle MIN/MAX queries', async () => {
      await generator.generateAnswer(
        'Price range?',
        [{ min: 50, max: 500 }],
        'SELECT MIN(price), MAX(price)'
      );
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      // Single result with 2 fields should be formatted inline
      expect(prompt).toContain('min: 50, max: 500');
    });

    it('should handle LIST queries', async () => {
      const results = [{ name: 'Hotel A' }, { name: 'Hotel B' }, { name: 'Hotel C' }];
      await generator.generateAnswer('List all hotels', results, 'SELECT name FROM hotels');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('Hotel A');
      expect(prompt).toContain('Hotel B');
      expect(prompt).toContain('Hotel C');
    });

    it('should handle GROUP BY queries', async () => {
      const results = [
        { city: 'NYC', count: 10 },
        { city: 'LA', count: 8 },
      ];
      await generator.generateAnswer('Hotels per city?', results, 'SELECT city, COUNT(*)');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('NYC');
      expect(prompt).toContain('LA');
    });

    it('should handle JOIN queries with multiple fields', async () => {
      const results = [
        { hotel: 'Grand Hotel', city: 'NYC', country: 'USA' },
        { hotel: 'Plaza Hotel', city: 'NYC', country: 'USA' },
      ];
      await generator.generateAnswer('Hotels in USA?', results, 'SELECT ... FROM hotels JOIN ...');
      const prompt = vi.mocked(mockLLMClient.generate).mock.calls[0][0];
      expect(prompt).toContain('Grand Hotel');
      expect(prompt).toContain('Plaza Hotel');
    });
  });
});
