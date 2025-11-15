/**
 * Pipeline Orchestration
 *
 * High-level orchestration functions for end-to-end workflows.
 * Coordinates ingestion and inference pipelines.
 */

import { LLMClient } from '../llm/llm-client.js';
import { SchemaPredictor } from '../ingestion/schema-predictor.js';
import { RecordExtractor } from '../ingestion/record-extractor.js';
import { DatabaseManager } from '../database/database-manager.js';
import { TextToSQL } from '../inference/text-to-sql.js';
import { AnswerGenerator } from '../inference/answer-generator.js';
import { QueryExecutor } from '../inference/query-executor.js';
import { JSONSchema } from '../models/schema.js';
import type {
  TableStatistics,
  LLMModel,
  RecordData,
} from '../models/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'pipeline' });

/**
 * Options for ingestion pipeline
 */
export interface IngestionOptions {
  /** Path to SQLite database file */
  dbPath: string;
  /** Name of table to create */
  tableName: string;
  /** Number of sample documents to use for schema generation */
  numSampleDocs?: number;
  /** Number of sample questions to use for schema generation */
  numSampleQuestions?: number;
  /** Batch size for record extraction */
  batchSize?: number;
  /** LLM model for schema generation */
  schemaModel?: LLMModel;
  /** LLM model for record extraction */
  extractionModel?: LLMModel;
  /** Schema refinement iterations (default: 3) */
  refinementIterations?: number;
}

/**
 * Result of ingestion pipeline
 */
export interface IngestionResult {
  /** Generated schema */
  schema: JSONSchema;
  /** Number of records inserted */
  recordCount: number;
  /** Column statistics */
  statistics: TableStatistics;
  /** Table name */
  tableName: string;
  /** Database path */
  dbPath: string;
}

/**
 * Options for inference pipeline
 */
export interface InferenceOptions {
  /** Path to SQLite database file */
  dbPath: string;
  /** Name of table to query */
  tableName: string;
  /** Schema of the table */
  schema: JSONSchema;
  /** Column statistics for the table */
  statistics: TableStatistics;
  /** LLM model for text-to-SQL */
  sqlModel?: LLMModel;
  /** LLM model for answer generation */
  answerModel?: LLMModel;
  /** Whether to include SQL in response */
  includeSql?: boolean;
  /** Whether to include raw results in response */
  includeResults?: boolean;
}

/**
 * Result of inference pipeline
 */
export interface InferenceResult {
  /** Original question */
  question: string;
  /** Generated SQL query */
  sql: string;
  /** Query results */
  results: RecordData[];
  /** Natural language answer */
  answer: string;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Ingest documents into a structured database
 *
 * This orchestrates the full ingestion pipeline:
 * 1. Predict schema from sample documents and questions
 * 2. Create database table from schema
 * 3. Extract records from all documents
 * 4. Insert records into database
 * 5. Calculate column statistics
 *
 * @param documents - Array of document texts to ingest
 * @param questions - Sample questions to inform schema generation
 * @param options - Ingestion configuration options
 * @param llmClient - Optional LLM client (will create default if not provided)
 * @returns Ingestion result with schema, record count, and statistics
 *
 * @example
 * ```typescript
 * const result = await ingestDocuments(
 *   ['Hotel A: 5 stars...', 'Hotel B: 4 stars...'],
 *   ['What is the average rating?', 'How many hotels have pools?'],
 *   {
 *     dbPath: 'data/databases/hotels.db',
 *     tableName: 'hotels',
 *     numSampleDocs: 10,
 *     numSampleQuestions: 5
 *   }
 * );
 * console.log(`Ingested ${result.recordCount} records`);
 * ```
 */
export async function ingestDocuments(
  documents: string[],
  questions: string[],
  options: IngestionOptions,
  llmClient?: LLMClient
): Promise<IngestionResult> {
  const startTime = Date.now();
  logger.info('Starting ingestion pipeline', {
    numDocuments: documents.length,
    numQuestions: questions.length,
    tableName: options.tableName,
  });

  try {
    // Initialize LLM client if not provided
    const llm = llmClient || new LLMClient();

    // Step 1: Predict schema from sample documents and questions
    logger.info('Step 1: Predicting schema...');
    const predictor = new SchemaPredictor(llm);

    const numSampleDocs = Math.min(
      options.numSampleDocs || 12,
      documents.length
    );
    const numSampleQuestions = Math.min(
      options.numSampleQuestions || 10,
      questions.length
    );

    const sampleDocs = documents.slice(0, numSampleDocs);
    const sampleQuestions = questions.slice(0, numSampleQuestions);

    const schema = await predictor.predictSchema(
      sampleDocs,
      sampleQuestions,
      numSampleDocs,
      numSampleQuestions,
      options.schemaModel || 'gpt-4o'
    );

    logger.info('Schema generated', {
      title: schema.title,
      numProperties: Object.keys(schema.properties).length,
    });

    // Step 2: Create database table from schema
    logger.info('Step 2: Creating database table...');
    const db = new DatabaseManager(options.dbPath);

    // Drop table if it exists (for clean ingestion)
    if (db.tableExists(options.tableName)) {
      logger.warn(`Table ${options.tableName} already exists, dropping...`);
      db.dropTable(options.tableName);
    }

    db.createTableFromSchema(schema, options.tableName);
    logger.info(`Table ${options.tableName} created`);

    // Step 3: Extract records from all documents
    logger.info('Step 3: Extracting records from documents...');
    const extractor = new RecordExtractor(llm);

    const records = await extractor.batchExtract(
      documents,
      schema,
      options.batchSize,
      { model: options.extractionModel || 'gpt-4o' }
    );

    logger.info(`Extracted ${records.length} records`);

    // Step 4: Insert records into database
    logger.info('Step 4: Inserting records into database...');
    db.insertRecords(records, options.tableName);

    const recordCount = db.getRowCount(options.tableName);
    logger.info(`Inserted ${recordCount} records`);

    // Step 5: Calculate column statistics
    logger.info('Step 5: Calculating statistics...');
    const statistics = db.getColumnStatistics(options.tableName);

    logger.info('Statistics calculated', {
      numColumns: Object.keys(statistics).length,
    });

    const duration = Date.now() - startTime;
    logger.info('Ingestion pipeline completed', {
      duration: `${(duration / 1000).toFixed(2)}s`,
      recordCount,
    });

    return {
      schema,
      recordCount,
      statistics,
      tableName: options.tableName,
      dbPath: options.dbPath,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Ingestion pipeline failed', {
      error: error instanceof Error ? error.message : String(error),
      duration: `${(duration / 1000).toFixed(2)}s`,
    });
    throw error;
  }
}

