/**
 * Query Executor
 *
 * Wrapper/orchestrator for DatabaseManager query execution.
 * Provides result formatting, pagination, metadata extraction,
 * and utilities for working with query results.
 */

import { DatabaseManager } from '../database/database-manager.js';
import type {
  QueryResult,
  RecordData,
  QueryExecutorOptions,
  FormattedQueryResult,
  PaginatedQueryResult,
  ResultMetadata,
  ColumnMetadata,
} from '../models/types.js';
import { SQLError } from '../models/types.js';
import { logger } from '../utils/logger.js';

/**
 * QueryExecutor class for managing query execution with enhanced features
 */
export class QueryExecutor {
  private db: DatabaseManager;

  /**
   * Creates a new QueryExecutor instance
   *
   * @param db - DatabaseManager instance
   *
   * @example
   * ```typescript
   * const db = new DatabaseManager('data/databases/my-db.db');
   * const executor = new QueryExecutor(db);
   * ```
   */
  constructor(db: DatabaseManager) {
    this.db = db;
    logger.debug('QueryExecutor initialized');
  }

  /**
   * Executes a SQL query with optional formatting and pagination
   *
   * @param sql - SQL query string
   * @param options - Optional query execution options
   * @returns Query result with optional formatting and pagination
   * @throws SQLError if query execution fails
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = executor.execute('SELECT * FROM hotels');
   *
   * // With formatting
   * const formatted = executor.execute('SELECT * FROM hotels', {
   *   format: true
   * });
   *
   * // With pagination
   * const paginated = executor.execute('SELECT * FROM hotels', {
   *   page: 1,
   *   pageSize: 10
   * });
   * ```
   */
  execute(sql: string, options?: QueryExecutorOptions): QueryResult | FormattedQueryResult {
    try {
      logger.debug(`Executing query with options: ${JSON.stringify(options || {})}`);

      let finalSql = sql;

      // Add pagination if requested
      if (options?.page !== undefined && options?.pageSize !== undefined) {
        finalSql = this.addPagination(sql, options.page, options.pageSize);
      }

      // Execute query using DatabaseManager
      const result = this.db.executeQuery(finalSql, options?.params || []);

      // Format results if requested
      if (options?.format) {
        return this.formatResults(result);
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLError(`Query execution failed: ${message}`);
    }
  }

  /**
   * Formats query results for JSON-friendly output
   *
   * Conversions:
   * - Booleans: 0 → false, 1 → true (for INTEGER columns)
   * - NULL handling: null remains null
   * - Type inference for proper JSON serialization
   *
   * @param result - Raw query result from DatabaseManager
   * @returns Formatted result with converted values
   *
   * @example
   * ```typescript
   * const raw = db.executeQuery('SELECT * FROM hotels');
   * const formatted = executor.formatResults(raw);
   * // Boolean columns are now true/false instead of 0/1
   * ```
   */
  formatResults(result: QueryResult): FormattedQueryResult {
    try {
      logger.debug(`Formatting ${result.rowCount} rows`);

      const formattedRows = result.rows.map((row) => this.formatRow(row));

      return {
        rows: formattedRows,
        rowCount: result.rowCount,
        sql: result.sql,
        metadata: this.getResultMetadata(result),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLError(`Result formatting failed: ${message}`);
    }
  }

  /**
   * Formats a single row for JSON output
   *
   * @param row - Single row data
   * @returns Formatted row
   */
  private formatRow(row: RecordData): RecordData {
    const formatted: RecordData = {};

    for (const [key, value] of Object.entries(row)) {
      // Convert boolean integers (0/1) to actual booleans
      // This is a heuristic - we check if the value is 0 or 1
      if (typeof value === 'number' && (value === 0 || value === 1)) {
        // Check if this looks like a boolean based on column naming conventions
        if (this.isBooleanColumn(key)) {
          formatted[key] = value === 1;
        } else {
          formatted[key] = value;
        }
      } else {
        formatted[key] = value;
      }
    }

    return formatted;
  }

  /**
   * Heuristic to determine if a column name suggests a boolean value
   *
   * @param columnName - Name of the column
   * @returns True if column name suggests boolean
   */
  private isBooleanColumn(columnName: string): boolean {
    const lowerName = columnName.toLowerCase();
    const booleanPrefixes = ['is_', 'has_', 'can_', 'should_', 'will_', 'was_', 'were_'];
    const booleanSuffixes = ['_flag', '_enabled', '_disabled', '_active', '_visible'];

    // Check prefixes
    for (const prefix of booleanPrefixes) {
      if (lowerName.startsWith(prefix)) {
        return true;
      }
    }

    // Check suffixes
    for (const suffix of booleanSuffixes) {
      if (lowerName.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Adds pagination to a SQL query using LIMIT and OFFSET
   *
   * @param sql - Original SQL query
   * @param page - Page number (1-based)
   * @param pageSize - Number of rows per page
   * @returns SQL with pagination added
   * @throws SQLError if pagination parameters are invalid
   *
   * @example
   * ```typescript
   * const sql = 'SELECT * FROM hotels';
   * const paginated = executor.paginate(sql, 2, 10);
   * // Returns: 'SELECT * FROM hotels LIMIT 10 OFFSET 10'
   * ```
   */
  paginate(sql: string, page: number, pageSize: number): PaginatedQueryResult {
    try {
      // Validate pagination parameters
      if (page < 1) {
        throw new SQLError('Page number must be >= 1');
      }
      if (pageSize < 1) {
        throw new SQLError('Page size must be >= 1');
      }

      // Add pagination to SQL
      const paginatedSql = this.addPagination(sql, page, pageSize);

      // Execute the paginated query
      const result = this.db.executeQuery(paginatedSql);

      // Get total count (without pagination)
      const totalRows = this.getTotalRowCount(sql);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalRows / pageSize);
      const hasMore = page < totalPages;
      const hasPrevious = page > 1;

      return {
        rows: result.rows,
        rowCount: result.rowCount,
        sql: result.sql,
        page,
        pageSize,
        totalRows,
        totalPages,
        hasMore,
        hasPrevious,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLError(`Pagination failed: ${message}`);
    }
  }

  /**
   * Adds LIMIT and OFFSET clauses to SQL
   *
   * @param sql - Original SQL
   * @param page - Page number (1-based)
   * @param pageSize - Rows per page
   * @returns SQL with LIMIT and OFFSET
   */
  private addPagination(sql: string, page: number, pageSize: number): string {
    const offset = (page - 1) * pageSize;
    const trimmedSql = sql.trim().replace(/;$/, ''); // Remove trailing semicolon if present

    return `${trimmedSql} LIMIT ${pageSize} OFFSET ${offset}`;
  }

  /**
   * Gets total row count for a query (without pagination)
   *
   * @param sql - Original SQL query
   * @returns Total number of rows
   */
  private getTotalRowCount(sql: string): number {
    // Wrap the original query in a COUNT(*)
    const countSql = `SELECT COUNT(*) as total FROM (${sql.trim().replace(/;$/, '')})`;

    try {
      const result = this.db.executeQuery(countSql);
      if (result.rows.length > 0) {
        return (result.rows[0].total as number) || 0;
      }
      return 0;
    } catch (error) {
      logger.warn(`Failed to get total row count: ${String(error)}`);
      return 0;
    }
  }

  /**
   * Extracts metadata about query results
   *
   * @param result - Query result
   * @returns Metadata including column names, types, and statistics
   *
   * @example
   * ```typescript
   * const result = db.executeQuery('SELECT * FROM hotels');
   * const metadata = executor.getResultMetadata(result);
   * console.log(metadata.columns); // ['id', 'name', 'rating', ...]
   * ```
   */
  getResultMetadata(result: QueryResult): ResultMetadata {
    try {
      const columns: ColumnMetadata[] = [];

      // Extract column information from first row
      if (result.rows.length > 0) {
        const firstRow = result.rows[0];

        for (const [columnName, value] of Object.entries(firstRow)) {
          const columnType = this.inferType(value);

          columns.push({
            name: columnName,
            type: columnType,
            nullable: this.checkNullable(result.rows, columnName),
          });
        }
      }

      return {
        columns,
        rowCount: result.rowCount,
        hasResults: result.rowCount > 0,
      };
    } catch (error) {
      logger.warn(`Failed to extract metadata: ${String(error)}`);
      return {
        columns: [],
        rowCount: result.rowCount,
        hasResults: result.rowCount > 0,
      };
    }
  }

  /**
   * Infers the type of a value
   *
   * @param value - Value to check
   * @returns Inferred type name
   */
  private inferType(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string') {
      return 'string';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    return 'unknown';
  }

  /**
   * Checks if a column contains any null values
   *
   * @param rows - All result rows
   * @param columnName - Column to check
   * @returns True if column has at least one null value
   */
  private checkNullable(rows: RecordData[], columnName: string): boolean {
    return rows.some((row) => row[columnName] === null);
  }

  /**
   * Helper: Execute and format in one call
   *
   * @param sql - SQL query
   * @param params - Query parameters
   * @returns Formatted query result
   */
  executeAndFormat(sql: string, params?: (string | number | boolean | null)[]): FormattedQueryResult {
    return this.execute(sql, { format: true, params }) as FormattedQueryResult;
  }

  /**
   * Helper: Execute with pagination
   *
   * @param sql - SQL query
   * @param page - Page number (1-based)
   * @param pageSize - Rows per page
   * @returns Paginated query result
   */
  executeWithPagination(
    sql: string,
    page: number,
    pageSize: number
  ): PaginatedQueryResult {
    return this.paginate(sql, page, pageSize);
  }

  /**
   * Helper: Get first row only
   *
   * @param sql - SQL query
   * @returns First row or null
   */
  executeOne(sql: string, params?: (string | number | boolean | null)[]): RecordData | null {
    const result = this.db.executeQuery(sql, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Helper: Check if query returns any results
   *
   * @param sql - SQL query
   * @returns True if query has results
   */
  hasResults(sql: string, params?: (string | number | boolean | null)[]): boolean {
    const result = this.db.executeQuery(sql, params);
    return result.rowCount > 0;
  }

  /**
   * Helper: Get count of results
   *
   * @param sql - SQL query
   * @returns Number of rows
   */
  count(sql: string): number {
    const countSql = `SELECT COUNT(*) as count FROM (${sql.trim().replace(/;$/, '')})`;
    const result = this.db.executeQuery(countSql);
    return (result.rows[0]?.count as number) || 0;
  }
}
