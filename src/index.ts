/**
 * S-RAG: Structured RAG for Answering Aggregative Questions
 * Main entry point and orchestration functions
 */

import dotenv from 'dotenv';
import { LLMClient } from './llm/llm-client.js';
import { DatabaseManager } from './database/database-manager.js';
import { SchemaPredictor } from './ingestion/schema-predictor.js';
import { RecordExtractor } from './ingestion/record-extractor.js';
import { TextToSQL } from './inference/text-to-sql.js';
import { AnswerGenerator } from './inference/answer-generator.js';
import { Evaluator } from './evaluation/evaluator.js';
import { JSONSchema } from './models/schema.js';
import { Record as SRAGRecord } from './models/record.js';
import { logger } from './utils/logger.js';
import { getConfig } from './utils/config.js';
import type { TableStatistics } from './models/types.js';

// Load environment variables
dotenv.config();

// Load config at module level
const config = getConfig();

/**
 * Options for ingestion pipeline
 */
export interface IngestionOptions {
  documents: string[];
  questions: string[];
  dbPath: string;
  tableName: string;
  sampleSize?: number;
  questionSampleSize?: number;
  batchSize?: number;
  schema?: JSONSchema;
}

/**
 * Result from ingestion pipeline
 */
export interface IngestionResult {
  schema: JSONSchema;
  tableName: string;
  dbPath: string;
  recordCount: number;
  statistics: TableStatistics;
  schemaPath?: string;
}

/**
 * Options for query pipeline
 */
export interface QueryOptions {
  question: string;
  dbPath: string;
  tableName: string;
  schema?: JSONSchema;
  statistics?: TableStatistics;
  schemaPath?: string;
}

/**
 * Result from query pipeline
 */
export interface QueryResult {
  question: string;
  sql: string;
  results: unknown[];
  answer: string;
  metadata?: {
    sqlGenerationTime?: number;
    executionTime?: number;
    answerGenerationTime?: number;
    totalTime: number;
  };
}

/**
 * Options for evaluation
 */
export interface EvaluationOptions {
  testCases: Array<{
    question: string;
    gold_answer: string;
    predicted_answer: string;
  }>;
}

/**
 * Result from evaluation
 */
export interface EvaluationResultAPI {
  answer_comparison: number;
  answer_recall: number;
  num_examples: number;
  per_example_results: Array<{
    question: string;
    is_correct: boolean;
    recall: number;
  }>;
}

/**
 * Run complete ingestion pipeline
 */
export async function runIngestion(
  options: IngestionOptions
): Promise<IngestionResult> {
  const startTime = Date.now();
  logger.info('Starting ingestion pipeline', {
    documentCount: options.documents.length,
    questionCount: options.questions.length,
    tableName: options.tableName,
  });

  try {
    const llmClient = new LLMClient(
      config.OPENAI_API_KEY,
      config.ANTHROPIC_API_KEY
    );

    let schema: JSONSchema;
    if (options.schema) {
      logger.info('Using provided schema');
      schema = options.schema;
    } else {
      logger.info('Generating schema from sample documents and questions');
      const predictor = new SchemaPredictor(llmClient);
      schema = await predictor.predictSchema(
        options.documents.slice(0, options.sampleSize || 12),
        options.questions.slice(0, options.questionSampleSize || 10)
      );
      logger.info('Schema generation complete', {
        attributeCount: Object.keys(schema.properties).length,
      });

      await predictor.saveSchema(schema, options.tableName);
    }

    logger.info('Creating database table');
    const db = new DatabaseManager(options.dbPath);
    db.createTableFromSchema(schema, options.tableName);

    logger.info('Extracting records from documents');
    const extractor = new RecordExtractor(llmClient);
    const records = await extractor.batchExtract(
      options.documents,
      schema,
      options.batchSize || 10
    );
    logger.info('Record extraction complete', { recordCount: records.length });

    logger.info('Inserting records into database');
    db.insertRecords(records, options.tableName);

    logger.info('Calculating column statistics');
    const statistics = db.getColumnStatistics(options.tableName);

    db.close();

    const duration = Date.now() - startTime;
    logger.info('Ingestion pipeline complete', {
      duration: `${duration}ms`,
      recordCount: records.length,
    });

    return {
      schema,
      tableName: options.tableName,
      dbPath: options.dbPath,
      recordCount: records.length,
      statistics,
    };
  } catch (error) {
    logger.error('Ingestion pipeline failed', { error });
    throw error;
  }
}

