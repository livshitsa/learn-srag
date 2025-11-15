# S-RAG Implementation - Detailed Iterations Plan

**Status**: In Progress
**Started**: 2025-11-15
**Branch**: `claude/implement-typescript-plan-01S3xHMcmRLr7u2wpcX7EMA8`

---

## Overview

This document breaks down the IMPLEMENTATION_PLAN_TYPESCRIPT.md into concrete, actionable iterations. Each iteration should be completed by a dedicated subagent, with progress tracked in SCRATCHPAD.md.

---

## Iteration 1: Project Foundation & Setup

**Goal**: Set up the project structure, dependencies, and basic configuration
**Estimated Time**: 4-6 hours
**Status**: Pending

### Tasks:
1. Initialize Node.js project with TypeScript
2. Set up directory structure (src/, tests/, data/, prompts/, etc.)
3. Install core dependencies (OpenAI, Anthropic, better-sqlite3, etc.)
4. Configure TypeScript (tsconfig.json)
5. Set up ESLint and Prettier
6. Create .env.example template
7. Create basic package.json scripts
8. Add .gitignore

### Deliverables:
- [ ] package.json with all dependencies
- [ ] tsconfig.json configured
- [ ] Directory structure created
- [ ] .env.example file
- [ ] .gitignore file
- [ ] Basic README.md

### Subagent Assignment: `general-purpose`

---

## Iteration 2: Core Models & Types

**Goal**: Define TypeScript interfaces and models for schema, records, and data structures
**Estimated Time**: 2-3 hours
**Status**: Pending

### Tasks:
1. Create `src/models/schema.ts` - JSONSchema model
2. Create `src/models/record.ts` - Record model
3. Create type definitions for API responses
4. Create type definitions for configuration
5. Add validation with Zod

### Deliverables:
- [ ] src/models/schema.ts
- [ ] src/models/record.ts
- [ ] src/models/types.ts
- [ ] Basic unit tests for models

### Subagent Assignment: `general-purpose`

---

## Iteration 3: Configuration & Utilities

**Goal**: Implement configuration management and utility functions
**Estimated Time**: 2-3 hours
**Status**: Pending

### Tasks:
1. Create `src/utils/config.ts` - Configuration loader
2. Create `src/utils/helpers.ts` - Utility functions
3. Create `src/utils/logger.ts` - Logging system
4. Set up environment variable validation

### Deliverables:
- [ ] src/utils/config.ts
- [ ] src/utils/helpers.ts
- [ ] src/utils/logger.ts
- [ ] Tests for utilities

### Subagent Assignment: `general-purpose`

---

## Iteration 4: LLM Client Wrapper

**Goal**: Implement unified LLM client supporting OpenAI and Anthropic
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Create `src/llm/llm-client.ts`
2. Implement OpenAI integration
3. Implement Anthropic integration
4. Add error handling and retry logic
5. Add rate limiting
6. Create tests with mocked API calls

### Deliverables:
- [ ] src/llm/llm-client.ts
- [ ] Support for GPT-4o
- [ ] Support for Claude models
- [ ] Error handling
- [ ] Unit tests

### Subagent Assignment: `general-purpose`

---

## Iteration 5: Database Manager

**Goal**: Implement SQLite database operations
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Create `src/database/database-manager.ts`
2. Implement table creation from JSON Schema
3. Implement batch record insertion
4. Implement query execution
5. Implement statistics calculation
6. Add connection management
7. Create comprehensive tests

### Deliverables:
- [ ] src/database/database-manager.ts
- [ ] Schema to SQL table conversion
- [ ] Batch insertion with transactions
- [ ] Statistics calculator
- [ ] Unit tests

### Subagent Assignment: `general-purpose`

---

## Iteration 6A: Schema Predictor - Part 1

**Goal**: Implement initial schema generation
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Create `src/ingestion/schema-predictor.ts` (skeleton)
2. Implement first iteration schema generation
3. Create prompt template for initial schema
4. Implement JSON parsing and validation
5. Add basic tests

### Deliverables:
- [ ] src/ingestion/schema-predictor.ts (partial)
- [ ] prompts/schema-generation-first.txt
- [ ] Initial schema generation working

### Subagent Assignment: `general-purpose`

