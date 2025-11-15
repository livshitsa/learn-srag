# S-RAG Implementation Plan - MVP Level (TypeScript/Node.js)

**Based on:** "Structured RAG for Answering Aggregative Questions" (arXiv:2511.08505v1)
**Date:** 2025-11-15
**Target:** MVP implementation in 8 weeks
**Language:** TypeScript/Node.js

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Concepts](#core-concepts)
3. [System Architecture](#system-architecture)
4. [MVP Implementation Phases](#mvp-implementation-phases)
5. [Technical Specification](#technical-specification)
6. [Project Structure](#project-structure)
7. [Technology Stack](#technology-stack)
8. [Success Criteria](#success-criteria)
9. [Next Steps](#next-steps)

---

## Executive Summary

### Problem Statement

Traditional RAG systems struggle with **aggregative queries** - questions requiring:
- Information from dozens or hundreds of documents
- Complex filtering (e.g., "before 2020", "greater than 200kg")
- Aggregation operations (average, count, max, etc.)
- Reasoning across multiple attributes

**Example Query:** *"What is the average ARR for South American companies with more than 1,000 employees?"*

### Solution: S-RAG

**Key Innovation:** Transform unstructured documents into structured database at ingestion time, then translate natural language queries to SQL at inference time.

**Performance Gains:**
- 50-60% improvement over traditional RAG on novel datasets
- 10-20% improvement on familiar datasets
- Handles completeness (retrieves all needed documents)
- Overcomes context window limitations

---

## Core Concepts

### 1. Aggregative Questions

Queries requiring:
- Large-scale retrieval across many documents
- Numerical aggregation (sum, avg, count, min, max)
- Complex filtering and constraints
- Multi-attribute reasoning

### 2. Schema-Based Approach

**Assumption:** Documents in corpus share recurring attributes (schema)

**Example:**
- Corpus: CVs of job candidates
- Schema: name, years_of_education, email, years_of_experience, location

### 3. Two-Phase Architecture

**Ingestion (Offline):**
1. Predict schema from sample docs + questions
2. Extract structured records from all documents
3. Store in SQL database with statistics

**Inference (Online):**
1. Translate natural language query to SQL
2. Execute query on database
3. Generate natural language answer

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      INGESTION PHASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Sample Docs (12) + Questions (10)                           │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────┐                                     │
│  │ Schema Prediction   │  (LLM - 4 iterations)               │
│  │  - Generate schema  │                                     │
│  │  - Refine schema    │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  JSON Schema (attributes, types, descriptions, examples)     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │ Record Extraction   │  (LLM)                              │
│  │  - Extract values   │                                     │
│  │  - Validate types   │                                     │
│  │  - Standardize      │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  SQL Database       │                                     │
│  │  - All records      │                                     │
│  │  - Column stats     │                                     │
│  └─────────────────────┘                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      INFERENCE PHASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Natural Language Query                                      │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────┐                                     │
│  │  Text-to-SQL        │  (LLM + Schema + Statistics)        │
│  │  - Parse query      │                                     │
│  │  - Generate SQL     │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  Query Executor     │                                     │
│  │  - Run SQL          │                                     │
│  │  - Get results      │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  Answer Generator   │  (LLM)                              │
│  │  - Format results   │                                     │
│  │  - Generate answer  │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  Natural Language Answer                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## MVP Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up core infrastructure and dependencies

**Tasks:**
- [ ] Project setup (repo, dependencies, TypeScript configuration)
- [ ] LLM client wrapper (OpenAI, Anthropic APIs)
- [ ] Database manager (SQLite with better-sqlite3)
- [ ] Configuration management
- [ ] Logging and error handling

**Deliverables:**
- `llm-client.ts` - Unified LLM API wrapper
- `database-manager.ts` - SQL database operations
- `config.ts` - Configuration management
- `package.json` - Dependencies
- Basic project structure

**Estimated Effort:** 40 hours

---

### Phase 2: Ingestion Pipeline (Weeks 3-4)

**Goal:** Implement schema prediction and record extraction

#### 2.1 Schema Prediction (Week 3)

**Tasks:**
- [ ] Implement iterative schema generation
- [ ] Create prompt templates (first iteration, refinement)
- [ ] Schema validation and JSON Schema compliance
- [ ] Schema storage and versioning

**Components:**
- `schema-predictor.ts`
- `prompts/schema-generation.txt`
- `prompts/schema-refinement.txt`

**Key Features:**
- 4 iterations of refinement
- Support for primitive types (string, number, integer, boolean)
- Attribute descriptions and examples
- Schema versioning

#### 2.2 Record Extraction (Week 4)

**Tasks:**
- [ ] Document-to-record extraction using LLM
- [ ] Type validation and coercion
- [ ] Value standardization (e.g., "1M" → 1000000)
- [ ] Batch processing for multiple documents
- [ ] Statistics calculation (min, max, mean, unique values)

**Components:**
- `record-extractor.ts`
- `statistics-calculator.ts`
- `prompts/record-extraction.txt`

**Key Features:**
- Batch processing with configurable batch size
- Type validation against schema
- Standardization rules
- Null/missing value handling
- Column statistics for inference

**Estimated Effort:** 60 hours

---

### Phase 3: Inference Pipeline (Weeks 5-6)

**Goal:** Implement query translation and answer generation

#### 3.1 Text-to-SQL (Week 5)

**Tasks:**
- [ ] Natural language to SQL translation
- [ ] Prompt engineering with schema and statistics
- [ ] SQL validation and sanitization
- [ ] Error handling and retry logic

**Components:**
- `text-to-sql.ts`
- `prompts/text-to-sql.txt`

**Key Features:**
- Include column statistics in prompt
- Support WHERE, GROUP BY, HAVING, ORDER BY
- SQL injection prevention
- Query validation before execution

#### 3.2 Query Execution & Answer Generation (Week 6)

**Tasks:**
- [ ] Safe SQL execution
- [ ] Result formatting
- [ ] Answer generation from SQL results
- [ ] Context preparation for LLM

**Components:**
- `query-executor.ts`
- `answer-generator.ts`
- `prompts/answer-generation.txt`

**Key Features:**
- Parameterized queries
- Result pagination
- Natural language answer generation
- Citation of SQL query in response

**Estimated Effort:** 60 hours

---

### Phase 4: Evaluation & Testing (Week 7)

**Goal:** Implement evaluation metrics and testing framework

**Tasks:**
- [ ] LLM-as-judge for answer comparison
- [ ] Answer recall metric
- [ ] Test dataset support (HOTELS, WORLD CUP format)
- [ ] Benchmark scripts
- [ ] Unit tests for all modules (Jest/Vitest)
- [ ] Integration tests

**Components:**
- `evaluator.ts`
- `metrics.ts`
- `tests/` directory with comprehensive tests

**Metrics:**
1. **Answer Comparison:** Binary judgment (correct/incorrect)
2. **Answer Recall:** % of claims covered

**Estimated Effort:** 30 hours

---

### Phase 5: API & Interface (Week 8)

**Goal:** Provide user-friendly interfaces

**Tasks:**
- [ ] REST API (Express/Fastify)
- [ ] CLI interface (Commander.js)
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Usage examples
- [ ] README and quickstart guide

**Components:**
- `api.ts` - REST API endpoints
- `cli.ts` - Command-line interface
- `docs/` - Documentation

**API Endpoints:**
- `POST /ingest` - Ingest documents with schema
- `POST /query` - Query the system
- `GET /schema/:id` - Get schema
- `GET /stats/:id` - Get database statistics

**CLI Commands:**
- `srag ingest --docs <path> --schema <path>`
- `srag query --text "your question"`
- `srag evaluate --dataset <path>`

**Estimated Effort:** 30 hours

---

## Technical Specification

### 1. Schema Prediction

**Class: SchemaPredictor**

```typescript
import { LLMClient } from './llm-client';
import { JSONSchema } from './models/schema';

export class SchemaPredictor {
  /**
   * Generates JSON schema from sample documents and questions
   * using iterative refinement with LLM.
   */
  private llm: LLMClient;
  private numIterations: number = 4;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
  }

  async predictSchema(
    sampleDocuments: string[],
    sampleQuestions: string[],
    numDocs: number = 12,
    numQuestions: number = 10
  ): Promise<JSONSchema> {
    /**
     * Iteratively generate and refine schema.
     *
     * Args:
     *   sampleDocuments: Sample documents from corpus
     *   sampleQuestions: Sample questions to answer
     *   numDocs: Number of docs to use (default: 12)
     *   numQuestions: Number of questions to use (default: 10)
     *
     * Returns:
     *   JSONSchema object with schema definition
     *
     * Process:
     *   1. First iteration: Generate initial schema from docs
     *   2. Iterations 2-4: Refine based on docs + questions
     *   3. Validate JSON Schema compliance
     *   4. Return final schema
     */

    // Select sample subset
    const docs = sampleDocuments.slice(0, numDocs);
    const questions = sampleQuestions.slice(0, numQuestions);

    // First iteration: docs only
    let schema = await this.generateInitialSchema(docs);

    // Refinement iterations
    for (let i = 0; i < this.numIterations - 1; i++) {
      schema = await this.refineSchema(schema, docs, questions);
    }

    // Validate
    this.validateSchema(schema);

    return new JSONSchema(schema);
  }

  private async generateInitialSchema(documents: string[]): Promise<Record<string, any>> {
    /**
     * Generate initial schema from documents only
     */
    const prompt = this.buildFirstIterationPrompt(documents);
    const response = await this.llm.generate(prompt, 'gpt-4o');
    const schema = this.parseJsonResponse(response);
    return schema;
  }

  private async refineSchema(
    currentSchema: Record<string, any>,
    documents: string[],
    questions: string[]
  ): Promise<Record<string, any>> {
    /**
     * Refine schema based on questions and documents
     */
    const prompt = this.buildRefinementPrompt(
      currentSchema,
      documents,
      questions
    );
    const response = await this.llm.generate(prompt, 'gpt-4o');
    const refinedSchema = this.parseJsonResponse(response);
    return refinedSchema;
  }

  private validateSchema(schema: Record<string, any>): void {
    /**
     * Validate JSON Schema compliance
     */
    // Check required fields
    if (!schema.title) throw new Error('Schema missing title');
    if (!schema.type || schema.type !== 'object') {
      throw new Error('Schema type must be object');
    }
    if (!schema.properties) throw new Error('Schema missing properties');

    // Validate properties
    for (const [propName, propDef] of Object.entries(schema.properties as Record<string, any>)) {
      if (!propDef.type) {
        throw new Error(`Property ${propName} missing type`);
      }
      if (!propDef.description) {
        throw new Error(`Property ${propName} missing description`);
      }
      if (!propDef.examples) {
        throw new Error(`Property ${propName} missing examples`);
      }

      // MVP: Only primitive types
      const validTypes = ['string', 'number', 'integer', 'boolean'];
      if (!validTypes.includes(propDef.type)) {
        throw new Error(
          `Property ${propName} has invalid type: ${propDef.type}. Only primitive types allowed.`
        );
      }
    }
  }

  private buildFirstIterationPrompt(documents: string[]): string {
    // Implementation based on Appendix B of paper
    return `Generate JSON schema...`;
  }

  private buildRefinementPrompt(
    schema: Record<string, any>,
    documents: string[],
    questions: string[]
  ): string {
    // Implementation based on Appendix B of paper
    return `Refine JSON schema...`;
  }

  private parseJsonResponse(response: string): Record<string, any> {
    // Extract and parse JSON from LLM response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]);
  }
}
```

**Prompts:**

See Appendix B in paper for full prompts. Key elements:
- First iteration: Focus on recurring concepts across documents
- Refinement: Consider questions that need to be answered
- Constraints: No nested objects, no lengthy strings, include examples

---

### 2. Record Extraction

**Class: RecordExtractor**

```typescript
import { LLMClient } from './llm-client';
import { JSONSchema, Record } from './models';

export class RecordExtractor {
  /**
   * Extracts structured records from documents based on schema.
   */
  private llm: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
  }

  async extractRecord(
    document: string,
    schema: JSONSchema
  ): Promise<Record> {
    /**
     * Extract record from single document.
     *
     * Args:
     *   document: Raw document text (HTML, markdown, or plain text)
     *   schema: JSON Schema defining expected structure
     *
     * Returns:
     *   Record object with values for each schema attribute
     *
     * Process:
     *   1. Build prompt with schema details
     *   2. Call LLM to extract values
     *   3. Validate types
     *   4. Standardize values
     *   5. Return record
     */
    const prompt = this.buildExtractionPrompt(document, schema);
    const response = await this.llm.generate(prompt, 'gpt-4o');
    let record = this.parseRecordResponse(response, schema);
    record = this.validateAndStandardize(record, schema);
    return new Record(record, schema);
  }

  async batchExtract(
    documents: string[],
    schema: JSONSchema,
    batchSize: number = 10
  ): Promise<Record[]> {
    /**
     * Extract records from multiple documents in batches.
     *
     * Uses async processing for efficiency.
     */
    const records: Record[] = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchRecords = await Promise.all(
        batch.map(doc => this.extractRecord(doc, schema))
      );
      records.push(...batchRecords);
    }

    return records;
  }

  private validateAndStandardize(
    record: Record<string, any>,
    schema: JSONSchema
  ): Record<string, any> {
    /**
     * Validate and standardize record values.
     *
     * Standardization examples:
     * - "1M" → 1000000
     * - "1B" → 1000000000
     * - "Yes" → true
     * - Dates to ISO format
     * - Currency symbols removed
     */
    const validated: Record<string, any> = {};

    for (const [attrName, attrDef] of Object.entries(schema.properties)) {
      const value = record[attrName];
      const attrType = attrDef.type;

      if (value === null || value === undefined) {
        validated[attrName] = null;
        continue;
      }

      // Type-specific validation and standardization
      if (attrType === 'integer') {
        validated[attrName] = this.standardizeInteger(value);
      } else if (attrType === 'number') {
        validated[attrName] = this.standardizeNumber(value);
      } else if (attrType === 'boolean') {
        validated[attrName] = this.standardizeBoolean(value);
      } else if (attrType === 'string') {
        validated[attrName] = String(value);
      }
    }

    return validated;
  }

  private standardizeInteger(value: any): number | null {
    /**
     * Standardize integer values (handle 1M, 1B, etc.)
     */
    if (typeof value === 'number') {
      return Math.floor(value);
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toUpperCase();

      // Handle suffixes
      const multipliers: Record<string, number> = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
      };

      for (const [suffix, mult] of Object.entries(multipliers)) {
        if (cleaned.endsWith(suffix)) {
          const num = cleaned.slice(0, -1).replace(/,/g, '');
          return Math.floor(parseFloat(num) * mult);
        }
      }

      // Handle regular numbers
      const parsed = parseInt(cleaned.replace(/,/g, ''), 10);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private standardizeNumber(value: any): number | null {
    /**
     * Standardize float values
     */
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toUpperCase();

      // Handle suffixes
      const multipliers: Record<string, number> = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
      };

      for (const [suffix, mult] of Object.entries(multipliers)) {
        if (cleaned.endsWith(suffix)) {
          const num = cleaned.slice(0, -1).replace(/,/g, '');
          return parseFloat(num) * mult;
        }
      }

      // Handle regular numbers
      const parsed = parseFloat(cleaned.replace(/,/g, ''));
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  private standardizeBoolean(value: any): boolean | null {
    /**
     * Standardize boolean values
     */
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toLowerCase();
      if (['yes', 'true', '1', 'y'].includes(cleaned)) {
        return true;
      }
      if (['no', 'false', '0', 'n'].includes(cleaned)) {
        return false;
      }
    }

    return null;
  }

  private buildExtractionPrompt(document: string, schema: JSONSchema): string {
    // Build prompt for extraction
    return `Extract structured data...`;
  }

  private parseRecordResponse(response: string, schema: JSONSchema): Record<string, any> {
    // Parse LLM response into record
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    return JSON.parse(jsonMatch[0]);
  }
}
```

---

### 3. Database Manager

**Class: DatabaseManager**

```typescript
import Database from 'better-sqlite3';
import { JSONSchema, Record } from './models';

export class DatabaseManager {
  /**
   * Manages SQL database for structured records.
   * Uses better-sqlite3 (MVP) with easy migration to PostgreSQL.
   */
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  createTableFromSchema(schema: JSONSchema, tableName: string): void {
    /**
     * Create SQL table from JSON schema.
     *
     * Type mapping:
     * - string → TEXT
     * - number → REAL
     * - integer → INTEGER
     * - boolean → INTEGER (0/1)
     */
    const columns: string[] = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];

    // Add columns from schema
    for (const [attrName, attrDef] of Object.entries(schema.properties)) {
      const sqlType = this.jsonTypeToSql(attrDef.type);
      columns.push(`${attrName} ${sqlType}`);
    }

    // Create table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',\n        ')}
      )
    `;

    this.db.exec(createTableSQL);
  }

  insertRecords(records: Record[], tableName: string): void {
    /**
     * Batch insert records
     */
    if (records.length === 0) return;

    const firstRecord = records[0];
    const columns = Object.keys(firstRecord.data);
    const placeholders = columns.map(() => '?').join(', ');

    const insertSQL = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
    `;

    const insert = this.db.prepare(insertSQL);

    const insertMany = this.db.transaction((recs: Record[]) => {
      for (const record of recs) {
        const values = columns.map(col => record.data[col]);
        insert.run(...values);
      }
    });

    insertMany(records);
  }

  executeQuery(sql: string): any[] {
    /**
     * Execute SQL query and return results
     */
    const stmt = this.db.prepare(sql);
    return stmt.all();
  }

  getColumnStatistics(tableName: string): Record<string, any> {
    /**
     * Calculate statistics for all columns.
     *
     * For numeric columns:
     * - min, max, mean, count
     *
     * For string/boolean columns:
     * - unique values, count
     *
     * For all columns:
     * - non-null count
     */
    const stats: Record<string, any> = {};

    // Get table info
    const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();

    for (const column of tableInfo) {
      const colName = column.name;

      if (colName === 'id') continue; // Skip ID column

      const colType = column.type;

      if (colType === 'INTEGER' || colType === 'REAL') {
        // Numeric statistics
        const result = this.db
          .prepare(
            `
            SELECT
              MIN(${colName}) as min_val,
              MAX(${colName}) as max_val,
              AVG(${colName}) as mean_val,
              COUNT(${colName}) as count_val
            FROM ${tableName}
          `
          )
          .get();

        stats[colName] = {
          min: result.min_val,
          max: result.max_val,
          mean: result.mean_val,
          count: result.count_val,
          type: 'numeric',
        };
      } else {
        // Categorical statistics
        const uniqueValues = this.db
          .prepare(
            `
            SELECT DISTINCT ${colName}
            FROM ${tableName}
            WHERE ${colName} IS NOT NULL
          `
          )
          .all()
          .map(row => row[colName]);

        stats[colName] = {
          unique_values: uniqueValues,
          count: uniqueValues.length,
          type: 'categorical',
        };
      }
    }

    return stats;
  }

  close(): void {
    this.db.close();
  }

  private jsonTypeToSql(jsonType: string): string {
    /**
     * Convert JSON Schema type to SQL type
     */
    const typeMap: Record<string, string> = {
      string: 'TEXT',
      number: 'REAL',
      integer: 'INTEGER',
      boolean: 'INTEGER', // 0 or 1
    };

    return typeMap[jsonType] || 'TEXT';
  }
}
```

---

### 4. Text-to-SQL Translation

**Class: TextToSQL**

```typescript
import { LLMClient } from './llm-client';
import { JSONSchema } from './models';
import * as sqlParser from 'node-sql-parser';

export class TextToSQL {
  /**
   * Translates natural language queries to SQL.
   */
  private llm: LLMClient;
  private parser: sqlParser.Parser;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
    this.parser = new sqlParser.Parser();
  }

  async translate(
    question: string,
    schema: JSONSchema,
    statistics: Record<string, any>,
    tableName: string
  ): Promise<string> {
    /**
     * Convert natural language to SQL.
     *
     * Args:
     *   question: Natural language query
     *   schema: Database schema
     *   statistics: Column statistics for disambiguation
     *   tableName: Name of the table to query
     *
     * Returns:
     *   SQL query string
     *
     * Process:
     *   1. Build prompt with schema and statistics
     *   2. Call LLM (GPT-4o)
     *   3. Extract SQL from response
     *   4. Validate SQL
     *   5. Return SQL
     */
    const prompt = this.buildPrompt(question, schema, statistics, tableName);
    const response = await this.llm.generate(prompt, 'gpt-4o');
    const sql = this.extractSql(response);

    // Validate
    if (!this.validateSql(sql, tableName)) {
      throw new Error(`Invalid SQL generated: ${sql}`);
    }

    return sql;
  }

  private buildPrompt(
    question: string,
    schema: JSONSchema,
    statistics: Record<string, any>,
    tableName: string
  ): string {
    /**
     * Build prompt with schema and statistics.
     *
     * Includes:
     * - Table name
     * - Column names and types
     * - Column descriptions
     * - Column statistics (unique values, min/max)
     * - Question to answer
     */
    let prompt = `You are a SQL expert. Convert the following natural language query to SQL.

Table: ${tableName}

Schema:
`;

    for (const [attrName, attrDef] of Object.entries(schema.properties)) {
      prompt += `- ${attrName} (${attrDef.type}): ${attrDef.description}\n`;
    }

    prompt += '\nColumn Statistics:\n';
    for (const [colName, colStats] of Object.entries(statistics)) {
      if (colStats.type === 'numeric') {
        prompt += `- ${colName}: min=${colStats.min}, max=${colStats.max}, mean=${colStats.mean}\n`;
      } else {
        const uniqueVals = colStats.unique_values.slice(0, 10); // Limit to 10
        prompt += `- ${colName}: unique values=${JSON.stringify(uniqueVals)}\n`;
      }
    }

    prompt += `\nQuestion: ${question}\n\n`;
    prompt += 'Generate a SQL query to answer this question. Return ONLY the SQL query, no explanation.';

    return prompt;
  }

  private validateSql(sql: string, tableName: string): boolean {
    /**
     * Validate SQL syntax and safety.
     *
     * Checks:
     * - No DROP, DELETE, INSERT, UPDATE statements
     * - Only SELECT allowed
     * - No SQL injection patterns
     * - Valid SQL syntax
     */
    const sqlUpper = sql.trim().toUpperCase();

    // Only allow SELECT
    if (!sqlUpper.startsWith('SELECT')) {
      return false;
    }

    // Disallow dangerous operations
    const dangerous = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE'];
    for (const keyword of dangerous) {
      if (sqlUpper.includes(keyword)) {
        return false;
      }
    }

    // Check table name is referenced
    if (!sql.includes(tableName)) {
      return false;
    }

    // Try to parse (basic validation)
    try {
      this.parser.astify(sql, { database: 'sqlite' });
      return true;
    } catch {
      return false;
    }
  }

  private extractSql(response: string): string {
    /**
     * Extract SQL from LLM response
     */
    // Try to find SQL in code blocks
    const codeBlockMatch = response.match(/```sql\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find SELECT statement
    const selectMatch = response.match(/SELECT[\s\S]*?;?$/im);
    if (selectMatch) {
      return selectMatch[0].trim().replace(/;$/, '');
    }

    // Return as-is if nothing else works
    return response.trim();
  }
}
```

---

### 5. Answer Generator

**Class: AnswerGenerator**

```typescript
import { LLMClient } from './llm-client';

export class AnswerGenerator {
  /**
   * Generates natural language answers from SQL results.
   */
  private llm: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
  }

  async generateAnswer(
    question: string,
    sqlResults: any[],
    sqlQuery: string
  ): Promise<string> {
    /**
     * Generate natural language answer.
     *
     * Args:
     *   question: Original question
     *   sqlResults: Results from SQL query
     *   sqlQuery: The SQL query that was executed
     *
     * Returns:
     *   Natural language answer
     */
    // Format results for context
    const context = this.formatResults(sqlResults);

    // Build prompt
    const prompt = `Answer the following question based on the SQL query results.

Question: ${question}

SQL Query: ${sqlQuery}

Results:
${context}

Generate a clear, concise answer in natural language. If the results are numerical, include the exact values. If there are multiple results, summarize appropriately.

Answer:`;

    const response = await this.llm.generate(prompt, 'gpt-4o');
    return response.trim();
  }

  private formatResults(results: any[]): string {
    /**
     * Format SQL results as readable text
     */
    if (!results || results.length === 0) {
      return 'No results found.';
    }

    if (results.length === 1) {
      // Single result
      return JSON.stringify(results[0], null, 2);
    }

    // Multiple results - format as table
    let output = '';
    const displayResults = results.slice(0, 100); // Limit to 100 rows

    for (let i = 0; i < displayResults.length; i++) {
      output += `Row ${i + 1}: ${JSON.stringify(displayResults[i])}\n`;
    }

    if (results.length > 100) {
      output += `\n... and ${results.length - 100} more rows`;
    }

    return output;
  }
}
```

---

### 6. Evaluation

**Class: Evaluator**

```typescript
import { LLMClient } from './llm-client';

interface TestCase {
  question: string;
  gold_answer: string;
  predicted_answer: string;
}

interface EvaluationResult {
  answer_comparison: number;
  answer_recall: number;
  num_examples: number;
  per_example_results: Array<{
    question: string;
    is_correct: boolean;
    recall: number;
  }>;
}

export class Evaluator {
  /**
   * Evaluates system performance using LLM-as-judge.
   */
  private llm: LLMClient;

  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
  }

  async answerComparison(
    question: string,
    goldAnswer: string,
    predictedAnswer: string
  ): Promise<boolean> {
    /**
     * Binary judgment: is predicted answer correct?
     *
     * Uses LLM as judge (GPT-4o).
     */
    const prompt = `You are given a query, a gold answer, and a judged answer.
Decide if the judged answer is a correct answer for the query, based on the gold answer.
Do not use any external or prior knowledge. Only use the gold answer.

Answer Yes if the judged answer is a correct answer for the query, and No otherwise.

<query>
${question}
</query>

<gold_answer>
${goldAnswer}
</gold_answer>

<judged_answer>
${predictedAnswer}
</judged_answer>

Answer (Yes or No):`;

    const response = await this.llm.generate(prompt, 'gpt-4o');
    return response.trim().toLowerCase().includes('yes');
  }

  async answerRecall(
    goldAnswer: string,
    predictedAnswer: string
  ): Promise<number> {
    /**
     * Percentage of gold answer claims covered.
     *
     * Process:
     * 1. Decompose gold answer into individual claims
     * 2. Check which claims are covered in predicted answer
     * 3. Return percentage
     */
    // Decompose gold answer into claims
    const claimsPrompt = `Break down the following answer into individual factual claims.
Return a numbered list of claims.

Answer: ${goldAnswer}

Claims:`;

    const claimsResponse = await this.llm.generate(claimsPrompt, 'gpt-4o');
    const claims = this.parseClaims(claimsResponse);

    // Check coverage
    let coveredCount = 0;
    for (const claim of claims) {
      const isCovered = await this.isClaimCovered(claim, predictedAnswer);
      if (isCovered) {
        coveredCount++;
      }
    }

    return claims.length > 0 ? coveredCount / claims.length : 0;
  }

  private async isClaimCovered(claim: string, answer: string): Promise<boolean> {
    /**
     * Check if claim is covered in answer
     */
    const prompt = `Is the following claim covered in the answer?

Claim: ${claim}

Answer: ${answer}

Respond with Yes or No:`;

    const response = await this.llm.generate(prompt, 'gpt-4o');
    return response.trim().toLowerCase().includes('yes');
  }

  async evaluateDataset(testCases: TestCase[]): Promise<EvaluationResult> {
    /**
     * Evaluate on full dataset.
     *
     * Args:
     *   testCases: Array of objects with 'question', 'gold_answer', 'predicted_answer'
     *
     * Returns:
     *   Object with metrics:
     *   - answer_comparison: number (accuracy)
     *   - answer_recall: number (average recall)
     *   - per_example_results: Array of individual results
     */
    const comparisonResults: boolean[] = [];
    const recallResults: number[] = [];

    for (const tc of testCases) {
      // Answer comparison
      const isCorrect = await this.answerComparison(
        tc.question,
        tc.gold_answer,
        tc.predicted_answer
      );
      comparisonResults.push(isCorrect);

      // Answer recall
      const recall = await this.answerRecall(tc.gold_answer, tc.predicted_answer);
      recallResults.push(recall);
    }

    return {
      answer_comparison:
        comparisonResults.reduce((a, b) => a + (b ? 1 : 0), 0) /
        comparisonResults.length,
      answer_recall:
        recallResults.reduce((a, b) => a + b, 0) / recallResults.length,
      num_examples: testCases.length,
      per_example_results: testCases.map((tc, i) => ({
        question: tc.question,
        is_correct: comparisonResults[i],
        recall: recallResults[i],
      })),
    };
  }

  private parseClaims(claimsResponse: string): string[] {
    /**
     * Parse numbered list of claims from LLM response
     */
    const lines = claimsResponse.split('\n');
    const claims: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        claims.push(match[1].trim());
      }
    }

    return claims;
  }
}
```

---

### 7. LLM Client

**Class: LLMClient**

```typescript
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type ModelProvider = 'openai' | 'anthropic';

export class LLMClient {
  /**
   * Unified LLM API wrapper supporting OpenAI and Anthropic
   */
  private openai: OpenAI;
  private anthropic: Anthropic;

  constructor(
    openaiApiKey?: string,
    anthropicApiKey?: string
  ) {
    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }

    if (anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    }
  }

  async generate(
    prompt: string,
    model: string = 'gpt-4o',
    temperature: number = 0.7,
    maxTokens: number = 4096
  ): Promise<string> {
    /**
     * Generate text using specified model
     */
    if (model.startsWith('gpt-') || model.startsWith('o1-')) {
      return this.generateOpenAI(prompt, model, temperature, maxTokens);
    } else if (model.startsWith('claude-')) {
      return this.generateAnthropic(prompt, model, temperature, maxTokens);
    } else {
      throw new Error(`Unknown model: ${model}`);
    }
  }

  private async generateOpenAI(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    return response.choices[0].message.content || '';
  }

  private async generateAnthropic(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return content.type === 'text' ? content.text : '';
  }
}
```

---

## Project Structure

```
learn-srag/
├── src/
│   ├── index.ts                        # Main entry point
│   │
│   ├── ingestion/
│   │   ├── schema-predictor.ts         # Schema generation
│   │   ├── record-extractor.ts         # Record extraction
│   │   └── statistics-calculator.ts    # Column statistics
│   │
│   ├── inference/
│   │   ├── text-to-sql.ts              # NL to SQL translation
│   │   ├── query-executor.ts           # SQL execution
│   │   └── answer-generator.ts         # Answer generation
│   │
│   ├── database/
│   │   └── database-manager.ts         # DB operations
│   │
│   ├── llm/
│   │   └── llm-client.ts               # LLM API wrapper
│   │
│   ├── evaluation/
│   │   ├── evaluator.ts                # Evaluation logic
│   │   └── metrics.ts                  # Metrics implementation
│   │
│   ├── models/
│   │   ├── schema.ts                   # Schema models
│   │   └── record.ts                   # Record models
│   │
│   ├── utils/
│   │   ├── config.ts                   # Configuration
│   │   ├── prompts.ts                  # Prompt templates
│   │   └── helpers.ts                  # Utility functions
│   │
│   ├── api.ts                          # REST API (Express/Fastify)
│   └── cli.ts                          # CLI (Commander.js)
│
├── tests/
│   ├── ingestion/
│   │   ├── schema-predictor.test.ts
│   │   ├── record-extractor.test.ts
│   │   └── statistics.test.ts
│   ├── inference/
│   │   ├── text-to-sql.test.ts
│   │   ├── query-executor.test.ts
│   │   └── answer-generator.test.ts
│   ├── database/
│   │   └── database-manager.test.ts
│   └── evaluation/
│       ├── evaluator.test.ts
│       └── metrics.test.ts
│
├── data/
│   ├── schemas/                        # Saved schemas
│   ├── databases/                      # SQLite databases
│   └── datasets/                       # Test datasets
│       ├── hotels/
│       └── worldcup/
│
├── prompts/
│   ├── schema-generation-first.txt     # First iteration prompt
│   ├── schema-generation-refine.txt    # Refinement prompt
│   ├── record-extraction.txt           # Record extraction prompt
│   ├── text-to-sql.txt                 # Text-to-SQL prompt
│   └── answer-generation.txt           # Answer generation prompt
│
├── examples/
│   ├── hotels-example.ts               # HOTELS dataset example
│   ├── worldcup-example.ts             # WORLD CUP dataset example
│   └── custom-corpus-example.ts        # Custom corpus example
│
├── docs/
│   ├── architecture.md                 # Architecture overview
│   ├── api-reference.md                # API documentation
│   ├── quickstart.md                   # Quickstart guide
│   └── evaluation.md                   # Evaluation guide
│
├── scripts/
│   ├── download-datasets.ts            # Download test datasets
│   └── benchmark.ts                    # Run benchmarks
│
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript configuration
├── .env.example                        # Environment variables template
├── .gitignore
├── README.md
└── IMPLEMENTATION_PLAN_TYPESCRIPT.md   # This file
```

---

## Technology Stack

### Core Dependencies

```json
{
  "name": "learn-srag",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.18.0",
    "better-sqlite3": "^9.0.0",
    "node-sql-parser": "^4.0.0",
    "zod": "^3.22.0",
    "dotenv": "^16.0.0",
    "express": "^4.18.0",
    "fastify": "^4.25.0",
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.3.0",
    "tsx": "^4.0.0",
    "vitest": "^1.0.0",
    "@vitest/ui": "^1.0.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0",
    "prettier": "^3.1.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write 'src/**/*.ts'"
  }
}
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Optional Dependencies