/**
 * Run query pipeline
 */
export async function runQuery(options: QueryOptions): Promise<QueryResult> {
  const startTime = Date.now();
  logger.info('Starting query pipeline', { question: options.question });

  try {
    const llmClient = new LLMClient(
      config.OPENAI_API_KEY,
      config.ANTHROPIC_API_KEY
    );

    const db = new DatabaseManager(options.dbPath);

    let schema: JSONSchema;
    if (options.schema) {
      schema = options.schema;
    } else if (options.schemaPath) {
      const predictor = new SchemaPredictor(llmClient);
      schema = await predictor.loadSchema(options.schemaPath);
    } else {
      throw new Error('Schema or schemaPath must be provided');
    }

    let statistics: TableStatistics;
    if (options.statistics) {
      statistics = options.statistics;
    } else {
      logger.info('Calculating column statistics');
      statistics = db.getColumnStatistics(options.tableName);
    }

    const sqlStartTime = Date.now();
    logger.info('Translating question to SQL');
    const translator = new TextToSQL(llmClient);
    const sql = await translator.translate(
      options.question,
      schema,
      statistics,
      options.tableName
    );
    const sqlDuration = Date.now() - sqlStartTime;

    const execStartTime = Date.now();
    const queryResults = db.executeQuery(sql);
    const results = Array.isArray(queryResults) ? queryResults : [];
    const execDuration = Date.now() - execStartTime;

    const answerStartTime = Date.now();
    const generator = new AnswerGenerator(llmClient);
    const answerResult = await generator.generateAnswer(options.question, results, sql);
    const answerDuration = Date.now() - answerStartTime;

    db.close();

    const totalDuration = Date.now() - startTime;

    return {
      question: options.question,
      sql,
      results,
      answer: answerResult.answer,
      metadata: {
        sqlGenerationTime: sqlDuration,
        executionTime: execDuration,
        answerGenerationTime: answerDuration,
        totalTime: totalDuration,
      },
    };
  } catch (error) {
    logger.error('Query pipeline failed', { error });
    throw error;
  }
}

/**
 * Run evaluation on test cases
 */
export async function runEvaluation(
  options: EvaluationOptions
): Promise<EvaluationResultAPI> {
  const startTime = Date.now();
  logger.info('Starting evaluation', {
    testCaseCount: options.testCases.length,
  });

  try {
    const llmClient = new LLMClient(
      config.OPENAI_API_KEY,
      config.ANTHROPIC_API_KEY
    );

    const evaluator = new Evaluator(llmClient);

    const testCases = options.testCases.map((tc) => ({
      question: tc.question,
      goldAnswer: tc.gold_answer,
      predictedAnswer: tc.predicted_answer,
    }));

    const result = await evaluator.evaluateDataset(testCases);

    const duration = Date.now() - startTime;
    logger.info('Evaluation complete', {
      duration: `${duration}ms`,
      accuracy: result.answerComparison,
      recall: result.answerRecall,
    });

    return {
      answer_comparison: result.answerComparison,
      answer_recall: result.answerRecall,
      num_examples: result.numExamples,
      per_example_results: result.perExampleResults.map((ex) => ({
        question: ex.question,
        is_correct: ex.isCorrect,
        recall: ex.recall,
      })),
    };
  } catch (error) {
    logger.error('Evaluation failed', { error });
    throw error;
  }
}

function main(): void {
  console.log('S-RAG - Structured RAG for Answering Aggregative Questions');
  console.log('TypeScript Implementation v1.0.0');
  console.log('');
  console.log('Available functions:');
  console.log('  - runIngestion(options): Run ingestion pipeline');
  console.log('  - runQuery(options): Run query pipeline');
  console.log('  - runEvaluation(options): Run evaluation');
  console.log('');
  console.log('Use the CLI (srag command) or import these functions in your code.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

export {
  LLMClient,
  DatabaseManager,
  SchemaPredictor,
  RecordExtractor,
  TextToSQL,
  AnswerGenerator,
  Evaluator,
  JSONSchema,
  SRAGRecord,
};
