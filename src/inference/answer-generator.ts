/**
 * Answer Generator
 *
 * Generates natural language answers from SQL query results.
 */

import { LLMClient } from '../llm/llm-client.js';
import { createLogger } from '../utils/logger.js';
import { readFileAsText } from '../utils/helpers.js';
import { LLMModel } from '../models/types.js';

const logger = createLogger({ module: 'answer-generator' });

/**
 * Options for answer generation
 */
export interface AnswerGenerationOptions {
  /** LLM model to use (default: gpt-4o) */
  model?: LLMModel;
  /** Temperature for generation (default: 0.3 for more factual answers) */
  temperature?: number;
  /** Maximum number of rows to include in context (default: 100) */
  maxRows?: number;
  /** Whether to include the SQL query in the answer (default: false) */
  includeSqlInAnswer?: boolean;
}

/**
 * Result of answer generation
 */
export interface AnswerGenerationResult {
  /** Generated natural language answer */
  answer: string;
  /** Number of results used to generate answer */
  resultCount: number;
  /** Whether results were truncated */
  wasTruncated: boolean;
}

/**
 * Answer Generator for converting SQL results to natural language
 *
 * @example
 * ```typescript
 * const llm = new LLMClient();
 * const generator = new AnswerGenerator(llm);
 *
 * const question = "What are the top 3 hotels by rating?";
 * const sqlQuery = "SELECT name, rating FROM hotels ORDER BY rating DESC LIMIT 3";
 * const sqlResults = [
 *   { name: "Grand Hotel", rating: 4.8 },
 *   { name: "Plaza Hotel", rating: 4.7 },
 *   { name: "Ritz Hotel", rating: 4.6 }
 * ];
 *
 * const result = await generator.generateAnswer(question, sqlResults, sqlQuery);
 * console.log(result.answer);
 * // "The top 3 hotels by rating are Grand Hotel (4.8), Plaza Hotel (4.7), and Ritz Hotel (4.6)."
 * ```
 */
export class AnswerGenerator {
  private llm: LLMClient;
  private promptTemplate: string | null = null;