For advanced features:

```json
{
  "dependencies": {
    "pg": "^8.11.0",
    "@types/pg": "^8.10.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.3.0",
    "prom-client": "^15.0.0",
    "swagger-jsdoc": "^6.2.0",
    "swagger-ui-express": "^5.0.0"
  }
}
```

---

## Success Criteria

### MVP Success Criteria

#### 1. Functional Requirements

- [ ] **Schema Prediction**
  - Successfully generate schema from 12 documents + 10 questions
  - Schema includes appropriate attributes with types and descriptions
  - Schema validation passes

- [ ] **Record Extraction**
  - Extract records from 50+ documents
  - Type validation accuracy > 95%
  - Standardization works for common formats (1M, 1B, etc.)

- [ ] **Query Execution**
  - Text-to-SQL translation success rate > 80%
  - SQL execution without errors
  - Results returned in < 10 seconds

- [ ] **Answer Generation**
  - Natural language answers generated for all queries
  - Answers include relevant information from SQL results

#### 2. Performance Requirements

- [ ] **Ingestion Performance**
  - Schema generation: < 5 minutes (4 iterations)
  - Record extraction: < 2 seconds per document
  - Batch processing: 10 documents per batch

- [ ] **Inference Performance**
  - Query answering: < 10 seconds end-to-end
  - Text-to-SQL: < 3 seconds
  - Answer generation: < 5 seconds

