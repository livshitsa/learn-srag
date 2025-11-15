/**
 * Tests for Record Extractor
 *
 * Tests record extraction with mocked LLM calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecordExtractor, createRecordExtractor } from '../../src/ingestion/record-extractor.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { JSONSchema } from '../../src/models/schema.js';
import { Record } from '../../src/models/record.js';

// Mock LLM client
vi.mock('../../src/llm/llm-client.js');

describe('RecordExtractor', () => {
  let extractor: RecordExtractor;
  let mockLLMClient: any;
  let testSchema: JSONSchema;

  beforeEach(() => {
    // Create mock LLM client
    mockLLMClient = {
      generate: vi.fn(),
    };

    extractor = new RecordExtractor(mockLLMClient as LLMClient);

    // Create test schema
    testSchema = new JSONSchema({
      title: 'Hotel',
      description: 'Hotel information',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Hotel name',
          examples: ['Grand Hotel', 'Ocean View'],
        },
        rating: {
          type: 'integer',
          description: 'Star rating (1-5)',
          examples: [4, 5],
        },
        price: {
          type: 'number',
          description: 'Price per night',
          examples: [150.0, 200.5],
        },
        has_pool: {
          type: 'boolean',
          description: 'Has swimming pool',
          examples: [true, false],
        },
        city: {
          type: 'string',
          description: 'City location',
          examples: ['Paris', 'London'],
        },
      },
      required: ['name', 'city'],
    });
  });

  describe('constructor', () => {
    it('should create a new RecordExtractor instance', () => {
      expect(extractor).toBeInstanceOf(RecordExtractor);
    });

    it('should accept an LLM client', () => {
      const newExtractor = new RecordExtractor(mockLLMClient as LLMClient);
      expect(newExtractor).toBeInstanceOf(RecordExtractor);
    });
  });

  describe('extractRecord', () => {
    it('should extract a record from a plain text document', async () => {
      const document = `
Grand Hotel
Located in Paris
5-star rating
Price: $250 per night
Amenities: Swimming pool, Spa, Restaurant
      `.trim();

      const llmResponse = {
        content: JSON.stringify({
          name: 'Grand Hotel',
          rating: 5,
          price: 250.0,
          has_pool: true,
          city: 'Paris',
        }),
        model: 'gpt-4o',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      expect(record).toBeInstanceOf(Record);
      expect(record.getValue('name')).toBe('Grand Hotel');
      expect(record.getValue('rating')).toBe(5);
      expect(record.getValue('price')).toBe(250.0);
      expect(record.getValue('has_pool')).toBe(true);
      expect(record.getValue('city')).toBe('Paris');
      expect(mockLLMClient.generate).toHaveBeenCalledOnce();
    });

    it('should extract a record with markdown-formatted JSON response', async () => {
      const document = 'Ocean View Hotel in London, 4 stars, $180/night';

      const llmResponse = {
        content: `
Here's the extracted data:

\`\`\`json
{
  "name": "Ocean View Hotel",
  "rating": 4,
  "price": 180.0,
  "has_pool": false,
  "city": "London"
}
\`\`\`
        `,
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      expect(record.getValue('name')).toBe('Ocean View Hotel');
      expect(record.getValue('rating')).toBe(4);
      expect(record.getValue('city')).toBe('London');
    });

    it('should handle null values for missing fields', async () => {
      const document = 'Simple Hotel in Tokyo';

      const llmResponse = {
        content: JSON.stringify({
          name: 'Simple Hotel',
          rating: null,
          price: null,
          has_pool: null,
          city: 'Tokyo',
        }),
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      expect(record.getValue('name')).toBe('Simple Hotel');
      expect(record.getValue('rating')).toBe(null);
      expect(record.getValue('price')).toBe(null);
      expect(record.getValue('has_pool')).toBe(null);
      expect(record.getValue('city')).toBe('Tokyo');
    });

    it('should standardize abbreviated numeric values', async () => {
      const document = 'Luxury Resort, price: 1.5K per night';

      const llmResponse = {
        content: JSON.stringify({
          name: 'Luxury Resort',
          rating: 5,
          price: '1.5K', // Abbreviated form
          has_pool: true,
          city: 'Dubai',
        }),
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      // Record.standardize() should convert "1.5K" to 1500
      expect(record.getValue('price')).toBe(1500);
    });

    it('should standardize boolean-like text values', async () => {
      const document = 'Budget Hotel, has pool: yes';

      const llmResponse = {
        content: JSON.stringify({
          name: 'Budget Hotel',
          rating: 3,
          price: 80.0,
          has_pool: 'yes', // Text form
          city: 'Berlin',
        }),
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      // Record.standardize() should convert "yes" to true
      expect(record.getValue('has_pool')).toBe(true);
    });

    it('should handle HTML document format', async () => {
      const document = `
<div class="hotel">
  <h1>Mountain Lodge</h1>
  <p>Location: <span>Switzerland</span></p>
  <p>Rating: <span>4 stars</span></p>
  <p>Price: $300/night</p>
</div>
      `.trim();

      const llmResponse = {
        content: JSON.stringify({
          name: 'Mountain Lodge',
          rating: 4,
          price: 300.0,
          has_pool: null,
          city: 'Switzerland',
        }),
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      expect(record.getValue('name')).toBe('Mountain Lodge');
      expect(record.getValue('city')).toBe('Switzerland');
    });

    it('should handle markdown document format', async () => {
      const document = `
# Beach Resort

**Location**: Miami
**Rating**: 5 stars
**Price**: $350 per night
**Amenities**: Pool, Beach access

A luxurious beachfront resort.
      `.trim();

      const llmResponse = {
        content: JSON.stringify({
          name: 'Beach Resort',
          rating: 5,
          price: 350.0,
          has_pool: true,
          city: 'Miami',
        }),
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      const record = await extractor.extractRecord(document, testSchema);

      expect(record.getValue('name')).toBe('Beach Resort');
      expect(record.getValue('rating')).toBe(5);
      expect(record.getValue('city')).toBe('Miami');
    });

    it('should throw error if no JSON found in response', async () => {
      const document = 'Test document';

      const llmResponse = {
        content: 'This is not JSON at all, just plain text.',
        model: 'gpt-4o',
      };

      mockLLMClient.generate.mockResolvedValue(llmResponse);

      await expect(extractor.extractRecord(document, testSchema)).rejects.toThrow(
        'No valid JSON found in LLM response'
      );
    });

    it('should throw error if LLM call fails', async () => {
      const document = 'Test document';

      mockLLMClient.generate.mockRejectedValue(new Error('API error'));

      await expect(extractor.extractRecord(document, testSchema)).rejects.toThrow('API error');
    });
  });

  describe('batchExtract', () => {
    it('should extract records from multiple documents', async () => {
      const documents = [
        'Hotel A in Paris, 5 stars',
        'Hotel B in London, 4 stars',
        'Hotel C in Rome, 3 stars',
      ];

      const responses = [
        {
          name: 'Hotel A',
          rating: 5,
          price: 300.0,
          has_pool: true,
          city: 'Paris',
        },
        {
          name: 'Hotel B',
          rating: 4,
          price: 200.0,
          has_pool: false,
          city: 'London',
        },
        {
          name: 'Hotel C',
          rating: 3,
          price: 150.0,
          has_pool: true,
          city: 'Rome',
        },
      ];

      let callIndex = 0;
      mockLLMClient.generate.mockImplementation(async () => {
        const response = {
          content: JSON.stringify(responses[callIndex]),
          model: 'gpt-4o',
        };
        callIndex++;
        return response;
      });

      const records = await extractor.batchExtract(documents, testSchema);

      expect(records).toHaveLength(3);
      expect(records[0].getValue('name')).toBe('Hotel A');
      expect(records[1].getValue('name')).toBe('Hotel B');
      expect(records[2].getValue('name')).toBe('Hotel C');
      expect(mockLLMClient.generate).toHaveBeenCalledTimes(3);
    });

    it('should process documents in batches', async () => {
      const documents = Array.from({ length: 25 }, (_, i) => `Hotel ${i + 1}`);

      mockLLMClient.generate.mockImplementation(async (prompt: string) => {
        // Extract hotel number from prompt
        const match = prompt.match(/Hotel (\d+)/);
        const num = match ? parseInt(match[1]) : 1;

        return {
          content: JSON.stringify({
            name: `Hotel ${num}`,
            rating: 4,
            price: 100.0,
            has_pool: false,
            city: 'Test City',
          }),
          model: 'gpt-4o',
        };
      });

      const records = await extractor.batchExtract(documents, testSchema, 10);

      expect(records).toHaveLength(25);
      expect(mockLLMClient.generate).toHaveBeenCalledTimes(25);

      // Verify some records
      expect(records[0].getValue('name')).toBe('Hotel 1');
      expect(records[24].getValue('name')).toBe('Hotel 25');
    });

    it('should handle custom batch size', async () => {
      const documents = ['Doc 1', 'Doc 2', 'Doc 3', 'Doc 4', 'Doc 5'];

      mockLLMClient.generate.mockImplementation(async () => ({
        content: JSON.stringify({
          name: 'Test Hotel',
          rating: 3,
          price: 100.0,
          has_pool: false,
          city: 'Test City',
        }),
        model: 'gpt-4o',
      }));

      const records = await extractor.batchExtract(documents, testSchema, 2);

      expect(records).toHaveLength(5);
      expect(mockLLMClient.generate).toHaveBeenCalledTimes(5);
    });

    it('should handle batch extraction errors gracefully', async () => {
      const documents = ['Doc 1', 'Doc 2', 'Doc 3'];

      mockLLMClient.generate.mockRejectedValue(new Error('Batch processing error'));

      await expect(extractor.batchExtract(documents, testSchema)).rejects.toThrow(
        'Batch processing error'
      );
    });

    it('should use default batch size of 10', async () => {
      const documents = Array.from({ length: 15 }, (_, i) => `Doc ${i + 1}`);

      mockLLMClient.generate.mockImplementation(async () => ({
        content: JSON.stringify({
          name: 'Test Hotel',
          rating: 3,
          price: 100.0,
          has_pool: false,
          city: 'Test City',
        }),
        model: 'gpt-4o',
      }));

      const records = await extractor.batchExtract(documents, testSchema);

      expect(records).toHaveLength(15);
    });
  });

  describe('value standardization', () => {
    it('should standardize integer values with K suffix', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          rating: '5K', // Will be standardized to 5000
          price: 100.0,
          has_pool: false,
          city: 'Test',
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('rating')).toBe(5000);
    });

    it('should standardize integer values with M suffix', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          rating: '2M', // Will be standardized to 2000000
          price: 100.0,
          has_pool: false,
          city: 'Test',
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('rating')).toBe(2000000);
    });

    it('should standardize number values with B suffix', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          rating: 5,
          price: '1.5B', // Will be standardized to 1500000000
          has_pool: false,
          city: 'Test',
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('price')).toBe(1500000000);
    });

    it('should standardize boolean values from yes/no', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          rating: 5,
          price: 100.0,
          has_pool: 'yes', // Will be standardized to true
          city: 'Test',
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('has_pool')).toBe(true);
    });

    it('should standardize boolean values from no/false', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: 'Test',
          rating: 5,
          price: 100.0,
          has_pool: 'no', // Will be standardized to false
          city: 'Test',
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('has_pool')).toBe(false);
    });

    it('should trim string values', async () => {
      const document = 'Test';

      mockLLMClient.generate.mockResolvedValue({
        content: JSON.stringify({
          name: '  Grand Hotel  ', // Will be trimmed
          rating: 5,
          price: 100.0,
          has_pool: false,
          city: '  Paris  ', // Will be trimmed
        }),
        model: 'gpt-4o',
      });

      const record = await extractor.extractRecord(document, testSchema);
      expect(record.getValue('name')).toBe('Grand Hotel');
      expect(record.getValue('city')).toBe('Paris');
    });
  });

  describe('createRecordExtractor', () => {
    it('should create a RecordExtractor instance', () => {
      const extractor = createRecordExtractor(mockLLMClient as LLMClient);
      expect(extractor).toBeInstanceOf(RecordExtractor);
    });

    it('should accept custom prompt template path', () => {
      const extractor = createRecordExtractor(
        mockLLMClient as LLMClient,
        '/custom/path/template.txt'
      );
      expect(extractor).toBeInstanceOf(RecordExtractor);
    });
  });
});
