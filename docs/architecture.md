# S-RAG Architecture

This document provides a comprehensive overview of the S-RAG system architecture, component design, and data flow.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Description](#component-description)
4. [Data Flow](#data-flow)
5. [Design Decisions](#design-decisions)
6. [Technology Stack](#technology-stack)

## System Overview

S-RAG (Structured RAG) is a two-phase system that transforms unstructured documents into structured databases for efficient querying.

### Core Principles

1. **Separation of Concerns**: Ingestion and inference are completely separate phases
2. **Schema-First**: All data is structured according to a predicted schema
3. **SQL-Based**: Leverage SQL's power for aggregative queries
4. **LLM-Powered**: Use LLMs for schema prediction, extraction, and generation
5. **Type-Safe**: Full TypeScript implementation with strict typing

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INGESTION PHASE (Offline)                     │
└─────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐      ┌──────────────┐
   │  Documents   │      │  Questions   │
   └──────┬───────┘      └──────┬───────┘
          │                     │
          └─────────┬───────────┘
                    ▼
          ┌──────────────────┐
          │ Schema Predictor │ ◄─── LLM (GPT-4o / Claude)
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │   JSON Schema    │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ Record Extractor │ ◄─── LLM (GPT-4o / Claude)
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │  Structured      │
          │  Records (JSON)  │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │ Database Manager │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐      ┌───────────────────┐
          │  SQLite Database │      │  Statistics       │
          │  (with Stats)    │◄────►│  Calculator       │
          └──────────────────┘      └───────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       INFERENCE PHASE (Online)                       │
└─────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐
   │   Question   │
   │  (Natural    │
   │  Language)   │
   └──────┬───────┘
          │
          ▼
   ┌──────────────────┐
   │  Text-to-SQL     │ ◄─── Schema + Stats + LLM
   │  Translator      │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  SQL Query       │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Query Executor  │ ◄─── SQLite Database
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Query Results   │
   │  (JSON)          │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Answer          │ ◄─── LLM (GPT-4o / Claude)
   │  Generator       │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  Natural Language│
   │  Answer          │
   └──────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       EVALUATION PHASE (Optional)                    │
└─────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐      ┌──────────────┐
   │  Predicted   │      │  Gold        │
   │  Answer      │      │  Answer      │
   └──────┬───────┘      └──────┬───────┘
          │                     │
          └─────────┬───────────┘
                    ▼
          ┌──────────────────┐
          │   Evaluator      │ ◄─── LLM-as-Judge (GPT-4o)
          │  - Comparison    │
          │  - Recall        │
          └────────┬─────────┘
                   │
                   ▼
          ┌──────────────────┐
          │   Metrics        │
          │  - Accuracy      │
          │  - Precision     │
          │  - Recall        │
          │  - F1 Score      │
          └──────────────────┘
```

## Component Description

### Ingestion Phase Components

#### 1. Schema Predictor (`src/ingestion/schema-predictor.ts`)

**Purpose**: Automatically generate JSON schemas from sample documents and questions

**Key Features**:
- Iterative refinement (4 iterations: 1 initial + 3 refinements)
- LLM-powered schema generation
- Schema validation and versioning
- Supports only primitive types (string, number, integer, boolean)

**Algorithm**:
```
1. Initial Schema Generation:
   - Input: 2-3 sample documents + 5 sample questions
   - Output: Initial JSON schema

2. Refinement Loop (3 iterations):
   - Input: Current schema + sample questions + previous iteration feedback
   - Process: LLM refines schema based on question requirements
   - Output: Improved schema

3. Validation:
   - Ensure all properties have primitive types
   - Validate required fields
   - Check property descriptions
```

**Dependencies**:
- `LLMClient`: For calling LLM APIs
- `JSONSchema`: Schema model with validation

#### 2. Record Extractor (`src/ingestion/record-extractor.ts`)

**Purpose**: Extract structured records from unstructured documents

**Key Features**:
- Batch processing with configurable batch size
- Concurrent extraction within batches
- Value standardization (e.g., "1M" → 1000000)
- Type coercion and validation

**Algorithm**:
```
1. Batch Division:
   - Split documents into batches (default: 10 per batch)

2. Concurrent Extraction:
   - For each batch, extract records in parallel
   - Each document → LLM → JSON record

3. Standardization:
   - Numbers: "1M" → 1000000, "5K" → 5000
   - Booleans: "yes" → true, "no" → false
   - Strings: trim whitespace

4. Validation:
   - Validate against schema
   - Type checking
   - Required field verification
```

**Dependencies**:
- `LLMClient`: For extraction LLM calls
- `JSONSchema`: Schema definition
- `Record`: Record model with standardization

#### 3. Database Manager (`src/database/database-manager.ts`)

**Purpose**: Manage SQLite database operations

**Key Features**:
- Schema-to-SQL table conversion
- Batch insertion with transactions
- Safe query execution
- Statistics calculation

**Type Mapping**:
```typescript
JSON Schema Type → SQLite Type
string          → TEXT
number          → REAL
integer         → INTEGER
boolean         → INTEGER (0/1)
```

**Dependencies**:
- `better-sqlite3`: SQLite driver
- `JSONSchema`: For table creation

#### 4. Statistics Calculator (`src/ingestion/statistics-calculator.ts`)

**Purpose**: Calculate and format column statistics

**Key Features**:
- Numeric statistics (min, max, mean, count, non-null count)
- Categorical statistics (unique values, count)
- LLM-friendly formatting
- Data quality warnings

**Statistics Calculated**:
- **Numeric columns**: min, max, mean, count, non_null_count
- **Categorical columns**: unique_values (sample), count, non_null_count

### Inference Phase Components

#### 5. Text-to-SQL Translator (`src/inference/text-to-sql.ts`)

**Purpose**: Translate natural language questions to SQL queries

**Key Features**:
- Schema-aware SQL generation
- Statistics-informed queries
- SQL validation and sanitization
- Injection prevention

**Algorithm**:
```
1. Build Prompt:
   - Include schema definition
   - Include column statistics
   - Include natural language question
   - Provide SQL examples

2. LLM Translation:
   - Call LLM with prompt
   - Extract SQL from response

3. Validation:
   - Only SELECT queries allowed
   - Block dangerous keywords (DROP, DELETE, INSERT, UPDATE)
   - Verify table names
   - Basic syntax checking

4. Return SQL:
   - Clean, validated SQL query
```

**Dependencies**:
- `LLMClient`: For translation
- `JSONSchema`: Schema context
- `node-sql-parser`: SQL validation

#### 6. Query Executor (`src/inference/query-executor.ts`)

**Purpose**: Execute SQL queries safely and format results

**Key Features**:
- Parameterized query execution
- Result formatting
- Pagination support
- Boolean conversion (0/1 → false/true)

**Algorithm**:
```
1. Execute Query:
   - Run SQL on SQLite database
   - Use prepared statements

2. Format Results:
   - Convert boolean columns (is_, has_, can_)
   - Handle null values
   - Structure as JSON

3. Add Metadata:
   - Column names and types
   - Row count
   - Pagination info
```

**Dependencies**:
- `DatabaseManager`: For query execution

#### 7. Answer Generator (`src/inference/answer-generator.ts`)

**Purpose**: Generate natural language answers from SQL results

**Key Features**:
- Intelligent result formatting
- Context-aware answer generation
- Result truncation for large datasets
- Citation support

**Algorithm**:
```
1. Format Results:
   - Single result: inline format
   - Multiple results: list or JSON
   - Empty results: "No results found"

2. Build Prompt:
   - Include question
   - Include formatted results
   - Include SQL query (optional)

3. Generate Answer:
   - LLM generates natural language answer
   - Low temperature (0.3) for factual accuracy

4. Return Answer:
   - Clear, concise natural language response
```

**Dependencies**:
- `LLMClient`: For answer generation

### Evaluation Components

#### 8. Evaluator (`src/evaluation/evaluator.ts`)

**Purpose**: Evaluate answer quality using LLM-as-judge

**Key Metrics**:
- **Answer Comparison**: Binary judgment (correct/incorrect)
- **Answer Recall**: Percentage of claims covered (0.0-1.0)

**Algorithm**:
```
Answer Comparison:
1. Input: predicted answer + gold answer
2. LLM judges if predicted is equivalent to gold
3. Output: 1 (correct) or 0 (incorrect)

Answer Recall:
1. Decompose gold answer into claims
2. For each claim, check if covered in predicted answer
3. Calculate coverage percentage
4. Output: recall score (0.0-1.0)
```

**Dependencies**:
- `LLMClient`: For LLM-as-judge evaluation

#### 9. Metrics (`src/evaluation/metrics.ts`)

**Purpose**: Calculate and report evaluation metrics

**Key Features**:
- Aggregate metrics calculation
- Multi-run comparison
- Report generation (text, markdown, JSON)
- Visualization helpers

**Metrics Calculated**:
- Mean, median, standard deviation
- Accuracy, precision, recall, F1 score
- Confusion matrix
- Performance charts

### Supporting Components

#### 10. LLM Client (`src/llm/llm-client.ts`)

**Purpose**: Unified interface for multiple LLM providers

**Supported Models**:
- **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Anthropic**: claude-3-5-sonnet, claude-3-opus, claude-3-sonnet, claude-3-haiku

**Key Features**:
- Automatic provider detection
- Retry logic with exponential backoff
- Rate limiting
- Token usage tracking
- Structured logging

#### 11. Models (`src/models/`)

**JSONSchema** (`schema.ts`):
- JSON Schema representation
- Zod validation
- Schema serialization/deserialization

**Record** (`record.ts`):
- Record data model
- Value standardization
- Type coercion
- Validation

**Types** (`types.ts`):
- TypeScript type definitions
- API interfaces
- Configuration types

#### 12. Utilities (`src/utils/`)

**Config** (`config.ts`):
- Environment variable loading
- Configuration validation
- Default values

**Logger** (`logger.ts`):
- Structured logging
- Multiple log levels
- Context support
- Pretty/JSON output

**Helpers** (`helpers.ts`):
- File I/O utilities
- JSON parsing
- Async utilities
- String manipulation
- Type guards

## Data Flow

### Ingestion Flow

```
1. Load Documents + Questions
   ↓
2. Schema Prediction
   - Sample docs → LLM → Initial schema
   - Refinement iterations (3x)
   ↓
3. Record Extraction
   - All docs → Batch processing → LLM → JSON records
   - Value standardization
   ↓
4. Database Creation
   - Create table from schema
   - Insert records (with transaction)
   - Calculate statistics
   ↓
5. Persist
   - Save schema to file
   - Save database to disk
```

### Inference Flow

```
1. Receive Question
   ↓
2. Load Context
   - Load schema
   - Load statistics
   ↓
3. Text-to-SQL Translation
   - Question + Schema + Stats → LLM → SQL
   - Validate and sanitize SQL
   ↓
4. Query Execution
   - Execute SQL on database
   - Format results
   ↓
5. Answer Generation
   - Question + Results → LLM → Natural language answer
   ↓
6. Return Answer
```

### Evaluation Flow

```
1. Run Inference
   - Get predicted answer
   ↓
2. Load Gold Answer
   ↓
3. Evaluate
   - Answer Comparison: predicted vs. gold → binary score
   - Answer Recall: claim coverage → percentage
   ↓
4. Aggregate Metrics
   - Calculate statistics
   - Generate reports
   ↓
5. Output
   - Text/Markdown/JSON reports
   - Performance visualization
```

## Design Decisions

### Why SQLite?

- **Embedded**: No separate server needed
- **Fast**: Excellent for read-heavy workloads
- **Portable**: Single file database
- **SQL Support**: Full SQL query capabilities
- **Production-Ready**: Used by major applications

Future: Support PostgreSQL for multi-user scenarios.

### Why Iterative Schema Refinement?

Initial schemas are often incomplete. Iterative refinement:
- Improves schema quality
- Aligns schema with question requirements
- Reduces extraction errors
- Better captures domain structure

### Why LLM-as-Judge for Evaluation?

- **Scalable**: No manual evaluation needed
- **Flexible**: Handles various answer formats
- **Accurate**: GPT-4o shows high agreement with humans
- **Consistent**: Deterministic with temperature=0

### Why Separate Ingestion and Inference?

- **Performance**: Ingestion is slow, inference is fast
- **Cost**: Pay once for ingestion, not per query
- **Scalability**: Database can handle millions of queries
- **Flexibility**: Can update schema without re-ingestion

### Type Safety Choices

- **Strict TypeScript**: Catch errors at compile time
- **Zod Validation**: Runtime validation for external data
- **Custom Error Classes**: Clear error handling
- **Type Guards**: Safe type narrowing

## Technology Stack

### Core Technologies

- **TypeScript 5.3+**: Type-safe development
- **Node.js 18+**: JavaScript runtime
- **better-sqlite3**: SQLite driver
- **OpenAI SDK**: GPT models
- **Anthropic SDK**: Claude models

### Development Tools

- **Vitest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **tsx**: TypeScript execution

### Dependencies

- **zod**: Schema validation
- **node-sql-parser**: SQL parsing
- **dotenv**: Environment variables
- **ora**: Progress spinners (CLI)
- **chalk**: Terminal colors (CLI)
- **commander**: CLI framework

## Performance Considerations

### Bottlenecks

1. **Schema Prediction**: 2-4 minutes (4 LLM calls)
2. **Record Extraction**: 1-2 seconds per document (LLM call)
3. **Text-to-SQL**: 1-3 seconds (LLM call)
4. **Answer Generation**: 2-5 seconds (LLM call)

### Optimizations

1. **Batch Processing**: Extract multiple records concurrently
2. **Caching**: Reuse schemas across runs
3. **Prepared Statements**: Fast query execution
4. **Transactions**: Batch inserts for speed
5. **Rate Limiting**: Avoid API throttling

### Scaling Strategies

- **Parallel Processing**: Process documents in parallel
- **Database Sharding**: Split large datasets across databases
- **Caching Layer**: Cache frequent queries
- **API Queue**: Queue LLM requests to manage rate limits

## Security Considerations

### SQL Injection Prevention

1. **Whitelist Validation**: Only SELECT queries allowed
2. **Keyword Filtering**: Block DROP, DELETE, INSERT, UPDATE
3. **Prepared Statements**: Parameterized queries
4. **Table Name Validation**: Verify table exists
5. **Syntax Checking**: Parse SQL before execution

### API Key Management

1. **Environment Variables**: Never commit keys
2. **Key Rotation**: Support multiple keys
3. **Error Handling**: Don't expose keys in errors

### Data Privacy

1. **Local Processing**: SQLite runs locally
2. **No Data Retention**: LLM providers may log, check policies
3. **Anonymization**: Consider anonymizing sensitive data

## Future Enhancements

### Planned Features

1. **PostgreSQL Support**: For multi-user scenarios
2. **Vector Search**: Hybrid SQL + semantic search
3. **Schema Evolution**: Update schemas without re-ingestion
4. **Incremental Ingestion**: Add new documents efficiently
5. **Multi-Table Support**: Relational schemas
6. **Query Optimization**: Automatic index creation
7. **Caching Layer**: Redis for frequent queries
8. **Web UI**: Visual interface for querying

### Research Directions

1. **Few-Shot Learning**: Improve extraction with examples
2. **Active Learning**: Iteratively improve schema
3. **Multi-Modal**: Support images, tables, charts
4. **Cross-Lingual**: Support multiple languages
5. **Explainability**: Explain SQL generation decisions

---

This architecture provides a solid foundation for building structured RAG systems that excel at aggregative queries over large document collections.