#### 3. Quality Requirements

- [ ] **Accuracy Metrics**
  - Answer Comparison: > 0.70 on test dataset
  - Answer Recall: > 0.65 on test dataset
  - SQL generation success rate: > 80%

- [ ] **Robustness**
  - Handle missing/null values gracefully
  - Error recovery for failed LLM calls
  - SQL injection prevention

#### 4. Usability Requirements

- [ ] **API**
  - REST API with clear endpoints
  - API documentation (OpenAPI/Swagger)
  - Example requests/responses

- [ ] **CLI**
  - Intuitive commands
  - Help text for all commands
  - Progress indicators with ora

- [ ] **Documentation**
  - README with quickstart
  - Architecture documentation
  - API reference
  - Examples for common use cases

---

## Next Steps

### Immediate Actions

1. **Set up development environment**
   ```bash
   npm init -y
   npm install --save-dev typescript tsx @types/node
   npm install openai @anthropic-ai/sdk better-sqlite3
   npx tsc --init
   ```

2. **Create project structure**
   ```bash
   mkdir -p src/{ingestion,inference,database,llm,evaluation,models,utils}
   mkdir -p tests/{ingestion,inference,database,evaluation}
   mkdir -p data/{schemas,databases,datasets}
   mkdir -p prompts examples docs scripts
   ```