---

## Iteration 6B: Schema Predictor - Part 2

**Goal**: Implement iterative refinement and validation
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Implement refinement iteration logic
2. Create refinement prompt template
3. Implement schema validation
4. Add schema versioning and storage
5. Complete tests

### Deliverables:
- [ ] Complete schema-predictor.ts
- [ ] prompts/schema-generation-refine.txt
- [ ] Schema validation working
- [ ] Full test suite

### Subagent Assignment: `general-purpose`

---

## Iteration 7A: Record Extractor - Part 1

**Goal**: Implement single record extraction
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Create `src/ingestion/record-extractor.ts`
2. Implement single record extraction
3. Create extraction prompt template
4. Implement JSON parsing
5. Add basic type validation

### Deliverables:
- [ ] src/ingestion/record-extractor.ts (partial)
- [ ] prompts/record-extraction.txt
- [ ] Single record extraction working

### Subagent Assignment: `general-purpose`

---

## Iteration 7B: Record Extractor - Part 2

**Goal**: Implement batch processing and standardization
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Implement batch extraction with concurrency
2. Implement value standardization (1M → 1000000, etc.)
3. Implement type coercion
4. Handle null/missing values
5. Add comprehensive tests

### Deliverables:
- [ ] Complete record-extractor.ts
- [ ] Batch processing working
- [ ] Standardization rules implemented
- [ ] Full test suite

### Subagent Assignment: `general-purpose`

---

## Iteration 8: Statistics Calculator

**Goal**: Implement column statistics calculation
**Estimated Time**: 2-3 hours
**Status**: Pending

### Tasks:
1. Create `src/ingestion/statistics-calculator.ts`
2. Implement numeric statistics (min, max, mean)
3. Implement categorical statistics (unique values)
4. Integrate with database manager
5. Add tests

### Deliverables:
- [ ] src/ingestion/statistics-calculator.ts
- [ ] Statistics calculation working
- [ ] Integration tests

### Subagent Assignment: `general-purpose`

---

## Iteration 9: Text-to-SQL Translator

**Goal**: Implement natural language to SQL translation
**Estimated Time**: 5-6 hours
**Status**: Pending

### Tasks:
1. Create `src/inference/text-to-sql.ts`
2. Implement prompt building with schema + statistics
3. Implement SQL extraction from LLM response
4. Implement SQL validation and sanitization
5. Add SQL parser integration
6. Create comprehensive tests

### Deliverables:
- [ ] src/inference/text-to-sql.ts
- [ ] prompts/text-to-sql.txt
- [ ] SQL validation working
- [ ] Test suite

### Subagent Assignment: `general-purpose`

---

## Iteration 10: Query Executor

**Goal**: Implement safe SQL execution
**Estimated Time**: 2-3 hours
**Status**: Pending

### Tasks:
1. Create `src/inference/query-executor.ts`
2. Implement parameterized query execution
3. Add result formatting
4. Handle pagination
5. Add error handling

### Deliverables:
- [ ] src/inference/query-executor.ts
- [ ] Safe query execution
- [ ] Tests

### Subagent Assignment: `general-purpose`

---

## Iteration 11: Answer Generator

**Goal**: Implement natural language answer generation
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Create `src/inference/answer-generator.ts`
2. Implement result formatting
3. Create answer generation prompt
4. Implement answer generation
5. Add tests

### Deliverables:
- [ ] src/inference/answer-generator.ts
- [ ] prompts/answer-generation.txt
- [ ] Answer generation working
- [ ] Tests

### Subagent Assignment: `general-purpose`

---

## Iteration 12: Evaluator - Answer Comparison

**Goal**: Implement LLM-as-judge for answer evaluation
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Create `src/evaluation/evaluator.ts`
2. Implement answer comparison metric
3. Create evaluation prompts
4. Add basic tests

### Deliverables:
- [ ] src/evaluation/evaluator.ts (partial)
- [ ] Answer comparison working

### Subagent Assignment: `general-purpose`

---

## Iteration 13: Evaluator - Answer Recall

**Goal**: Implement answer recall metric
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Implement claim decomposition
2. Implement claim coverage checking
3. Implement recall calculation
4. Add dataset evaluation function
5. Complete tests

