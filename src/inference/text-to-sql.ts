/**
 * Text-to-SQL Translator
 *
 * Converts natural language queries to SQL using LLM.
 * Includes prompt building, SQL extraction, and validation.
 */

import * as sqlParser from 'node-sql-parser';
import { LLMClient } from '../llm/llm-client.js';
import { JSONSchema } from '../models/schema.js';
import { createLogger } from '../utils/logger.js';
import { readFileAsText } from '../utils/helpers.js';
import { SQLError } from '../models/types.js';
import type { TableStatistics } from '../models/types.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger({ module: 'text-to-sql' });

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * TextToSQL class for translating natural language to SQL queries
 *
 * @example
 * ```typescript
 * const llm = new LLMClient();
 * const translator = new TextToSQL(llm);
 * const sql = await translator.translate(
 *   'What is the average rating?',
 *   schema,
 *   statistics,
 *   'hotels'
 * );
 * console.log(sql); // SELECT AVG(rating) FROM hotels
 * ```
 */
export class TextToSQL {
  private llm: LLMClient;
  private parser: sqlParser.Parser;
  private promptTemplate?: string;

  /**
   * Creates a new TextToSQL instance
   *
   * @param llmClient - LLM client for generating SQL
   *
   * @example
   * ```typescript
   * const llm = new LLMClient();
   * const translator = new TextToSQL(llm);
   * ```
   */
  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
    this.parser = new sqlParser.Parser();
    logger.debug('TextToSQL initialized');
  }

  /**
   * Translates a natural language question to SQL
   *
   * @param question - Natural language query
   * @param schema - Database schema
   * @param statistics - Column statistics for disambiguation
   * @param tableName - Name of the table to query
   * @param options - Optional generation options
   * @returns SQL query string
   *
   * @throws {SQLError} If SQL generation or validation fails
   *
   * @example
   * ```typescript
   * const sql = await translator.translate(
   *   'Find hotels in New York with rating above 4',
   *   schema,
   *   statistics,
   *   'hotels'
   * );
   * ```
   */
  async translate(
    question: string,
    schema: JSONSchema,
    statistics: TableStatistics,
    tableName: string,
    options?: {
      model?: string;
      temperature?: number;
    }
  ): Promise<string> {
    logger.info('Translating natural language to SQL', {
      question,
      tableName,
    });

    try {
      // Build prompt with schema and statistics
      const prompt = await this.buildPrompt(question, schema, statistics, tableName);

      // Call LLM
      const response = await this.llm.generate(prompt, {
        model: (options?.model || 'gpt-4o') as 'gpt-4o',
        temperature: options?.temperature ?? 0.0, // Use 0 for deterministic SQL generation
        maxTokens: 500,
      });

      logger.debug('LLM response received', {
        contentLength: response.content.length,
      });

      // Extract SQL from response
      const sql = this.extractSql(response.content);

      logger.debug('SQL extracted', { sql });

      // Validate SQL
      if (!this.validateSql(sql, tableName)) {
        throw new SQLError(`Invalid or unsafe SQL generated: ${sql}`);
      }

      logger.info('SQL translation successful', {
        question,
        sql,
      });

      return sql;
    } catch (error) {
      logger.error('SQL translation failed', error as Error, {
        question,
        tableName,
      });

      if (error instanceof SQLError) {
        throw error;
      }

      throw new SQLError(
        `Failed to translate question to SQL: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Builds a prompt with schema and statistics
   *
   * @param question - Natural language query
   * @param schema - Database schema
   * @param statistics - Column statistics
   * @param tableName - Name of the table
   * @returns Formatted prompt string
   *
   * @example
   * ```typescript
   * const prompt = await translator.buildPrompt(
   *   'What is the average rating?',
   *   schema,
   *   statistics,
   *   'hotels'
   * );
   * ```
   */
  async buildPrompt(
    question: string,
    schema: JSONSchema,
    statistics: TableStatistics,
    tableName: string
  ): Promise<string> {
    // Load prompt template if not already loaded
    if (!this.promptTemplate) {
      const promptPath = path.resolve(__dirname, '../../prompts/text-to-sql.txt');
      const result = await readFileAsText(promptPath);
      if (!result.success) {
        throw new SQLError(`Failed to load prompt template: ${result.error.message}`);
      }
      this.promptTemplate = result.data;
      logger.debug('Prompt template loaded', { promptPath });
    }

    // Build schema section
    const schemaLines: string[] = [];
    for (const [attrName, attrDef] of Object.entries(schema.properties)) {
      schemaLines.push(`- ${attrName} (${attrDef.type}): ${attrDef.description}`);
    }
    const schemaText = schemaLines.join('\n');

    // Build statistics section
    const statsLines: string[] = [];
    for (const [colName, colStats] of Object.entries(statistics)) {
      if (colStats.type === 'numeric') {
        // Format numbers for display
        // Use String() to get natural representation (integers without .0, floats as-is)
        statsLines.push(
          `- ${colName}: range ${colStats.min} to ${colStats.max}, average ${colStats.mean.toFixed(2)}`
        );
      } else {
        // Categorical
        const uniqueVals = colStats.uniqueValues.slice(0, 10); // Limit to 10
        const valuesStr =
          colStats.uniqueValues.length <= 10
            ? `values: [${uniqueVals.join(', ')}]`
            : `example values: [${uniqueVals.join(', ')}] (${colStats.count} unique total)`;
        statsLines.push(`- ${colName}: ${valuesStr}`);
      }
    }
    const statisticsText = statsLines.join('\n');

    // Replace placeholders in template
    const prompt = this.promptTemplate
      .replace('{{TABLE_NAME}}', tableName)
      .replace('{{SCHEMA}}', schemaText)
      .replace('{{STATISTICS}}', statisticsText)
      .replace('{{QUESTION}}', question);

    return prompt;
  }

  /**
   * Extracts SQL from LLM response
   *
   * Handles various response formats:
   * - SQL in markdown code blocks (```sql ... ```)
   * - Plain SELECT statements
   * - SQL with trailing semicolons
   *
   * @param response - LLM response text
   * @returns Extracted SQL query
   *
   * @example
   * ```typescript
   * const sql = translator.extractSql('```sql\nSELECT * FROM hotels;\n```');
   * // Returns: 'SELECT * FROM hotels'
   * ```
   */
  extractSql(response: string): string {
    // Try to find SQL in code blocks first
    const codeBlockMatch = response.match(/```sql\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      const sql = codeBlockMatch[1].trim();
      return this.cleanSql(sql);
    }

    // Try to find SQL in generic code blocks
    const genericCodeBlockMatch = response.match(/```\s*([\s\S]*?)```/);
    if (genericCodeBlockMatch) {
      const sql = genericCodeBlockMatch[1].trim();
      // Check if it looks like SQL
      if (sql.toUpperCase().startsWith('SELECT')) {
        return this.cleanSql(sql);
      }
    }

    // Try to find SELECT statement
    const selectMatch = response.match(/SELECT[\s\S]*?(?:;|$)/im);
    if (selectMatch) {
      const sql = selectMatch[0].trim();
      return this.cleanSql(sql);
    }

    // Return as-is if nothing else works (will fail validation)
    return this.cleanSql(response.trim());
  }

  /**
   * Cleans SQL query by removing trailing semicolons and extra whitespace
   *
   * @param sql - SQL query to clean
   * @returns Cleaned SQL query
   */
  private cleanSql(sql: string): string {
    // Remove trailing semicolon
    sql = sql.replace(/;+$/, '');
    // Normalize whitespace
    sql = sql.replace(/\s+/g, ' ').trim();
    return sql;
  }

  /**
   * Validates SQL syntax and safety
   *
   * Checks:
   * - Only SELECT statements allowed (no DROP, DELETE, INSERT, UPDATE, etc.)
   * - No SQL injection patterns
   * - Valid SQL syntax using node-sql-parser
   * - Table name is referenced in query
   *
   * @param sql - SQL query to validate
   * @param tableName - Expected table name
   * @returns true if valid, false otherwise
   *
   * @example
   * ```typescript
   * const isValid = translator.validateSql('SELECT * FROM hotels', 'hotels');
   * console.log(isValid); // true
   *
   * const isInvalid = translator.validateSql('DROP TABLE hotels', 'hotels');
   * console.log(isInvalid); // false
   * ```
   */
  validateSql(sql: string, tableName: string): boolean {
    if (!sql || sql.trim().length === 0) {
      logger.warn('Empty SQL query');
      return false;
    }

    const sqlUpper = sql.trim().toUpperCase();

    // Only allow SELECT statements
    if (!sqlUpper.startsWith('SELECT')) {
      logger.warn('SQL does not start with SELECT', { sql });
      return false;
    }

    // Disallow dangerous operations
    const dangerousKeywords = [
      'DROP',
      'DELETE',
      'INSERT',
      'UPDATE',
      'ALTER',
      'CREATE',
      'TRUNCATE',
      'REPLACE',
      'EXEC',
      'EXECUTE',
      'PRAGMA',
    ];

    // Remove string literals before checking for dangerous keywords
    // This prevents false positives like: SELECT * FROM hotels WHERE name = "DELETE Hotel"
    const sqlWithoutStrings = sql
      .replace(/"[^"]*"/g, '""') // Remove double-quoted strings
      .replace(/'[^']*'/g, "''"); // Remove single-quoted strings

    for (const keyword of dangerousKeywords) {
      // Use word boundaries to avoid false positives (e.g., "DESCRIPTION" contains "DROP")
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(sqlWithoutStrings)) {
        logger.warn('SQL contains dangerous keyword', { sql, keyword });
        return false;
      }
    }

    // Check for common SQL injection patterns
    const injectionPatterns = [
      /--/, // SQL comments
      /\/\*/, // Block comments
      /;.*SELECT/i, // Multiple statements
      /UNION.*SELECT/i, // UNION injection (if not in subquery context)
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(sql)) {
        logger.warn('SQL contains potential injection pattern', {
          sql,
          pattern: pattern.toString(),
        });
        return false;
      }
    }

    // Check table name is referenced
    // Use case-insensitive check
    const tableNamePattern = new RegExp(`\\bFROM\\s+${tableName}\\b`, 'i');
    if (!tableNamePattern.test(sql)) {
      logger.warn('SQL does not reference expected table', {
        sql,
        expectedTable: tableName,
      });
      return false;
    }

    // Try to parse SQL (basic syntax validation)
    // Note: The parser might not support all SQLite features (e.g., complex subqueries)
    try {
      this.parser.astify(sql, { database: 'sqlite' });
      logger.debug('SQL syntax validation passed', { sql });
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for basic SQL structure before being lenient
      // If the SQL is missing basic components (SELECT columns, FROM table), it should fail
      const hasSelectClause = /SELECT\s+.+\s+FROM\s+\w+/i.test(sql);

      if (!hasSelectClause) {
        // Clearly broken SQL structure
        logger.warn('SQL syntax validation failed', {
          sql,
          error: errorMsg,
        });
        return false;
      }

      // If it has basic structure but parser fails, it might be using
      // advanced features not supported by the parser - allow it
      logger.debug('SQL parser warning (has basic structure, allowing)', {
        sql,
        error: errorMsg,
      });
      return true;
    }
  }

  /**
   * Gets information about the parser and validation rules
   *
   * @returns Validation rules information
   */
  getValidationRules(): {
    allowedStatements: string[];
    forbiddenKeywords: string[];
    injectionPatterns: string[];
  } {
    return {
      allowedStatements: ['SELECT'],
      forbiddenKeywords: [
        'DROP',
        'DELETE',
        'INSERT',
        'UPDATE',
        'ALTER',
        'CREATE',
        'TRUNCATE',
        'REPLACE',
        'EXEC',
        'EXECUTE',
        'PRAGMA',
      ],
      injectionPatterns: [
        'SQL comments (--)',
        'Block comments (/* */)',
        'Multiple statements (;)',
        'UNION injection',
      ],
    };
  }
}

/**
 * Creates a TextToSQL instance with a default LLM client
 *
 * @param llmClient - Optional LLM client (creates default if not provided)
 * @returns TextToSQL instance
 *
 * @example
 * ```typescript
 * const translator = createTextToSQL();
 * const sql = await translator.translate(question, schema, statistics, tableName);
 * ```
 */
export function createTextToSQL(llmClient?: LLMClient): TextToSQL {
  const client = llmClient || new LLMClient();
  return new TextToSQL(client);
}
