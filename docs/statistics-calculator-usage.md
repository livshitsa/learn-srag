# StatisticsCalculator Usage Guide

The `StatisticsCalculator` class provides utilities for calculating and formatting column statistics for use in LLM prompts and data analysis.

## Overview

The StatisticsCalculator wraps `DatabaseManager.getColumnStatistics()` and adds helper methods for:
- Formatting statistics for LLM prompts
- Filtering statistics by type (numeric/categorical)
- Detecting data quality issues
- Analyzing value distributions

## Basic Usage

```typescript
import { DatabaseManager } from './database/database-manager.js';
import { StatisticsCalculator } from './ingestion/statistics-calculator.js';

// Create database and calculator
const db = new DatabaseManager('data/databases/my-db.db');
const calculator = new StatisticsCalculator(db);

// Calculate statistics
const stats = calculator.calculateStatistics('hotels');
console.log(stats);
// {
//   rating: { type: 'numeric', min: 3.5, max: 5.0, mean: 4.2, count: 100 },
//   city: { type: 'categorical', uniqueValues: ['NYC', 'LA', ...], count: 10 }
// }
```

## Formatting for LLM Prompts

### Human-Readable Format

```typescript
const text = calculator.formatForLLM('hotels');
console.log(text);
// Output:
// Table: hotels (150 rows)
//
// Columns (5 total, 2 numeric, 3 categorical):
//
// rating (numeric):
//   - Range: 3.5 to 5.0
//   - Average: 4.20
//   - Count: 150 values
//
// city (categorical):
//   - Unique values (10): New York, London, Paris, ...
```

### Compact Format for Text-to-SQL

```typescript
const compact = calculator.formatCompact('hotels');
console.log(compact);
// Output: "rating: 3.5-5.0 (avg 4.2), stars: 1-5 (avg 3.8), city: 10 unique values"
```

## Filtering by Type

```typescript
// Get only numeric statistics
const numStats = calculator.getNumericStatistics('hotels');
console.log(numStats.rating.mean); // 4.2

// Get only categorical statistics
const catStats = calculator.getCategoricalStatistics('hotels');
console.log(catStats.city.uniqueValues); // ['NYC', 'LA', ...]
```

## Data Quality Analysis

### Detect Warnings

```typescript
const detail = calculator.getColumnDetail('hotels', 'rating');
console.log(detail.warnings);
// Might return:
// - "Only 50 out of 100 rows have values (50.0% coverage)"
// - "All values are identical (4.2)"
// - "Large range detected (0 to 1000000), potential outliers"
```

### Analyze Distribution

```typescript
const dist = calculator.analyzeDistribution('hotels', 'rating');
console.log(dist);
// {
//   range: 1.5,
//   midpoint: 4.25,
//   spread: 0.75,
//   description: 'Approximately centered'
// }
```

## Debug Summary

```typescript
const summary = calculator.getDebugSummary('hotels');
console.log(summary);
// Output:
// === hotels Statistics ===
// Rows: 150
// Columns: 5
//   - Numeric: 2
//   - Categorical: 3
//
// Warnings for rating:
//   - Only 100 out of 150 rows have values (66.7% coverage)
```

## API Response Format

```typescript
const json = calculator.formatAsJSON('hotels');
// Returns StatisticsSummary interface for API responses
```

## Important Notes

### Boolean Handling

Booleans are stored as INTEGER (0/1) in SQLite, so they appear as numeric statistics:

```typescript
// Schema: hasPool (boolean)
// Database: hasPool INTEGER (0 or 1)
// Statistics: { type: 'numeric', min: 0, max: 1, mean: 0.6, count: 100 }
```

### Categorical Value Limits

For categorical columns, only the first 100 unique values are returned to avoid memory issues with high-cardinality columns.

## Integration with Text-to-SQL

Use `formatForLLM()` to include statistics in your text-to-sql prompts:

```typescript
const stats = calculator.formatForLLM(tableName);
const prompt = `
Given this table:

${schemaText}

Statistics:
${stats}

Translate this question to SQL: "${question}"
`;
```

## Complete Example

```typescript
import { DatabaseManager } from './database/database-manager.js';
import { StatisticsCalculator } from './ingestion/statistics-calculator.js';
import { JSONSchema } from './models/schema.js';
import { Record } from './models/record.js';

// Create database
const db = new DatabaseManager('data/databases/hotels.db');

// Create schema
const schema = new JSONSchema({
  title: 'Hotels',
  description: 'Hotel records',
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Hotel name', examples: ['Grand Hotel'] },
    rating: { type: 'number', description: 'Guest rating', examples: [4.5] },
    city: { type: 'string', description: 'City', examples: ['New York'] }
  }
});

// Create table and insert records
db.createTableFromSchema(schema, 'hotels');
const records = [
  new Record({ name: 'Hotel A', rating: 4.5, city: 'New York' }, schema),
  new Record({ name: 'Hotel B', rating: 3.8, city: 'London' }, schema),
  // ... more records
];
db.insertRecords(records, 'hotels');

// Calculate and format statistics
const calculator = new StatisticsCalculator(db);

// For LLM prompts
console.log(calculator.formatForLLM('hotels'));

// For debugging
console.log(calculator.getDebugSummary('hotels'));

// For analysis
const ratingDetail = calculator.getColumnDetail('hotels', 'rating');
console.log('Rating warnings:', ratingDetail.warnings);

// Clean up
db.close();
```