### Deliverables:
- [ ] Complete evaluator.ts
- [ ] Answer recall working
- [ ] Full test suite

### Subagent Assignment: `general-purpose`

---

## Iteration 14: Metrics & Reporting

**Goal**: Implement metrics calculation and reporting
**Estimated Time**: 2-3 hours
**Status**: Pending

### Tasks:
1. Create `src/evaluation/metrics.ts`
2. Implement metric aggregation
3. Create report generation
4. Add visualization helpers

### Deliverables:
- [ ] src/evaluation/metrics.ts
- [ ] Reporting system

### Subagent Assignment: `general-purpose`

---

## Iteration 15: End-to-End Integration

**Goal**: Create main orchestration and integration
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Create `src/index.ts` - Main entry point
2. Implement ingestion pipeline orchestration
3. Implement inference pipeline orchestration
4. Create integration tests
5. Test end-to-end workflow

### Deliverables:
- [ ] src/index.ts
- [ ] End-to-end ingestion working
- [ ] End-to-end inference working
- [ ] Integration tests

### Subagent Assignment: `general-purpose`

---

## Iteration 16: CLI Interface

**Goal**: Implement command-line interface
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Create `src/cli.ts`
2. Implement `ingest` command
3. Implement `query` command
4. Implement `evaluate` command
5. Add progress indicators with ora
6. Add help text and examples

### Deliverables:
- [ ] src/cli.ts
- [ ] All CLI commands working
- [ ] User-friendly interface

### Subagent Assignment: `general-purpose`

---

## Iteration 17: REST API

**Goal**: Implement REST API endpoints
**Estimated Time**: 5-6 hours
**Status**: Pending

### Tasks:
1. Create `src/api.ts`
2. Implement POST /ingest endpoint
3. Implement POST /query endpoint
4. Implement GET /schema/:id endpoint
5. Implement GET /stats/:id endpoint
6. Add error handling and validation
7. Add API tests

### Deliverables:
- [ ] src/api.ts
- [ ] All endpoints working
- [ ] API tests

### Subagent Assignment: `general-purpose`

---

## Iteration 18: API Documentation

**Goal**: Create API documentation and examples
**Estimated Time**: 3-4 hours
**Status**: Pending

### Tasks:
1. Set up Swagger/OpenAPI
2. Document all endpoints
3. Create example requests/responses
4. Add API usage guide

### Deliverables:
- [ ] OpenAPI specification
- [ ] API documentation
- [ ] Usage examples

### Subagent Assignment: `general-purpose`

---

## Iteration 19: Examples & Demos

**Goal**: Create working examples
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Create `examples/hotels-example.ts`
2. Create `examples/worldcup-example.ts`
3. Create `examples/custom-corpus-example.ts`
4. Add example data files
5. Document examples

### Deliverables:
- [ ] 3 working examples
- [ ] Example documentation

### Subagent Assignment: `general-purpose`

---

## Iteration 20: Documentation & Polish

**Goal**: Complete documentation and final polish
**Estimated Time**: 4-5 hours
**Status**: Pending

### Tasks:
1. Write comprehensive README.md
2. Create docs/architecture.md
3. Create docs/quickstart.md
4. Create docs/evaluation.md
5. Add code comments
6. Final code review and cleanup

### Deliverables:
- [ ] Complete README.md
- [ ] Architecture documentation
- [ ] Quickstart guide
- [ ] Evaluation guide

### Subagent Assignment: `general-purpose`

---

## Summary

**Total Iterations**: 20
**Estimated Total Time**: 70-90 hours
**Phases Covered**: All 5 phases from implementation plan

### Phase Mapping:
- **Phase 1 (Foundation)**: Iterations 1-5
- **Phase 2 (Ingestion)**: Iterations 6-8
- **Phase 3 (Inference)**: Iterations 9-11
- **Phase 4 (Evaluation)**: Iterations 12-14
- **Phase 5 (API & Interface)**: Iterations 15-18
- **Final Polish**: Iterations 19-20

### Notes:
- Each iteration is designed to be completed by a single subagent
- Large tasks (Schema Predictor, Record Extractor) are split into parts
- Dependencies between iterations are minimized
- Progress tracked in SCRATCHPAD.md
- All code should include tests
