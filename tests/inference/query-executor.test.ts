/**
 * Tests for QueryExecutor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryExecutor } from '../../src/inference/query-executor.js';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { JSONSchema } from '../../src/models/schema.js';
import { Record as RecordModel } from '../../src/models/record.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SQLError } from '../../src/models/types.js';

describe('QueryExecutor', () => {
  let tempDir: string;
  let dbPath: string;
  let db: DatabaseManager;
  let executor: QueryExecutor;
  let schema: JSONSchema;

  beforeEach(() => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'srag-test-'));
    dbPath = join(tempDir, 'test.db');

    // Create database and executor
    db = new DatabaseManager(dbPath);
    executor = new QueryExecutor(db);

    // Create test schema
    schema = new JSONSchema({
      title: 'TestRecords',
      description: 'Test records',
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name', examples: ['Test'] },
        age: { type: 'integer', description: 'Age', examples: [25] },
        score: { type: 'number', description: 'Score', examples: [95.5] },
        is_active: { type: 'boolean', description: 'Active status', examples: [true] },
        has_premium: { type: 'boolean', description: 'Premium flag', examples: [false] },
      },
      required: ['name'],
    });

    // Create table
    db.createTableFromSchema(schema, 'test_records');

    // Insert test data
    const records = [
      new RecordModel({ name: 'Alice', age: 25, score: 95.5, is_active: true, has_premium: false }, schema),
      new RecordModel({ name: 'Bob', age: 30, score: 87.0, is_active: false, has_premium: true }, schema),
      new RecordModel({ name: 'Charlie', age: 35, score: 92.3, is_active: true, has_premium: true }, schema),
      new RecordModel({ name: 'Diana', age: 28, score: 88.7, is_active: false, has_premium: false }, schema),
      new RecordModel({ name: 'Eve', age: 22, score: 90.1, is_active: true, has_premium: false }, schema),
    ];

    db.insertRecords(records, 'test_records');
  });

  afterEach(() => {
    // Clean up
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create QueryExecutor instance', () => {
      expect(executor).toBeDefined();
      expect(executor).toBeInstanceOf(QueryExecutor);
    });
  });

  describe('execute', () => {
    it('should execute basic query', () => {
      const result = executor.execute('SELECT * FROM test_records');

      expect(result.rowCount).toBe(5);
      expect(result.rows).toHaveLength(5);
      expect(result.sql).toContain('SELECT * FROM test_records');
    });

    it('should execute query with WHERE clause', () => {
      const result = executor.execute('SELECT * FROM test_records WHERE age > 25');

      expect(result.rowCount).toBe(3);
      expect(result.rows).toHaveLength(3);
    });

    it('should execute query with parameters', () => {
      const result = executor.execute(
        'SELECT * FROM test_records WHERE name = ?',
        { params: ['Alice'] }
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('Alice');
    });

    it('should execute query with formatting', () => {
      const result = executor.execute('SELECT * FROM test_records WHERE name = ?', {
        params: ['Alice'],
        format: true,
      });

      expect(result.rowCount).toBe(1);
      expect(result).toHaveProperty('metadata');

      // Check that the result is a FormattedQueryResult
      if ('metadata' in result) {
        expect(result.metadata).toBeDefined();
        expect(result.metadata.columns).toBeDefined();
        expect(result.metadata.hasResults).toBe(true);
      }
    });

    it('should execute query with pagination', () => {
      const result = executor.execute('SELECT * FROM test_records ORDER BY name', {
        page: 1,
        pageSize: 2,
      });

      expect(result.rowCount).toBe(2);
      expect(result.rows).toHaveLength(2);
      expect(result.sql).toContain('LIMIT 2 OFFSET 0');
    });

    it('should throw error for invalid SQL', () => {
      expect(() => {
        executor.execute('INVALID SQL QUERY');
      }).toThrow();
    });
  });

  describe('formatResults', () => {
    it('should format query results', () => {
      const raw = db.executeQuery('SELECT * FROM test_records WHERE name = ?', ['Alice']);
      const formatted = executor.formatResults(raw);

      expect(formatted.rows).toHaveLength(1);
      expect(formatted.metadata).toBeDefined();
      expect(formatted.metadata.columns).toBeDefined();
      expect(formatted.metadata.rowCount).toBe(1);
      expect(formatted.metadata.hasResults).toBe(true);
    });

    it('should convert boolean columns (0/1 to false/true)', () => {
      const raw = db.executeQuery('SELECT * FROM test_records WHERE name = ?', ['Alice']);
      const formatted = executor.formatResults(raw);

      expect(formatted.rows[0].is_active).toBe(true);
      expect(formatted.rows[0].has_premium).toBe(false);
    });

    it('should handle rows with different boolean values', () => {
      const raw = db.executeQuery('SELECT * FROM test_records WHERE name IN (?, ?)', ['Alice', 'Bob']);
      const formatted = executor.formatResults(raw);

      // Alice: is_active=true, has_premium=false
      expect(formatted.rows[0].is_active).toBe(true);
      expect(formatted.rows[0].has_premium).toBe(false);

      // Bob: is_active=false, has_premium=true
      expect(formatted.rows[1].is_active).toBe(false);
      expect(formatted.rows[1].has_premium).toBe(true);
    });

    it('should preserve non-boolean integer values', () => {
      const raw = db.executeQuery('SELECT * FROM test_records WHERE name = ?', ['Alice']);
      const formatted = executor.formatResults(raw);

      // Age is an integer but not a boolean column
      expect(formatted.rows[0].age).toBe(25);
      expect(typeof formatted.rows[0].age).toBe('number');
    });

    it('should handle null values', () => {
      // Insert a record with null values
      const recordWithNull = new RecordModel(
        { name: 'Frank', age: null, score: null, is_active: null, has_premium: null },
        schema
      );
      db.insertRecords([recordWithNull], 'test_records');

      const raw = db.executeQuery('SELECT * FROM test_records WHERE name = ?', ['Frank']);
      const formatted = executor.formatResults(raw);

      expect(formatted.rows[0].age).toBeNull();
      expect(formatted.rows[0].score).toBeNull();
      expect(formatted.rows[0].is_active).toBeNull();
      expect(formatted.rows[0].has_premium).toBeNull();
    });

    it('should include column metadata', () => {
      const raw = db.executeQuery('SELECT * FROM test_records');
      const formatted = executor.formatResults(raw);

      expect(formatted.metadata.columns.length).toBeGreaterThan(0);

      const nameColumn = formatted.metadata.columns.find((c) => c.name === 'name');
      expect(nameColumn).toBeDefined();
      expect(nameColumn?.type).toBe('string');

      const ageColumn = formatted.metadata.columns.find((c) => c.name === 'age');
      expect(ageColumn).toBeDefined();
      expect(ageColumn?.type).toBe('integer');
    });

    it('should detect nullable columns', () => {
      // Insert a record with null score
      const recordWithNull = new RecordModel(
        { name: 'George', age: 40, score: null, is_active: true, has_premium: false },
        schema
      );
      db.insertRecords([recordWithNull], 'test_records');

      const raw = db.executeQuery('SELECT * FROM test_records');
      const formatted = executor.formatResults(raw);

      const scoreColumn = formatted.metadata.columns.find((c) => c.name === 'score');
      expect(scoreColumn?.nullable).toBe(true);

      const nameColumn = formatted.metadata.columns.find((c) => c.name === 'name');
      expect(nameColumn?.nullable).toBe(false);
    });
  });

  describe('paginate', () => {
    it('should paginate results - page 1', () => {
      const result = executor.paginate('SELECT * FROM test_records ORDER BY name', 1, 2);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.rowCount).toBe(2);
      expect(result.totalRows).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.hasMore).toBe(true);
      expect(result.hasPrevious).toBe(false);

      // First page should have Alice and Bob
      expect(result.rows[0].name).toBe('Alice');
      expect(result.rows[1].name).toBe('Bob');
    });

    it('should paginate results - page 2', () => {
      const result = executor.paginate('SELECT * FROM test_records ORDER BY name', 2, 2);

      expect(result.page).toBe(2);
      expect(result.rowCount).toBe(2);
      expect(result.hasMore).toBe(true);
      expect(result.hasPrevious).toBe(true);

      // Second page should have Charlie and Diana
      expect(result.rows[0].name).toBe('Charlie');
      expect(result.rows[1].name).toBe('Diana');
    });

    it('should paginate results - last page', () => {
      const result = executor.paginate('SELECT * FROM test_records ORDER BY name', 3, 2);

      expect(result.page).toBe(3);
      expect(result.rowCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.hasPrevious).toBe(true);

      // Last page should have Eve
      expect(result.rows[0].name).toBe('Eve');
    });

    it('should handle page size larger than total rows', () => {
      const result = executor.paginate('SELECT * FROM test_records ORDER BY name', 1, 10);

      expect(result.rowCount).toBe(5);
      expect(result.totalPages).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.hasPrevious).toBe(false);
    });

    it('should handle empty result set', () => {
      const result = executor.paginate('SELECT * FROM test_records WHERE age > 100', 1, 10);

      expect(result.rowCount).toBe(0);
      expect(result.totalRows).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should throw error for invalid page number', () => {
      expect(() => {
        executor.paginate('SELECT * FROM test_records', 0, 10);
      }).toThrow(SQLError);

      expect(() => {
        executor.paginate('SELECT * FROM test_records', -1, 10);
      }).toThrow(SQLError);
    });

    it('should throw error for invalid page size', () => {
      expect(() => {
        executor.paginate('SELECT * FROM test_records', 1, 0);
      }).toThrow(SQLError);

      expect(() => {
        executor.paginate('SELECT * FROM test_records', 1, -1);
      }).toThrow(SQLError);
    });
  });

  describe('getResultMetadata', () => {
    it('should extract metadata from results', () => {
      const result = db.executeQuery('SELECT * FROM test_records');
      const metadata = executor.getResultMetadata(result);

      expect(metadata.rowCount).toBe(5);
      expect(metadata.hasResults).toBe(true);
      expect(metadata.columns).toBeDefined();
      expect(metadata.columns.length).toBeGreaterThan(0);
    });

    it('should identify column types', () => {
      const result = db.executeQuery('SELECT * FROM test_records LIMIT 1');
      const metadata = executor.getResultMetadata(result);

      const nameCol = metadata.columns.find((c) => c.name === 'name');
      expect(nameCol?.type).toBe('string');

      const ageCol = metadata.columns.find((c) => c.name === 'age');
      expect(ageCol?.type).toBe('integer');

      const scoreCol = metadata.columns.find((c) => c.name === 'score');
      expect(scoreCol?.type).toBe('number');
    });

    it('should handle empty result set', () => {
      const result = db.executeQuery('SELECT * FROM test_records WHERE age > 100');
      const metadata = executor.getResultMetadata(result);

      expect(metadata.rowCount).toBe(0);
      expect(metadata.hasResults).toBe(false);
      expect(metadata.columns).toHaveLength(0);
    });
  });

  describe('helper methods', () => {
    describe('executeAndFormat', () => {
      it('should execute and format in one call', () => {
        const result = executor.executeAndFormat('SELECT * FROM test_records WHERE name = ?', ['Alice']);

        expect(result.rowCount).toBe(1);
        expect(result.metadata).toBeDefined();
        expect(result.rows[0].is_active).toBe(true);
      });
    });

    describe('executeWithPagination', () => {
      it('should execute with pagination', () => {
        const result = executor.executeWithPagination('SELECT * FROM test_records ORDER BY name', 1, 2);

        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(2);
        expect(result.rowCount).toBe(2);
      });
    });

    describe('executeOne', () => {
      it('should return first row', () => {
        const row = executor.executeOne('SELECT * FROM test_records WHERE name = ?', ['Alice']);

        expect(row).toBeDefined();
        expect(row?.name).toBe('Alice');
      });

      it('should return null for empty result', () => {
        const row = executor.executeOne('SELECT * FROM test_records WHERE name = ?', ['NonExistent']);

        expect(row).toBeNull();
      });
    });

    describe('hasResults', () => {
      it('should return true when query has results', () => {
        const hasResults = executor.hasResults('SELECT * FROM test_records');

        expect(hasResults).toBe(true);
      });

      it('should return false when query has no results', () => {
        const hasResults = executor.hasResults('SELECT * FROM test_records WHERE age > 100');

        expect(hasResults).toBe(false);
      });
    });

    describe('count', () => {
      it('should return count of results', () => {
        const count = executor.count('SELECT * FROM test_records');

        expect(count).toBe(5);
      });

      it('should return count with WHERE clause', () => {
        const count = executor.count('SELECT * FROM test_records WHERE age > 25');

        expect(count).toBe(3);
      });

      it('should return 0 for empty result', () => {
        const count = executor.count('SELECT * FROM test_records WHERE age > 100');

        expect(count).toBe(0);
      });
    });
  });

  describe('integration tests', () => {
    it('should handle complex query with formatting and metadata', () => {
      const result = executor.executeAndFormat(
        'SELECT * FROM test_records WHERE age > ? ORDER BY score DESC',
        [25]
      );

      expect(result.rowCount).toBe(3);
      expect(result.metadata.hasResults).toBe(true);

      // Should be ordered by score descending
      expect(result.rows[0].name).toBe('Charlie'); // 92.3
      expect(result.rows[1].name).toBe('Diana'); // 88.7
      expect(result.rows[2].name).toBe('Bob'); // 87.0

      // Booleans should be converted
      expect(typeof result.rows[0].is_active).toBe('boolean');
    });

    it('should handle pagination with formatting', () => {
      const sql = 'SELECT * FROM test_records ORDER BY name';
      const page1 = executor.executeWithPagination(sql, 1, 2);
      const page2 = executor.executeWithPagination(sql, 2, 2);

      expect(page1.rows[0].name).toBe('Alice');
      expect(page1.rows[1].name).toBe('Bob');
      expect(page2.rows[0].name).toBe('Charlie');
      expect(page2.rows[1].name).toBe('Diana');

      expect(page1.hasMore).toBe(true);
      expect(page2.hasMore).toBe(true);
    });
  });
});