/**
 * Answer a question using the inference pipeline
 *
 * This orchestrates the full inference pipeline:
 * 1. Translate question to SQL using schema and statistics
 * 2. Execute SQL query on database
 * 3. Format results
 * 4. Generate natural language answer
 *
 * @param question - Natural language question to answer
 * @param options - Inference configuration options
 * @param llmClient - Optional LLM client (will create default if not provided)
 * @returns Inference result with SQL, results, and natural language answer
 *
 * @example
 * ```typescript
 * const result = await answerQuestion(
 *   'What is the average rating for hotels in Sydney?',
 *   {
 *     dbPath: 'data/databases/hotels.db',
 *     tableName: 'hotels',
 *     schema: mySchema,
 *     statistics: myStatistics
 *   }
 * );
 * console.log(result.answer);
 * ```
 */
export async function answerQuestion(
  question: string,
  options: InferenceOptions,
  llmClient?: LLMClient
): Promise<InferenceResult> {
  const startTime = Date.now();
  logger.info('Starting inference pipeline', {
    question,
    tableName: options.tableName,
  });

  try {
    // Initialize LLM client if not provided
    const llm = llmClient || new LLMClient();

    // Step 1: Translate question to SQL
    logger.info('Step 1: Translating question to SQL...');
    const translator = new TextToSQL(llm);

    const sql = await translator.translate(
      question,
      options.schema,
      options.statistics,
      options.tableName,
      { model: options.sqlModel || 'gpt-4o' }
    );

    logger.info('SQL generated', { sql });

    // Step 2: Execute SQL query
    logger.info('Step 2: Executing SQL query...');
    const db = new DatabaseManager(options.dbPath);
    const executor = new QueryExecutor(db);

    const queryResult = executor.execute(sql);
    const results = 'rows' in queryResult ? queryResult.rows : [];
    logger.info(`Query returned ${results.length} rows`);

    // Step 3: Generate natural language answer
    logger.info('Step 3: Generating natural language answer...');
    const generator = new AnswerGenerator(llm);

    const answerResult = await generator.generateAnswer(
      question,
      results,
      sql,
      { model: options.answerModel || 'gpt-4o' }
    );

    logger.info('Answer generated', {
      answerLength: answerResult.answer.length,
    });

    const executionTime = Date.now() - startTime;
    logger.info('Inference pipeline completed', {
      executionTime: `${executionTime}ms`,
    });

    return {
      question,
      sql: options.includeSql !== false ? sql : '', // Include by default
      results: options.includeResults !== false ? results : [], // Include by default
      answer: answerResult.answer,
      executionTime,
    };
  } catch (error) {
    const executionTime = Date.now() - startTime;
    logger.error('Inference pipeline failed', {
      error: error instanceof Error ? error.message : String(error),
      executionTime: `${executionTime}ms`,
    });
    throw error;
  }
}

/**
 * Full end-to-end workflow: ingest and query
 *
 * Convenience function that combines ingestion and inference pipelines.
 *
 * @param documents - Documents to ingest
 * @param questions - Sample questions for schema + actual questions to answer
 * @param ingestionOptions - Ingestion configuration
 * @param questionsToAnswer - Specific questions to answer after ingestion
 * @param llmClient - Optional LLM client
 * @returns Ingestion result and array of inference results
 *
 * @example
 * ```typescript
 * const { ingestion, answers } = await runFullPipeline(
 *   documents,
 *   sampleQuestions,
 *   { dbPath: 'data/test.db', tableName: 'data' },
 *   ['What is the average value?', 'How many items?']
 * );
 * ```
 */
export async function runFullPipeline(
  documents: string[],
  questions: string[],
  ingestionOptions: IngestionOptions,
  questionsToAnswer: string[],
  llmClient?: LLMClient
): Promise<{
  ingestion: IngestionResult;
  answers: InferenceResult[];
}> {
  logger.info('Starting full pipeline', {
    numDocuments: documents.length,
    numQuestions: questionsToAnswer.length,
  });

  // Step 1: Ingest documents
  const ingestion = await ingestDocuments(
    documents,
    questions,
    ingestionOptions,
    llmClient
  );

  // Step 2: Answer questions
  const answers: InferenceResult[] = [];

  for (const question of questionsToAnswer) {
    const result = await answerQuestion(
      question,
      {
        dbPath: ingestion.dbPath,
        tableName: ingestion.tableName,
        schema: ingestion.schema,
        statistics: ingestion.statistics,
      },
      llmClient
    );
    answers.push(result);
  }

  logger.info('Full pipeline completed', {
    recordCount: ingestion.recordCount,
    questionsAnswered: answers.length,
  });

  return { ingestion, answers };
}
