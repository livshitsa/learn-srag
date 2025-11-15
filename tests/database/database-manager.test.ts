/**
 * DatabaseManager Tests
 *
 * Comprehensive tests for database operations including:
 * - Table creation from schemas
 * - Record insertion and retrieval
 * - Statistics calculation
 * - Query execution
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { JSONSchema } from '../../src/models/schema.js';
import { Record } from '../../src/models/record.js';
import { DatabaseError, SQLError } from '../../src/models/types.js';
import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  const testDbPath = 'data/test-databases/test.db';
  const testDbDir = 'data/test-databases';

  // Create test schema
  const createTestSchema = (): JSONSchema => {
    return new JSONSchema({
      title: 'TestRecords',
      description: 'Test schema for database operations',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name field',
          examples: ['John Doe'],
        },
        age: {
          type: 'integer',
          description: 'Age in years',
          examples: [25],
        },
        salary: {
          type: 'number',
          description: 'Annual salary',
          examples: [50000.5],
        },
        active: {
          type: 'boolean',
          description: 'Is active',
          examples: [true],
        },
      },
      required: ['name'],
    });
  };

  beforeEach(() => {
    // Ensure test directory exists
    if (!existsSync(testDbDir)) {
      mkdirSync(testDbDir, { recursive: true });
    }

    // Remove test database if it exists
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Create new database
    db = new DatabaseManager(testDbPath);
  });

  afterEach(() => {
    // Close database
    if (db && db.isDbOpen()) {
      db.close();
    }

    // Clean up test database
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  describe('Constructor', () => {
    it('should create database file', () => {
      expect(existsSync(testDbPath)).toBe(true);
    });

    it('should open database successfully', () => {
      expect(db.isDbOpen()).toBe(true);
    });

    it('should create directory if it does not exist', () => {
      const newPath = 'data/new-test-dir/test.db';
      const newDb = new DatabaseManager(newPath);
      expect(existsSync(newPath)).toBe(true);
      newDb.close();
      unlinkSync(newPath);
    });
  });

  describe('createTableFromSchema', () => {
    it('should create table from schema', () => {
      const schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      expect(db.tableExists('test_table')).toBe(true);
    });

    it('should create table with correct columns', () => {
      const schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      // Query to check columns exist
      const result = db.executeQuery(`
        SELECT name, age, salary, active
        FROM test_table
        LIMIT 0
      `);

      expect(result).toBeDefined();
    });

    it('should handle multiple schemas', () => {
      const schema1 = createTestSchema();
      const schema2 = new JSONSchema({
        title: 'AnotherSchema',
        description: 'Another test schema',
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'ID', examples: [1] },
          value: { type: 'string', description: 'Value', examples: ['test'] },
        },
      });

      db.createTableFromSchema(schema1, 'table1');
      db.createTableFromSchema(schema2, 'table2');

      expect(db.tableExists('table1')).toBe(true);
      expect(db.tableExists('table2')).toBe(true);
    });

    it('should throw error for invalid table name', () => {
      const schema = createTestSchema();

      expect(() => {
        db.createTableFromSchema(schema, 'invalid-table-name');
      }).toThrow(DatabaseError);

      expect(() => {
        db.createTableFromSchema(schema, '123table');
      }).toThrow(DatabaseError);

      expect(() => {
        db.createTableFromSchema(schema, 'table; DROP TABLE users;');
      }).toThrow(DatabaseError);
    });
  });

  describe('insertRecords', () => {
    let schema: JSONSchema;

    beforeEach(() => {
      schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');
    });

    it('should insert single record', () => {
      const record = new Record(
        {
          name: 'John Doe',
          age: 30,
          salary: 50000.5,
          active: true,
        },
        schema
      );

      db.insertRecords([record], 'test_table');

      const result = db.executeQuery('SELECT * FROM test_table');
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].age).toBe(30);
      expect(result.rows[0].salary).toBe(50000.5);
      expect(result.rows[0].active).toBe(1); // Boolean stored as integer
    });

    it('should insert multiple records', () => {
      const records = [
        new Record(
          { name: 'Alice', age: 25, salary: 45000, active: true },
          schema
        ),
        new Record(
          { name: 'Bob', age: 35, salary: 60000, active: false },
          schema
        ),
        new Record(
          { name: 'Charlie', age: 28, salary: 55000, active: true },
          schema
        ),
      ];

      db.insertRecords(records, 'test_table');

      const result = db.executeQuery('SELECT * FROM test_table');
      expect(result.rowCount).toBe(3);
    });

    it('should handle empty array', () => {
      db.insertRecords([], 'test_table');

      const result = db.executeQuery('SELECT * FROM test_table');
      expect(result.rowCount).toBe(0);
    });

    it('should handle null values', () => {
      const record = new Record(
        {
          name: 'John Doe',
          age: null,
          salary: null,
          active: null,
        },
        schema,
        false
      );

      db.insertRecords([record], 'test_table');

      const result = db.executeQuery('SELECT * FROM test_table');
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('John Doe');
      expect(result.rows[0].age).toBeNull();
    });

    it('should use transactions for batch insert', () => {
      // Create many records
      const records = Array.from({ length: 100 }, (_, i) =>
        new Record(
          {
            name: `Person ${i}`,
            age: 20 + i,
            salary: 40000 + i * 1000,
            active: i % 2 === 0,
          },
          schema
        )
      );

      db.insertRecords(records, 'test_table');

      const result = db.executeQuery('SELECT COUNT(*) as count FROM test_table');
      expect(result.rows[0].count).toBe(100);
    });
  });

  describe('executeQuery', () => {
    let schema: JSONSchema;

    beforeEach(() => {
      schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      // Insert test data
      const records = [
        new Record(
          { name: 'Alice', age: 25, salary: 45000, active: true },
          schema
        ),
        new Record(
          { name: 'Bob', age: 35, salary: 60000, active: false },
          schema
        ),
        new Record(
          { name: 'Charlie', age: 28, salary: 55000, active: true },
          schema
        ),
      ];

      db.insertRecords(records, 'test_table');
    });

    it('should execute simple SELECT query', () => {
      const result = db.executeQuery('SELECT * FROM test_table');

      expect(result.rowCount).toBe(3);
      expect(result.rows.length).toBe(3);
      expect(result.sql).toContain('SELECT');
    });

    it('should execute query with WHERE clause', () => {
      const result = db.executeQuery('SELECT * FROM test_table WHERE age > 30');

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('Bob');
    });

    it('should execute query with aggregation', () => {
      const result = db.executeQuery(
        'SELECT AVG(salary) as avg_salary FROM test_table'
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].avg_salary).toBeCloseTo(53333.33, 2);
    });

    it('should execute query with ORDER BY', () => {
      const result = db.executeQuery('SELECT * FROM test_table ORDER BY age ASC');

      expect(result.rows[0].name).toBe('Alice');
      expect(result.rows[1].name).toBe('Charlie');
      expect(result.rows[2].name).toBe('Bob');
    });

    it('should execute query with LIMIT', () => {
      const result = db.executeQuery('SELECT * FROM test_table LIMIT 2');

      expect(result.rowCount).toBe(2);
    });

    it('should throw error for non-SELECT query', () => {
      expect(() => {
        db.executeQuery('INSERT INTO test_table (name, age) VALUES ("Dave", 40)');
      }).toThrow(SQLError);

      expect(() => {
        db.executeQuery('UPDATE test_table SET age = 40 WHERE name = "Alice"');
      }).toThrow(SQLError);

      expect(() => {
        db.executeQuery('DELETE FROM test_table WHERE name = "Alice"');
      }).toThrow(SQLError);

      expect(() => {
        db.executeQuery('DROP TABLE test_table');
      }).toThrow(SQLError);
    });

    it('should handle parameterized queries', () => {
      const result = db.executeQuery(
        'SELECT * FROM test_table WHERE age > ?',
        [30]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].name).toBe('Bob');
    });
  });

  describe('getColumnStatistics', () => {
    let schema: JSONSchema;

    beforeEach(() => {
      schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      // Insert test data with varied values
      const records = [
        new Record(
          { name: 'Alice', age: 25, salary: 45000, active: true },
          schema
        ),
        new Record(
          { name: 'Bob', age: 35, salary: 60000, active: false },
          schema
        ),
        new Record(
          { name: 'Charlie', age: 28, salary: 55000, active: true },
          schema
        ),
        new Record(
          { name: 'David', age: 42, salary: 75000, active: true },
          schema
        ),
        new Record(
          { name: 'Eve', age: 30, salary: 50000, active: false },
          schema
        ),
      ];

      db.insertRecords(records, 'test_table');
    });

    it('should calculate numeric statistics correctly', () => {
      const stats = db.getColumnStatistics('test_table');

      expect(stats.age).toBeDefined();
      expect(stats.age.type).toBe('numeric');

      const ageStats = stats.age as any;
      expect(ageStats.min).toBe(25);
      expect(ageStats.max).toBe(42);
      expect(ageStats.mean).toBeCloseTo(32, 0);
      expect(ageStats.count).toBe(5);
    });

    it('should calculate statistics for decimal numbers', () => {
      const stats = db.getColumnStatistics('test_table');

      expect(stats.salary).toBeDefined();
      expect(stats.salary.type).toBe('numeric');

      const salaryStats = stats.salary as any;
      expect(salaryStats.min).toBe(45000);
      expect(salaryStats.max).toBe(75000);
      expect(salaryStats.mean).toBeCloseTo(57000, 0);
      expect(salaryStats.count).toBe(5);
    });

    it('should calculate categorical statistics correctly', () => {
      const stats = db.getColumnStatistics('test_table');

      expect(stats.name).toBeDefined();
      expect(stats.name.type).toBe('categorical');

      const nameStats = stats.name as any;
      expect(nameStats.uniqueValues).toContain('Alice');
      expect(nameStats.uniqueValues).toContain('Bob');
      expect(nameStats.count).toBe(5);
    });

    it('should not include id column in statistics', () => {
      const stats = db.getColumnStatistics('test_table');

      expect(stats.id).toBeUndefined();
    });

    it('should handle table with no data', () => {
      db.createTableFromSchema(schema, 'empty_table');
      const stats = db.getColumnStatistics('empty_table');

      expect(stats.age).toBeDefined();
      const ageStats = stats.age as any;
      expect(ageStats.count).toBe(0);
    });
  });

  describe('getRowCount', () => {
    let schema: JSONSchema;

    beforeEach(() => {
      schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');
    });

    it('should return 0 for empty table', () => {
      const count = db.getRowCount('test_table');
      expect(count).toBe(0);
    });

    it('should return correct count after inserting records', () => {
      const records = Array.from({ length: 10 }, (_, i) =>
        new Record(
          {
            name: `Person ${i}`,
            age: 20 + i,
            salary: 40000,
            active: true,
          },
          schema
        )
      );

      db.insertRecords(records, 'test_table');

      const count = db.getRowCount('test_table');
      expect(count).toBe(10);
    });
  });

  describe('tableExists', () => {
    it('should return false for non-existent table', () => {
      expect(db.tableExists('nonexistent_table')).toBe(false);
    });

    it('should return true for existing table', () => {
      const schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      expect(db.tableExists('test_table')).toBe(true);
    });
  });

  describe('dropTable', () => {
    it('should drop existing table', () => {
      const schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      expect(db.tableExists('test_table')).toBe(true);

      db.dropTable('test_table');

      expect(db.tableExists('test_table')).toBe(false);
    });

    it('should not throw error when dropping non-existent table', () => {
      expect(() => {
        db.dropTable('nonexistent_table');
      }).not.toThrow();
    });

    it('should throw error for invalid table name', () => {
      expect(() => {
        db.dropTable('invalid-name');
      }).toThrow(SQLError);
    });
  });

  describe('close', () => {
    it('should close database successfully', () => {
      expect(db.isDbOpen()).toBe(true);

      db.close();

      expect(db.isDbOpen()).toBe(false);
    });

    it('should throw error when operating on closed database', () => {
      db.close();

      expect(() => {
        db.executeQuery('SELECT * FROM test_table');
      }).toThrow(DatabaseError);
    });

    it('should not throw error when closing already closed database', () => {
      db.close();

      expect(() => {
        db.close();
      }).not.toThrow();
    });
  });

  describe('getPath', () => {
    it('should return database path', () => {
      const path = db.getPath();
      expect(path).toContain('test.db');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in table names', () => {
      const schema = createTestSchema();

      expect(() => {
        db.createTableFromSchema(schema, "test'; DROP TABLE users; --");
      }).toThrow();
    });

    it('should prevent SQL injection in queries', () => {
      const schema = createTestSchema();
      db.createTableFromSchema(schema, 'test_table');

      expect(() => {
        db.executeQuery("SELECT * FROM test_table; DROP TABLE test_table; --");
      }).toThrow(SQLError);
    });
  });

  describe('Type Mapping', () => {
    it('should map string to TEXT', () => {
      const schema = new JSONSchema({
        title: 'TypeTest',
        description: 'Test type mapping',
        type: 'object',
        properties: {
          text_field: {
            type: 'string',
            description: 'Text field',
            examples: ['test'],
          },
        },
      });

      db.createTableFromSchema(schema, 'type_test');

      const record = new Record({ text_field: 'Hello World' }, schema);
      db.insertRecords([record], 'type_test');

      const result = db.executeQuery('SELECT * FROM type_test');
      expect(typeof result.rows[0].text_field).toBe('string');
    });

    it('should map integer to INTEGER', () => {
      const schema = new JSONSchema({
        title: 'TypeTest',
        description: 'Test type mapping',
        type: 'object',
        properties: {
          int_field: {
            type: 'integer',
            description: 'Integer field',
            examples: [42],
          },
        },
      });

      db.createTableFromSchema(schema, 'type_test');

      const record = new Record({ int_field: 42 }, schema);
      db.insertRecords([record], 'type_test');

      const result = db.executeQuery('SELECT * FROM type_test');
      expect(result.rows[0].int_field).toBe(42);
      expect(Number.isInteger(result.rows[0].int_field)).toBe(true);
    });

    it('should map number to REAL', () => {
      const schema = new JSONSchema({
        title: 'TypeTest',
        description: 'Test type mapping',
        type: 'object',
        properties: {
          num_field: {
            type: 'number',
            description: 'Number field',
            examples: [3.14],
          },
        },
      });

      db.createTableFromSchema(schema, 'type_test');

      const record = new Record({ num_field: 3.14159 }, schema);
      db.insertRecords([record], 'type_test');

      const result = db.executeQuery('SELECT * FROM type_test');
      expect(result.rows[0].num_field).toBeCloseTo(3.14159, 5);
    });

    it('should map boolean to INTEGER (0/1)', () => {
      const schema = new JSONSchema({
        title: 'TypeTest',
        description: 'Test type mapping',
        type: 'object',
        properties: {
          bool_field: {
            type: 'boolean',
            description: 'Boolean field',
            examples: [true],
          },
        },
      });

      db.createTableFromSchema(schema, 'type_test');

      const record1 = new Record({ bool_field: true }, schema);
      const record2 = new Record({ bool_field: false }, schema);

      db.insertRecords([record1, record2], 'type_test');

      const result = db.executeQuery('SELECT * FROM type_test');
      expect(result.rows[0].bool_field).toBe(1);
      expect(result.rows[1].bool_field).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in data', () => {
      const schema = new JSONSchema({
        title: 'SpecialChars',
        description: 'Test special characters',
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text with special chars',
            examples: ["test's"],
          },
        },
      });

      db.createTableFromSchema(schema, 'special_test');

      const record = new Record(
        { text: "It's a test with 'quotes' and \"double quotes\"" },
        schema
      );

      db.insertRecords([record], 'special_test');

      const result = db.executeQuery('SELECT * FROM special_test');
      expect(result.rows[0].text).toContain("It's a test");
    });

    it('should handle very large numbers', () => {
      const schema = new JSONSchema({
        title: 'LargeNumbers',
        description: 'Test large numbers',
        type: 'object',
        properties: {
          big_num: {
            type: 'integer',
            description: 'Large number',
            examples: [1000000],
          },
        },
      });

      db.createTableFromSchema(schema, 'large_test');

      const record = new Record({ big_num: 9999999999 }, schema);
      db.insertRecords([record], 'large_test');

      const result = db.executeQuery('SELECT * FROM large_test');
      expect(result.rows[0].big_num).toBe(9999999999);
    });

    it('should handle unicode characters', () => {
      const schema = new JSONSchema({
        title: 'Unicode',
        description: 'Test unicode',
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Unicode text',
            examples: ['测试'],
          },
        },
      });

      db.createTableFromSchema(schema, 'unicode_test');

      const record = new Record(
        { text: '你好世界 Hello World 🌍' },
        schema
      );

      db.insertRecords([record], 'unicode_test');

      const result = db.executeQuery('SELECT * FROM unicode_test');
      expect(result.rows[0].text).toBe('你好世界 Hello World 🌍');
    });
  });
});
