/**
 * RecordExtractor Demo
 *
 * Demonstrates how to use the RecordExtractor to extract structured data from documents.
 */

import { RecordExtractor } from '../src/ingestion/record-extractor.js';
import { LLMClient } from '../src/llm/llm-client.js';
import { JSONSchema } from '../src/models/schema.js';

async function demo() {
  // Create LLM client
  const llmClient = new LLMClient();

  // Create RecordExtractor
  const extractor = new RecordExtractor(llmClient);

  // Define schema for hotel data
  const schema = new JSONSchema({
    title: 'Hotel',
    description: 'Hotel information extracted from web pages',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Hotel name',
        examples: ['Grand Hotel', 'Ocean View Resort'],
      },
      rating: {
        type: 'integer',
        description: 'Star rating (1-5)',
        examples: [4, 5],
      },
      price: {
        type: 'number',
        description: 'Price per night in USD',
        examples: [150.0, 250.5],
      },
      has_pool: {
        type: 'boolean',
        description: 'Has swimming pool',
        examples: [true, false],
      },
      city: {
        type: 'string',
        description: 'City location',
        examples: ['Paris', 'London', 'New York'],
      },
      rooms: {
        type: 'integer',
        description: 'Number of rooms',
        examples: [100, 250],
      },
    },
    required: ['name', 'city'],
  });

  // Example documents
  const documents = [
    `
# Grand Hotel Paris

**Location**: Paris, France
**Rating**: 5 stars
**Price**: $350 per night
**Rooms**: 200

Amenities:
- Swimming pool
- Spa
- Restaurant
- Fitness center

A luxury hotel in the heart of Paris.
    `,
    `
<div class="hotel">
  <h1>Beach Resort Miami</h1>
  <p>Location: <span>Miami</span></p>
  <p>Rating: <span>4 stars</span></p>
  <p>Price: $180/night</p>
  <p>Rooms: 150</p>
  <p>Amenities: Beach access, Pool, Bar</p>
</div>
    `,
    `
Ocean View Hotel
Located in London, UK
3-star rating
Price: £120 per night (approximately $150)
No pool
120 rooms available
    `,
  ];

  console.log('Extracting records from documents...\n');

  // Extract single record
  console.log('Example 1: Single record extraction');
  const singleRecord = await extractor.extractRecord(documents[0], schema);
  console.log('Extracted:', singleRecord.toJSON());
  console.log();

  // Batch extract with small batch size
  console.log('Example 2: Batch extraction (3 documents, batch size 2)');
  const records = await extractor.batchExtract(documents, schema, 2);
  console.log(`Extracted ${records.length} records:`);
  records.forEach((record, i) => {
    console.log(`\nRecord ${i + 1}:`, record.toJSON());
  });

  console.log('\nDemo complete!');
}

// Run demo
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

export { demo };