3. **Implement Phase 1 (Foundation)**
   - LLM client wrapper
   - Database manager
   - Configuration management

### Phase-by-Phase Checklist

Use this checklist to track progress:

#### Phase 1: Foundation ✓
- [ ] Project structure created
- [ ] Dependencies installed
- [ ] TypeScript configured
- [ ] LLM client implemented
- [ ] Database manager implemented
- [ ] Configuration system set up
- [ ] Basic tests passing

#### Phase 2: Ingestion ✓
- [ ] Schema predictor implemented
- [ ] Prompt templates created
- [ ] Record extractor implemented
- [ ] Statistics calculator implemented
- [ ] Integration tests passing
- [ ] Example ingestion working

#### Phase 3: Inference ✓
- [ ] Text-to-SQL implemented
- [ ] Query executor implemented
- [ ] Answer generator implemented
- [ ] SQL validation working
- [ ] End-to-end inference working
- [ ] Example queries working

#### Phase 4: Evaluation ✓
- [ ] Evaluator implemented
- [ ] Answer comparison metric working
- [ ] Answer recall metric working
- [ ] Test datasets loaded
- [ ] Benchmark scripts working
- [ ] Evaluation report generated

#### Phase 5: API & Interface ✓
- [ ] REST API implemented
- [ ] CLI implemented
- [ ] API documentation generated
- [ ] Examples created
- [ ] README completed
- [ ] Quickstart guide written

