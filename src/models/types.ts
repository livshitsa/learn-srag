/**
 * Type definitions for S-RAG system
 *
 * This file contains all TypeScript interfaces and types used throughout the application.
 */

/**
 * LLM Provider Types
 */
export type ModelProvider = 'openai' | 'anthropic';

export type OpenAIModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'o1-preview'
  | 'o1-mini';

export type AnthropicModel =
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';

export type LLMModel = OpenAIModel | AnthropicModel;

/**
 * LLM Request/Response Types
 */
export interface LLMGenerateOptions {
  model: LLMModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * JSON Schema Types
 */
export type JSONSchemaType = 'string' | 'number' | 'integer' | 'boolean';

export interface JSONSchemaProperty {
  type: JSONSchemaType;
  description: string;
  examples: Array<string | number | boolean>;
}

export interface JSONSchemaDefinition {
  title: string;
  description: string;
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Record Types
 */
export interface RecordData {
  [key: string]: string | number | boolean | null;
}

/**
 * Database Types
 */
export type SQLType = 'TEXT' | 'INTEGER' | 'REAL';

export interface ColumnInfo {
  name: string;
  type: SQLType;
  notNull: boolean;
  defaultValue: any;
  primaryKey: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

/**
 * Statistics Types
 */
export interface NumericStatistics {
  type: 'numeric';
  min: number;
  max: number;
  mean: number;
  count: number;
}

export interface CategoricalStatistics {
  type: 'categorical';
  uniqueValues: Array<string | number | boolean>;
  count: number;
}

export type ColumnStatistics = NumericStatistics | CategoricalStatistics;

export interface TableStatistics {
  [columnName: string]: ColumnStatistics;
}

/**
 * Query Types
 */
export interface QueryResult {
  rows: RecordData[];
  rowCount: number;
  sql: string;
}

export interface QueryExecutorOptions {
  format?: boolean;
  page?: number;
  pageSize?: number;
  params?: (string | number | boolean | null)[];
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
}

export interface ResultMetadata {
  columns: ColumnMetadata[];
  rowCount: number;
  hasResults: boolean;
}

export interface FormattedQueryResult extends QueryResult {
  metadata: ResultMetadata;
}

export interface PaginatedQueryResult {
  rows: RecordData[];
  rowCount: number;
  sql: string;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  hasMore: boolean;
  hasPrevious: boolean;
}

/**
 * Text-to-SQL Types
 */
export interface TextToSQLRequest {
  question: string;
  schema: JSONSchemaDefinition;
  statistics: TableStatistics;
  tableName: string;
}

export interface TextToSQLResponse {
  sql: string;
  confidence?: number;
}

/**
 * Answer Generation Types
 */
export interface AnswerGenerationRequest {
  question: string;
  sqlQuery: string;
  results: RecordData[];
}

export interface AnswerGenerationResponse {
  answer: string;
  sqlQuery: string;
  resultCount: number;
}

/**
 * Evaluation Types
 */
export interface TestCase {
  question: string;
  goldAnswer: string;
  predictedAnswer: string;
}

export interface EvaluationResult {
  answerComparison: number;
  answerRecall: number;
  numExamples: number;
  perExampleResults: Array<{
    question: string;
    isCorrect: boolean;
    recall: number;
  }>;
}

/**
 * Configuration Types
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgres';
  path?: string; // For SQLite
  host?: string; // For PostgreSQL
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

export interface LLMConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  defaultModel: LLMModel;
  temperature: number;
  maxTokens: number;
}

export interface IngestionConfig {
  numSampleDocuments: number;
  numSampleQuestions: number;
  schemaIterations: number;
  batchSize: number;
}

export interface InferenceConfig {
  sqlValidation: boolean;
  maxRetries: number;
  timeout: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  llm: LLMConfig;
  ingestion: IngestionConfig;
  inference: InferenceConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * API Types
 */
export interface IngestRequest {
  documents: string[];
  questions?: string[];
  tableName: string;
  schemaId?: string;
}

export interface IngestResponse {
  schemaId: string;
  recordCount: number;
  tableName: string;
  message: string;
}

export interface QueryRequest {
  question: string;
  tableName: string;
  schemaId?: string;
}

export interface QueryResponse {
  answer: string;
  sql: string;
  resultCount: number;
  results?: RecordData[];
}

export interface SchemaResponse {
  schemaId: string;
  schema: JSONSchemaDefinition;
  createdAt: string;
}

export interface StatsResponse {
  tableName: string;
  statistics: TableStatistics;
  recordCount: number;
}

/**
 * Error Types
 */
export class SRAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'SRAGError';
  }
}

export class ValidationError extends SRAGError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends SRAGError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
  }
}

export class LLMError extends SRAGError {
  constructor(message: string) {
    super(message, 'LLM_ERROR', 500);
    this.name = 'LLMError';
  }
}

export class SQLError extends SRAGError {
  constructor(message: string) {
    super(message, 'SQL_ERROR', 400);
    this.name = 'SQLError';
  }
}
