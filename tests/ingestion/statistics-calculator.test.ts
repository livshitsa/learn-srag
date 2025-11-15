/**
 * Tests for StatisticsCalculator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatisticsCalculator } from '../../src/ingestion/statistics-calculator.js';
import { DatabaseManager } from '../../src/database/database-manager.js';
import { JSONSchema } from '../../src/models/schema.js';
import { Record } from '../../src/models/record.js';
import { unlinkSync, existsSync } from 'fs';
import type { NumericStatistics, CategoricalStatistics } from '../../src/models/types.js';

describe('StatisticsCalculator', () => {
  let db: DatabaseManager;
  let calculator: StatisticsCalculator;
  const testDbPath = 'data/databases/test-stats-calculator.db';
  const tableName = 'test_hotels';

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Create database and calculator
    db = new DatabaseManager(testDbPath);
    calculator = new StatisticsCalculator(db);

    // Create test schema
    const schema = new JSONSchema({
      title: 'Hotels',
      description: 'Hotel records',
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Hotel name',
          examples: ['Grand Hotel'],
        },
        rating: {
          type: 'number',
          description: 'Guest rating',
          examples: [4.5],
        },
        stars: {
          type: 'integer',
          description: 'Star rating',
          examples: [4],
        },
        city: {
          type: 'string',
          description: 'City location',
          examples: ['New York'],
        },
        hasPool: {
          type: 'boolean',
          description: 'Has swimming pool',
          examples: [true],
        },
      },
      required: ['name', 'rating'],
    });

    // Create table
    db.createTableFromSchema(schema, tableName);

    // Insert test records
    const records = [
      new Record(
        { name: 'Hotel A', rating: 4.5, stars: 4, city: 'New York', hasPool: true },
        schema
      ),
      new Record(
        { name: 'Hotel B', rating: 3.8, stars: 3, city: 'London', hasPool: false },
        schema
      ),
      new Record(
        { name: 'Hotel C', rating: 4.2, stars: 4, city: 'Paris', hasPool: true },
        schema
      ),
      new Record(
        { name: 'Hotel D', rating: 4.9, stars: 5, city: 'Tokyo', hasPool: true },
        schema
      ),
      new Record(
        { name: 'Hotel E', rating: 3.5, stars: 3, city: 'London', hasPool: false },
        schema
      ),
    ];

    db.insertRecords(records, tableName);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('calculateStatistics', () => {
    it('should calculate statistics for all columns', () => {
      const stats = calculator.calculateStatistics(tableName);

      expect(Object.keys(stats)).toHaveLength(5);
      expect(stats.rating).toBeDefined();
      expect(stats.stars).toBeDefined();
      expect(stats.name).toBeDefined();
      expect(stats.city).toBeDefined();
      expect(stats.hasPool).toBeDefined();
    });

    it('should calculate numeric statistics correctly', () => {
      const stats = calculator.calculateStatistics(tableName);
      const ratingStats = stats.rating as NumericStatistics;

      expect(ratingStats.type).toBe('numeric');
      expect(ratingStats.min).toBe(3.5);
      expect(ratingStats.max).toBe(4.9);
      expect(ratingStats.mean).toBeCloseTo(4.18, 2);
      expect(ratingStats.count).toBe(5);
    });

    it('should calculate categorical statistics correctly', () => {
      const stats = calculator.calculateStatistics(tableName);
      const cityStats = stats.city as CategoricalStatistics;

      expect(cityStats.type).toBe('categorical');
      expect(cityStats.count).toBe(4); // New York, London, Paris, Tokyo
      expect(cityStats.uniqueValues).toContain('New York');
      expect(cityStats.uniqueValues).toContain('London');
      expect(cityStats.uniqueValues).toContain('Paris');
      expect(cityStats.uniqueValues).toContain('Tokyo');
    });
  });

  describe('getStatisticsSummary', () => {
    it('should return complete summary', () => {
      const summary = calculator.getStatisticsSummary(tableName);

      expect(summary.tableName).toBe(tableName);
      expect(summary.totalColumns).toBe(5);
      expect(summary.numericColumns).toBe(3); // rating, stars, hasPool (stored as INTEGER 0/1)
      expect(summary.categoricalColumns).toBe(2); // name, city
      expect(summary.rowCount).toBe(5);
      expect(summary.statistics).toBeDefined();
    });

    it('should count column types correctly', () => {
      const summary = calculator.getStatisticsSummary(tableName);

      expect(summary.numericColumns).toBe(3); // rating, stars, hasPool (INTEGER)
      expect(summary.categoricalColumns).toBe(2); // name, city
      expect(summary.totalColumns).toBe(summary.numericColumns + summary.categoricalColumns);
    });
  });

  describe('formatForLLM', () => {
    it('should format statistics as human-readable text', () => {
      const text = calculator.formatForLLM(tableName);

      expect(text).toContain(`Table: ${tableName} (5 rows)`);
      expect(text).toContain('Columns (5 total, 3 numeric, 2 categorical)'); // hasPool is INTEGER
      expect(text).toContain('rating (numeric)');
      expect(text).toContain('Range: 3.5 to 4.9');
      expect(text).toContain('Average: 4.18');
      expect(text).toContain('city (categorical)');
      expect(text).toContain('New York');
    });

    it('should include all columns in output', () => {
      const text = calculator.formatForLLM(tableName);

      expect(text).toContain('rating');
      expect(text).toContain('stars');
      expect(text).toContain('name');
      expect(text).toContain('city');
      expect(text).toContain('hasPool');
    });
  });

  describe('formatColumnForLLM', () => {
    it('should format numeric column correctly', () => {
      const stats = calculator.calculateStatistics(tableName);
      const text = calculator.formatColumnForLLM('rating', stats.rating);

      expect(text).toContain('rating (numeric)');
      expect(text).toContain('Range: 3.5 to 4.9');
      expect(text).toContain('Average: 4.18');
      expect(text).toContain('Count: 5 values');
    });

    it('should format categorical column with few values', () => {
      const stats = calculator.calculateStatistics(tableName);
      const text = calculator.formatColumnForLLM('city', stats.city);

      expect(text).toContain('city (categorical)');
      expect(text).toContain('Unique values (4)');
      expect(text).toContain('London');
      expect(text).toContain('New York');
      expect(text).toContain('Paris');
      expect(text).toContain('Tokyo');
    });

    it('should truncate categorical values if too many', () => {
      // Create a table with many unique values
      const schema = new JSONSchema({
        title: 'Users',
        description: 'User records',
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'User name',
            examples: ['User 1'],
          },
        },
      });

      const tableName2 = 'test_users';
      db.createTableFromSchema(schema, tableName2);

      // Insert 20 records with unique names
      const records = Array.from({ length: 20 }, (_, i) =>
        new Record({ name: `User ${i + 1}` }, schema)
      );
      db.insertRecords(records, tableName2);

      const stats = calculator.calculateStatistics(tableName2);
      const text = calculator.formatColumnForLLM('name', stats.name);

      expect(text).toContain('categorical');
      expect(text).toContain('20 total'); // Should show count
      expect(text).toContain('...'); // Should truncate
    });
  });

  describe('formatCompact', () => {
    it('should format statistics compactly', () => {
      const text = calculator.formatCompact(tableName);

      expect(text).toContain('rating: 3.5-4.9');
      expect(text).toContain('avg 4.2');
      expect(text).toContain('stars: 3-5');
    });

    it('should show categorical values if few enough', () => {
      // The hasPool field should show its values
      const text = calculator.formatCompact(tableName);

      // hasPool has only 2 unique values (0, 1 in DB), should be shown
      expect(text).toContain('hasPool:');
    });

    it('should show count for many categorical values', () => {
      const text = calculator.formatCompact(tableName);

      // name has 5 unique values, but it's displayed as a list since count <= 5
      expect(text).toContain('name:');
      // Since we have exactly 5 values, it will show them all in brackets, not count
      expect(text).toContain('Hotel A');
    });
  });

  describe('getNumericStatistics', () => {
    it('should return only numeric statistics', () => {
      const numStats = calculator.getNumericStatistics(tableName);

      expect(Object.keys(numStats)).toHaveLength(3); // rating, stars, hasPool (INTEGER)
      expect(numStats.rating).toBeDefined();
      expect(numStats.stars).toBeDefined();
      expect(numStats.hasPool).toBeDefined(); // boolean stored as INTEGER
      expect(numStats.rating.type).toBe('numeric');
      expect(numStats.stars.type).toBe('numeric');
    });

    it('should not include categorical columns', () => {
      const numStats = calculator.getNumericStatistics(tableName);

      expect(numStats.name).toBeUndefined();
      expect(numStats.city).toBeUndefined();
      // hasPool is stored as INTEGER, so it IS included in numeric stats
      expect(numStats.hasPool).toBeDefined();
    });
  });

  describe('getCategoricalStatistics', () => {
    it('should return only categorical statistics', () => {
      const catStats = calculator.getCategoricalStatistics(tableName);

      expect(Object.keys(catStats)).toHaveLength(2); // name, city (hasPool is INTEGER)
      expect(catStats.name).toBeDefined();
      expect(catStats.city).toBeDefined();
      // hasPool is stored as INTEGER, so it's NOT in categorical stats
      expect(catStats.hasPool).toBeUndefined();
      expect(catStats.name.type).toBe('categorical');
    });

    it('should not include numeric columns', () => {
      const catStats = calculator.getCategoricalStatistics(tableName);

      expect(catStats.rating).toBeUndefined();
      expect(catStats.stars).toBeUndefined();
      expect(catStats.hasPool).toBeUndefined(); // stored as INTEGER, so numeric
    });
  });

  describe('getColumnDetail', () => {
    it('should return detailed statistics for a column', () => {
      const detail = calculator.getColumnDetail(tableName, 'rating');

      expect(detail.columnName).toBe('rating');
      expect(detail.type).toBe('numeric');
      expect(detail.statistics).toBeDefined();
      expect(detail.summary).toContain('rating (numeric)');
      expect(detail.warnings).toBeInstanceOf(Array);
    });

    it('should throw error for non-existent column', () => {
      expect(() => {
        calculator.getColumnDetail(tableName, 'nonexistent');
      }).toThrow('Column nonexistent not found');
    });
  });

  describe('detectWarnings', () => {
    it('should detect no warnings for normal data', () => {
      const stats = calculator.calculateStatistics(tableName);
      const warnings = calculator.detectWarnings('rating', stats.rating, tableName);

      expect(warnings).toHaveLength(0);
    });

    it('should detect identical values', () => {
      // Create table with identical values
      const schema = new JSONSchema({
        title: 'Test',
        description: 'Test',
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Value', examples: [5.0] },
        },
      });

      const tableName2 = 'test_identical';
      db.createTableFromSchema(schema, tableName2);

      const records = [
        new Record({ value: 5.0 }, schema),
        new Record({ value: 5.0 }, schema),
        new Record({ value: 5.0 }, schema),
      ];
      db.insertRecords(records, tableName2);

      const stats = calculator.calculateStatistics(tableName2);
      const warnings = calculator.detectWarnings('value', stats.value, tableName2);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('All values are identical'))).toBe(true);
    });

    it('should detect single unique categorical value', () => {
      // Create table with single unique value
      const schema = new JSONSchema({
        title: 'Test',
        description: 'Test',
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status', examples: ['active'] },
        },
      });

      const tableName2 = 'test_single';
      db.createTableFromSchema(schema, tableName2);

      const records = [
        new Record({ status: 'active' }, schema),
        new Record({ status: 'active' }, schema),
        new Record({ status: 'active' }, schema),
      ];
      db.insertRecords(records, tableName2);

      const stats = calculator.calculateStatistics(tableName2);
      const warnings = calculator.detectWarnings('status', stats.status, tableName2);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('Only one unique value'))).toBe(true);
    });

    it('should detect high cardinality categorical column', () => {
      // Create table with many unique values (like an ID)
      const schema = new JSONSchema({
        title: 'Test',
        description: 'Test',
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID', examples: ['user-1'] },
        },
      });

      const tableName2 = 'test_highcard';
      db.createTableFromSchema(schema, tableName2);

      // Insert 100 records with unique IDs
      const records = Array.from({ length: 100 }, (_, i) =>
        new Record({ userId: `user-${i}` }, schema)
      );
      db.insertRecords(records, tableName2);

      const stats = calculator.calculateStatistics(tableName2);
      const warnings = calculator.detectWarnings('userId', stats.userId, tableName2);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('high cardinality'))).toBe(true);
    });

    it('should detect very few unique values in large dataset', () => {
      // Create large table with only 2 unique values
      const schema = new JSONSchema({
        title: 'Test',
        description: 'Test',
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Status', examples: ['active'] },
        },
      });

      const tableName2 = 'test_fewvalues';
      db.createTableFromSchema(schema, tableName2);

      // Insert 150 records with only 2 unique values
      const records = Array.from({ length: 150 }, (_, i) =>
        new Record({ status: i % 2 === 0 ? 'active' : 'inactive' }, schema)
      );
      db.insertRecords(records, tableName2);

      const stats = calculator.calculateStatistics(tableName2);
      const warnings = calculator.detectWarnings('status', stats.status, tableName2);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes('Very few unique values'))).toBe(true);
    });
  });

  describe('suggestColumnName', () => {
    it('should convert spaces to underscores', () => {
      expect(calculator.suggestColumnName('User Name')).toBe('user_name');
    });

    it('should convert to lowercase', () => {
      expect(calculator.suggestColumnName('UserName')).toBe('username');
    });

    it('should remove special characters', () => {
      expect(calculator.suggestColumnName('User@Name#123')).toBe('username123');
    });

    it('should remove multiple consecutive underscores', () => {
      expect(calculator.suggestColumnName('User   Name')).toBe('user_name');
    });

    it('should remove leading/trailing underscores', () => {
      expect(calculator.suggestColumnName('  User Name  ')).toBe('user_name');
    });

    it('should handle already valid names', () => {
      expect(calculator.suggestColumnName('user_name')).toBe('user_name');
    });
  });

  describe('formatAsJSON', () => {
    it('should return statistics as JSON object', () => {
      const json = calculator.formatAsJSON(tableName);

      expect(json.tableName).toBe(tableName);
      expect(json.totalColumns).toBe(5);
      expect(json.rowCount).toBe(5);
      expect(json.statistics).toBeDefined();
    });

    it('should be serializable', () => {
      const json = calculator.formatAsJSON(tableName);
      const serialized = JSON.stringify(json);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.tableName).toBe(tableName);
      expect(deserialized.totalColumns).toBe(5);
    });
  });

  describe('analyzeDistribution', () => {
    it('should analyze numeric distribution', () => {
      const dist = calculator.analyzeDistribution(tableName, 'rating');

      expect(dist.range).toBeCloseTo(1.4, 1);
      expect(dist.midpoint).toBeCloseTo(4.2, 1);
      expect(dist.spread).toBeCloseTo(0.7, 1);
      expect(dist.description).toBeDefined();
    });

    it('should detect centered distribution', () => {
      const dist = calculator.analyzeDistribution(tableName, 'rating');

      // Mean is 4.18, midpoint is 4.2, very close
      expect(dist.description).toContain('centered');
    });

    it('should throw error for non-numeric column', () => {
      expect(() => {
        calculator.analyzeDistribution(tableName, 'name');
      }).toThrow('not numeric');
    });

    it('should throw error for non-existent column', () => {
      expect(() => {
        calculator.analyzeDistribution(tableName, 'nonexistent');
      }).toThrow('not numeric');
    });
  });

  describe('getDebugSummary', () => {
    it('should create debug summary', () => {
      const summary = calculator.getDebugSummary(tableName);

      expect(summary).toContain(`=== ${tableName} Statistics ===`);
      expect(summary).toContain('Rows: 5');
      expect(summary).toContain('Columns: 5');
      expect(summary).toContain('Numeric: 3'); // rating, stars, hasPool (INTEGER)
      expect(summary).toContain('Categorical: 2'); // name, city
    });

    it('should include warnings if present', () => {
      // Create table with warning-triggering data
      const schema = new JSONSchema({
        title: 'Test',
        description: 'Test',
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Value', examples: [5.0] },
        },
      });

      const tableName2 = 'test_warnings';
      db.createTableFromSchema(schema, tableName2);

      const records = [
        new Record({ value: 5.0 }, schema),
        new Record({ value: 5.0 }, schema),
        new Record({ value: 5.0 }, schema),
      ];
      db.insertRecords(records, tableName2);

      const summary = calculator.getDebugSummary(tableName2);

      expect(summary).toContain('Warnings');
      expect(summary).toContain('value');
    });
  });

  describe('integration with DatabaseManager', () => {
    it('should work with existing DatabaseManager instance', () => {
      const stats = calculator.calculateStatistics(tableName);

      expect(stats).toBeDefined();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });

    it('should reflect changes in database', () => {
      const before = calculator.getStatisticsSummary(tableName);
      expect(before.rowCount).toBe(5);

      // Add more records
      const schema = new JSONSchema({
        title: 'Hotels',
        description: 'Hotel records',
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Hotel name', examples: ['Hotel F'] },
          rating: { type: 'number', description: 'Guest rating', examples: [4.0] },
          stars: { type: 'integer', description: 'Star rating', examples: [4] },
          city: { type: 'string', description: 'City', examples: ['Berlin'] },
          hasPool: { type: 'boolean', description: 'Has pool', examples: [true] },
        },
      });

      const newRecords = [
        new Record(
          { name: 'Hotel F', rating: 5.0, stars: 5, city: 'Berlin', hasPool: true },
          schema
        ),
      ];
      db.insertRecords(newRecords, tableName);

      const after = calculator.getStatisticsSummary(tableName);
      expect(after.rowCount).toBe(6);

      // Rating stats should update
      const stats = calculator.calculateStatistics(tableName);
      const ratingStats = stats.rating as NumericStatistics;
      expect(ratingStats.max).toBe(5.0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty table', () => {
      const schema = new JSONSchema({
        title: 'Empty',
        description: 'Empty table',
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Value', examples: [1.0] },
        },
      });

      const emptyTable = 'test_empty';
      db.createTableFromSchema(schema, emptyTable);

      const summary = calculator.getStatisticsSummary(emptyTable);
      expect(summary.rowCount).toBe(0);
    });

    it('should handle single row table', () => {
      const schema = new JSONSchema({
        title: 'Single',
        description: 'Single row',
        type: 'object',
        properties: {
          value: { type: 'number', description: 'Value', examples: [1.0] },
        },
      });

      const singleTable = 'test_single_row';
      db.createTableFromSchema(schema, singleTable);

      const records = [new Record({ value: 42.0 }, schema)];
      db.insertRecords(records, singleTable);

      const stats = calculator.calculateStatistics(singleTable);
      const valueStats = stats.value as NumericStatistics;

      expect(valueStats.min).toBe(42.0);
      expect(valueStats.max).toBe(42.0);
      expect(valueStats.mean).toBe(42.0);
      expect(valueStats.count).toBe(1);
    });
  });
});