---

## Advanced Features (Post-MVP)

After MVP is complete, consider these enhancements:

### 1. Hybrid S-RAG Mode

Combine S-RAG with traditional RAG:
- Use S-RAG to narrow corpus to relevant documents
- Apply vector-based RAG on filtered subset
- Useful when schema doesn't capture all attributes

### 2. Multi-Schema Support

Support corpora with multiple entity types:
- Detect document type
- Apply appropriate schema
- Join across schemas

### 3. Complex Attributes

Support nested objects and lists:
- Nested schemas
- Multiple tables with foreign keys
- JSON column types

### 4. Incremental Ingestion

Add documents without re-processing entire corpus:
- Incremental record extraction
- Statistics updates
- Schema evolution

### 5. Query Optimization

Improve query performance:
- Indexing strategy
- Query caching with Redis
- Connection pooling

### 6. Schema Learning

Improve schema prediction:
- Active learning for schema refinement
- User feedback incorporation
- Schema versioning and migration

### 7. Production Features

- [ ] PostgreSQL support
- [ ] Async ingestion with BullMQ
- [ ] Caching with Redis
- [ ] Monitoring with Prometheus
- [ ] Docker deployment
- [ ] Kubernetes manifests

---

## References

1. **Original Paper:** Koshorek et al., "Structured RAG for Answering Aggregative Questions" (arXiv:2511.08505v1)
2. **Datasets:** https://huggingface.co/datasets/ai21labs/aggregative_questions
3. **Related Work:**
   - RAG: Lewis et al., 2020
   - FinanceBench: Islam et al., 2023
   - Text-to-SQL: Various benchmarks (Spider, WikiSQL)

