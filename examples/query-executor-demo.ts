/**
 * QueryExecutor Demo
 *
 * Demonstrates the usage of QueryExecutor for enhanced query execution
 */

import { DatabaseManager } from '../src/database/database-manager.js';
import { QueryExecutor } from '../src/inference/query-executor.js';
import { JSONSchema } from '../src/models/schema.js';
import { Record as RecordModel } from '../src/models/record.js';

async function demo() {
  // Create database and executor
  const db = new DatabaseManager('data/databases/demo.db');
  const executor = new QueryExecutor(db);

  // Create schema
  const schema = new JSONSchema({
    title: 'Products',
    description: 'Product catalog',
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Product name', examples: ['Laptop'] },
      price: { type: 'number', description: 'Price in USD', examples: [999.99] },
      quantity: { type: 'integer', description: 'Stock quantity', examples: [50] },
      is_available: { type: 'boolean', description: 'Availability', examples: [true] },
      has_discount: { type: 'boolean', description: 'Discount flag', examples: [false] },
    },
  });

  // Create table
  db.createTableFromSchema(schema, 'products');

  // Insert sample data
  const products = [
    new RecordModel({ name: 'Laptop', price: 999.99, quantity: 10, is_available: true, has_discount: false }, schema),
    new RecordModel({ name: 'Mouse', price: 29.99, quantity: 50, is_available: true, has_discount: true }, schema),
    new RecordModel({ name: 'Keyboard', price: 79.99, quantity: 30, is_available: true, has_discount: false }, schema),
    new RecordModel({ name: 'Monitor', price: 299.99, quantity: 0, is_available: false, has_discount: true }, schema),
    new RecordModel({ name: 'Webcam', price: 89.99, quantity: 15, is_available: true, has_discount: false }, schema),
  ];

  db.insertRecords(products, 'products');

  console.log('=== QueryExecutor Demo ===\n');

  // 1. Basic execution
  console.log('1. Basic Query:');
  const basic = executor.execute('SELECT * FROM products');
  console.log(`Found ${basic.rowCount} products\n`);

  // 2. Formatted results (with boolean conversion)
  console.log('2. Formatted Results (booleans converted):');
  const formatted = executor.executeAndFormat('SELECT * FROM products WHERE price < 100');
  console.log('First product:', JSON.stringify(formatted.rows[0], null, 2));
  console.log(`is_available: ${formatted.rows[0].is_available} (type: ${typeof formatted.rows[0].is_available})`);
  console.log(`has_discount: ${formatted.rows[0].has_discount} (type: ${typeof formatted.rows[0].has_discount})\n`);

  // 3. Pagination
  console.log('3. Paginated Results (page 1, size 2):');
  const page1 = executor.paginate('SELECT * FROM products ORDER BY name', 1, 2);
  console.log(`Page ${page1.page}/${page1.totalPages}`);
  console.log(`Showing ${page1.rowCount} of ${page1.totalRows} total rows`);
  console.log(`Has more: ${page1.hasMore}, Has previous: ${page1.hasPrevious}`);
  console.log('Products:', page1.rows.map(r => r.name).join(', '));
  console.log('');

  // 4. Result metadata
  console.log('4. Result Metadata:');
  const withMetadata = executor.executeAndFormat('SELECT * FROM products LIMIT 1');
  console.log('Columns:', withMetadata.metadata.columns.map(c => `${c.name} (${c.type})`).join(', '));
  console.log('');

  // 5. Helper methods
  console.log('5. Helper Methods:');

  // executeOne - get single row
  const oneProduct = executor.executeOne('SELECT * FROM products WHERE name = ?', ['Laptop']);
  console.log(`executeOne: ${oneProduct?.name} - $${oneProduct?.price}`);

  // hasResults - check if query returns data
  const hasExpensive = executor.hasResults('SELECT * FROM products WHERE price > 500');
  console.log(`hasResults (price > 500): ${hasExpensive}`);

  // count - get total count
  const availableCount = executor.count('SELECT * FROM products WHERE is_available = 1');
  console.log(`count (available): ${availableCount}`);

  console.log('\n=== Demo Complete ===');

  // Cleanup
  db.close();
}

demo().catch(console.error);