  /**
   * Create a new Answer Generator
   *
   * @param llmClient - LLM client for generating answers
   */
  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
    logger.info('Answer generator initialized');
  }

  /**
   * Load the answer generation prompt template
   */
  private async loadPromptTemplate(): Promise<string> {
    if (this.promptTemplate) {
      return this.promptTemplate;
    }

    const result = await readFileAsText('prompts/answer-generation.txt');
    if (result.success) {
      this.promptTemplate = result.data;
      logger.debug('Answer generation prompt template loaded');
      return this.promptTemplate;
    }

    logger.warn('Failed to load prompt template, using default', { error: result.error.message });

    // Fallback to inline template
    const defaultTemplate = [
      'You are an expert assistant that provides clear, accurate answers based on SQL query results.',
      '',
      'Your task is to answer the user\'s question using the provided SQL query results.',
      '',
      '# Original Question',
      '{question}',
      '',
      '# SQL Query Executed',
      '```sql',
      '{sql_query}',
      '```',
      '',
      '# Query Results',
      '{results}',
      '',
      '# Instructions',
      '1. Provide a clear, natural language answer to the user\'s question',
      '2. Base your answer strictly on the query results provided',
      '3. If the results contain numerical values, include the exact numbers in your answer',
      '4. If there are multiple results, summarize them appropriately',
      '5. If the results are empty, clearly state that no matching data was found',
      '6. Be concise but complete - aim for 1-3 sentences unless more detail is needed',
      '7. Use natural, conversational language',
      '',
      '# Answer',
      'Provide your answer below:'
    ].join('\n');

    return defaultTemplate;
  }

  /**
   * Generate a natural language answer from SQL query results
   *
   * @param question - The original user question
   * @param sqlResults - Results from executing the SQL query
   * @param sqlQuery - The SQL query that was executed
   * @param options - Generation options
   * @returns Answer generation result with the natural language answer
   *
   * @example
   * ```typescript
   * const result = await generator.generateAnswer(
   *   "How many hotels are there?",
   *   [{ count: 42 }],
   *   "SELECT COUNT(*) as count FROM hotels"
   * );
   * console.log(result.answer); // "There are 42 hotels."
   * ```
   */
  async generateAnswer(
    question: string,
    sqlResults: any[],
    sqlQuery: string,
    options: AnswerGenerationOptions = {}
  ): Promise<AnswerGenerationResult> {
    const maxRows = options.maxRows || 100;
    const model = options.model || 'gpt-4o';
    const temperature = options.temperature ?? 0.3; // Lower temperature for more factual answers

    logger.info('Generating answer', {
      question,
      resultCount: sqlResults.length,
      sqlQueryLength: sqlQuery.length,
      model,
    });

    // Format results for context
    const formattedResults = this.formatResults(sqlResults, maxRows);
    const wasTruncated = sqlResults.length > maxRows;

    // Build prompt from template
    const template = await this.loadPromptTemplate();
    const prompt = template
      .replace('{question}', question)
      .replace('{sql_query}', sqlQuery)
      .replace('{results}', formattedResults);

    // Generate answer using LLM
    try {
      const response = await this.llm.generate(prompt, {
        model,
        temperature,
        maxTokens: 1000,
      });

      const answer = response.content.trim();

      logger.info('Answer generated successfully', {
        answerLength: answer.length,
        resultCount: sqlResults.length,
        wasTruncated,
      });

      return {
        answer,
        resultCount: sqlResults.length,
        wasTruncated,
      };
    } catch (error) {
      logger.error('Failed to generate answer', error as Error, {
        question,
        resultCount: sqlResults.length,
      });
      throw error;
    }
  }

  /**
   * Generate an answer with citation (includes SQL query in the response)
   *
   * @param question - The original user question
   * @param sqlResults - Results from executing the SQL query
   * @param sqlQuery - The SQL query that was executed
   * @param options - Generation options
   * @returns Answer with citation
   *
   * @example
   * ```typescript
   * const result = await generator.generateAnswerWithCitation(
   *   "How many hotels are there?",
   *   [{ count: 42 }],
   *   "SELECT COUNT(*) as count FROM hotels"
   * );
   * console.log(result.answer);
   * // "There are 42 hotels.\n\nSQL Query: SELECT COUNT(*) as count FROM hotels"
   * ```
   */
  async generateAnswerWithCitation(
    question: string,
    sqlResults: any[],
    sqlQuery: string,
    options: AnswerGenerationOptions = {}
  ): Promise<AnswerGenerationResult> {
    const result = await this.generateAnswer(question, sqlResults, sqlQuery, options);

    // Append SQL query as citation
    const answerWithCitation = `${result.answer}\n\n**SQL Query Used:**\n\`\`\`sql\n${sqlQuery}\n\`\`\``;

    return {
      ...result,
      answer: answerWithCitation,
    };
  }

  /**
   * Format SQL results as readable text for LLM context
   *
   * @param results - SQL query results
   * @param maxRows - Maximum number of rows to include (default: 100)
   * @returns Formatted results string
   */
  formatResults(results: any[], maxRows = 100): string {
    // Handle empty results
    if (!results || results.length === 0) {
      return 'No results found.';
    }

    // Handle single result
    if (results.length === 1) {
      return this.formatSingleResult(results[0]);
    }

    // Handle multiple results
    return this.formatMultipleResults(results, maxRows);
  }

  /**
   * Format a single result
   */
  private formatSingleResult(result: any): string {
    // If result is a simple value (count, sum, etc.)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const keys = Object.keys(result);
    if (keys.length === 1) {
      const key = keys[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const value = result[key];
      return `${key}: ${this.formatValue(value)}`;
    }

    // If result has 2-3 fields, format inline
    if (keys.length <= 3) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const fields = keys.map((k) => `${k}: ${this.formatValue(result[k])}`).join(', ');
      return fields;
    }

    // If result is an object with many fields, format as JSON
    return JSON.stringify(result, null, 2);
  }

  /**
   * Format multiple results
   */
  private formatMultipleResults(results: any[], maxRows: number): string {
    const displayResults = results.slice(0, maxRows);
    let output = '';

    // Detect if results are aggregate (single column) or tabular (multiple columns)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const firstResult = results[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const keys = Object.keys(firstResult);

    if (keys.length === 1) {
      // Single column - format as simple list
      const key = keys[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      output = displayResults.map((r, i) => `${i + 1}. ${this.formatValue(r[key])}`).join('\n');
    } else if (keys.length <= 3) {
      // Few columns - format as inline objects
      output = displayResults
        .map((r, i) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          const fields = keys.map((k) => `${k}: ${this.formatValue(r[k])}`).join(', ');
          return `${i + 1}. ${fields}`;
        })
        .join('\n');
    } else {
      // Many columns - format as JSON
      output = displayResults
        .map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`)
        .join('\n');
    }

    // Add truncation notice if needed
    if (results.length > maxRows) {
      output += `\n\n... and ${results.length - maxRows} more row(s) (showing first ${maxRows})`;
    }

    return output;
  }

  /**
   * Format a single value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (typeof value === 'number') {
      // Format numbers with appropriate precision
      if (Number.isInteger(value)) {
        return value.toString();
      }
      // Round to 2 decimal places for floats
      return value.toFixed(2);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'string') {
      return value;
    }
    // For objects/arrays, stringify
    return JSON.stringify(value);
  }

  /**
   * Get a summary of the results without generating an answer
   * Useful for debugging or previewing results
   *
   * @param results - SQL query results
   * @returns Summary statistics about the results
   */
  getResultsSummary(results: any[]): {
    count: number;
    isEmpty: boolean;
    columns: string[];
    sampleRow?: any;
  } {
    if (!results || results.length === 0) {
      return {
        count: 0,
        isEmpty: true,
        columns: [],
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const firstResult = results[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const columns = Object.keys(firstResult);

    return {
      count: results.length,
      isEmpty: false,
      columns,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      sampleRow: firstResult,
    };
  }
}

/**
 * Create a new Answer Generator with a default LLM client
 *
 * @param llmClient - Optional LLM client (creates a new one if not provided)
 * @returns Answer generator instance
 *
 * @example
 * ```typescript
 * const generator = createAnswerGenerator();
 * const result = await generator.generateAnswer(question, results, query);
 * ```
 */
export function createAnswerGenerator(llmClient?: LLMClient): AnswerGenerator {
  const client = llmClient || new LLMClient();
  return new AnswerGenerator(client);
}