---

## Appendix: Example Workflows

### Example 1: HOTELS Dataset

```typescript
import { SchemaPredictor } from './ingestion/schema-predictor';
import { RecordExtractor } from './ingestion/record-extractor';
import { DatabaseManager } from './database/database-manager';
import { TextToSQL } from './inference/text-to-sql';
import { AnswerGenerator } from './inference/answer-generator';
import { LLMClient } from './llm/llm-client';

async function main() {
  // 1. Initialize clients
  const llmClient = new LLMClient(
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY
  );

  // 2. Load sample documents and questions
  const sampleDocs = await loadHotelsDocuments(12);
  const sampleQuestions = await loadHotelsQuestions(10);

  // 3. Generate schema
  const predictor = new SchemaPredictor(llmClient);
  const schema = await predictor.predictSchema(sampleDocs, sampleQuestions);

  // 4. Create database
  const db = new DatabaseManager('data/databases/hotels.db');
  db.createTableFromSchema(schema, 'hotels');

  // 5. Extract records from all documents
  const extractor = new RecordExtractor(llmClient);
  const allDocs = await loadHotelsDocuments(); // All 350 documents
  const records = await extractor.batchExtract(allDocs, schema);

  // 6. Insert into database
  db.insertRecords(records, 'hotels');

  // 7. Calculate statistics
  const stats = db.getColumnStatistics('hotels');

  // 8. Query the system
  const question = 'What is the average guest rating for hotels in Sydney?';

  const translator = new TextToSQL(llmClient);
  const sql = await translator.translate(question, schema, stats, 'hotels');

  const results = db.executeQuery(sql);

  const generator = new AnswerGenerator(llmClient);
  const answer = await generator.generateAnswer(question, results, sql);

  console.log(`Question: ${question}`);
  console.log(`Answer: ${answer}`);

  db.close();
}

main().catch(console.error);
```

### Example 2: Custom Corpus

```typescript
import { SchemaPredictor } from './ingestion/schema-predictor';
import { RecordExtractor } from './ingestion/record-extractor';
import { DatabaseManager } from './database/database-manager';
import { LLMClient } from './llm/llm-client';

async function customCorpusExample() {
  // 1. Prepare your corpus
  const myDocuments = [
    'Document 1 content...',
    'Document 2 content...',
    // ... more documents
  ];

  // 2. Prepare sample questions
  const myQuestions = [
    'What is the average X for Y?',
    'How many documents have Z?',
    // ... more questions
  ];

  // 3. Initialize
  const llmClient = new LLMClient(process.env.OPENAI_API_KEY);
  const predictor = new SchemaPredictor(llmClient);
  const extractor = new RecordExtractor(llmClient);
  const db = new DatabaseManager('data/databases/custom.db');

  // 4. Generate schema
  const schema = await predictor.predictSchema(myDocuments, myQuestions);

  // 5. Create table and extract records
  db.createTableFromSchema(schema, 'custom_data');
  const records = await extractor.batchExtract(myDocuments, schema);
  db.insertRecords(records, 'custom_data');

  console.log('Ingestion complete!');
  db.close();
}

customCorpusExample().catch(console.error);
```

---

**End of Implementation Plan**

This plan provides a comprehensive roadmap for implementing S-RAG at MVP level using TypeScript and Node.js. Follow the phases sequentially, and adjust as needed based on your specific requirements and constraints.
