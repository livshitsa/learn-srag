/**
 * Database Manager
 *
 * Manages SQL database operations for structured records.
 * Uses better-sqlite3 for SQLite operations with support for
 * table creation, batch insertion, query execution, and statistics.
 */

import Database from 'better-sqlite3';
import { JSONSchema } from '../models/schema.js';
import { Record as RecordModel } from '../models/record.js';
import type {
  SQLType,
  TableStatistics,
  NumericStatistics,
  CategoricalStatistics,
  QueryResult,
  RecordData,
} from '../models/types.js';
import { DatabaseError, SQLError } from '../models/types.js';
import { logger } from '../utils/logger.js';
import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

/**
 * Type for SQLite table_info pragma result
 */
interface TableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
}

/**
 * Type for SQLite count query result
 */
interface CountResult {
  count: number;
}

/**
 * Type for numeric statistics query result
 */
interface NumericStatsResult {
  min_val: number | null;
  max_val: number | null;
  mean_val: number | null;
  count_val: number;
}

/**
 * DatabaseManager class for managing SQLite database operations
 */
export class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;
  private isOpen: boolean = false;

  /**
   * Creates a new DatabaseManager instance
   *
   * @param dbPath - Path to SQLite database file
   * @throws DatabaseError if database initialization fails
   *
   * @example
   * ```typescript
   * const db = new DatabaseManager('data/databases/my-db.db');
   * ```
   */
  constructor(dbPath: string) {
    try {
      // Ensure database directory exists
      const resolvedPath = resolve(dbPath);
      const dir = dirname(resolvedPath);

      if (!existsSync(dir)) {
        logger.debug(`Creating database directory: ${dir}`);
        mkdirSync(dir, { recursive: true });
      }

      this.dbPath = resolvedPath;
      this.db = new Database(this.dbPath);
      this.isOpen = true;

      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');

      // Enable WAL mode for better concurrent access
      this.db.pragma('journal_mode = WAL');

      logger.info(`Database opened successfully: ${this.dbPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to initialize database: ${message}`);
    }
  }

  /**
   * Creates a SQL table from a JSON Schema
   *
   * Type mapping:
   * - string → TEXT
   * - number → REAL
   * - integer → INTEGER
   * - boolean → INTEGER (0/1)
   *
   * @param schema - JSON Schema defining the table structure
   * @param tableName - Name of the table to create
   * @throws DatabaseError if table creation fails
   *
   * @example
   * ```typescript
   * const schema = new JSONSchema({
   *   title: 'Hotels',
   *   description: 'Hotel records',
   *   type: 'object',
   *   properties: {
   *     name: { type: 'string', description: 'Hotel name', examples: ['Grand Hotel'] },
   *     rating: { type: 'number', description: 'Guest rating', examples: [4.5] }
   *   }
   * });
   * db.createTableFromSchema(schema, 'hotels');
   * ```
   */
  createTableFromSchema(schema: JSONSchema, tableName: string): void {
    this.ensureOpen();

    try {
      logger.debug(`Creating table ${tableName} from schema ${schema.title}`);

      // Validate table name to prevent SQL injection
      this.validateTableName(tableName);

      const columns: string[] = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];

      // Add columns from schema
      for (const [attrName, attrDef] of Object.entries(schema.properties)) {
        // Skip 'id' column as we already have auto-increment id
        if (attrName.toLowerCase() === 'id') {
          logger.debug(`Skipping column 'id' as it conflicts with auto-increment primary key`);
          continue;
        }

        const sqlType = this.jsonTypeToSql(attrDef.type);
        const notNull = schema.isRequired(attrName) ? 'NOT NULL' : '';
        columns.push(`${attrName} ${sqlType} ${notNull}`.trim());
      }

      // Create table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${tableName} (
          ${columns.join(',\n          ')}
        )
      `;

      this.db.exec(createTableSQL);

      logger.info(
        `Table ${tableName} created with ${schema.getPropertyNames().length} columns`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to create table ${tableName}: ${message}`);
    }
  }

  /**
   * Inserts multiple records into a table with transaction support
   *
   * @param records - Array of Record instances to insert
   * @param tableName - Name of the table
   * @throws DatabaseError if insertion fails
   *
   * @example
   * ```typescript
   * const records = [
   *   new Record({ name: 'Hotel A', rating: 4.5 }, schema),
   *   new Record({ name: 'Hotel B', rating: 4.2 }, schema)
   * ];
   * db.insertRecords(records, 'hotels');
   * ```
   */
  insertRecords(records: RecordModel[], tableName: string): void {
    this.ensureOpen();

    if (records.length === 0) {
      logger.debug('No records to insert');
      return;
    }

    try {
      // Validate table name
      this.validateTableName(tableName);

      logger.debug(`Inserting ${records.length} records into ${tableName}`);

      const firstRecord = records[0];
      const columns = Object.keys(firstRecord.data);
      const placeholders = columns.map(() => '?').join(', ');

      const insertSQL = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
      `;

      const insert = this.db.prepare(insertSQL);

      // Use transaction for batch insert
      const insertMany = this.db.transaction((recs: RecordModel[]) => {
        for (const record of recs) {
          const values = columns.map((col) => {
            const value = record.data[col];
            // Convert boolean to integer for SQLite
            if (typeof value === 'boolean') {
              return value ? 1 : 0;
            }
            return value;
          });
          insert.run(...values);
        }
      });

      insertMany(records);

      logger.info(`Successfully inserted ${records.length} records into ${tableName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to insert records into ${tableName}: ${message}`);
    }
  }

  /**
   * Executes a SQL query and returns results
   *
   * @param sql - SQL query string (SELECT only)
   * @param params - Optional query parameters for prepared statements
   * @returns Query results
   * @throws SQLError if query is invalid or fails
   *
   * @example
   * ```typescript
   * const results = db.executeQuery('SELECT * FROM hotels WHERE rating > 4.0');
   * console.log(results.rows);
   * ```
   */
  executeQuery(sql: string, params: (string | number | boolean | null)[] = []): QueryResult {
    this.ensureOpen();

    try {
      // Validate SQL (only allow SELECT statements)
      this.validateQuery(sql);

      logger.debug(`Executing query: ${sql.substring(0, 100)}...`);

      const stmt = this.db.prepare(sql);
      let rows: unknown[];

      if (params.length > 0) {
        // Use type assertion for params spread - better-sqlite3 accepts these types
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        rows = stmt.all(...(params as any[]));
      } else {
        rows = stmt.all();
      }

      logger.debug(`Query returned ${rows.length} rows`);

      return {
        rows: rows as RecordData[],
        rowCount: rows.length,
        sql,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLError(`Query execution failed: ${message}`);
    }
  }

  /**
   * Calculates statistics for all columns in a table
   *
   * For numeric columns (INTEGER, REAL):
   * - min, max, mean, count
   *
   * For categorical columns (TEXT):
   * - unique values, count
   *
   * @param tableName - Name of the table
   * @returns Statistics for all columns
   * @throws DatabaseError if statistics calculation fails
   *
   * @example
   * ```typescript
   * const stats = db.getColumnStatistics('hotels');
   * console.log(stats.rating); // { type: 'numeric', min: 3.5, max: 5.0, mean: 4.3, count: 100 }
   * ```
   */
  getColumnStatistics(tableName: string): TableStatistics {
    this.ensureOpen();

    try {
      // Validate table name
      this.validateTableName(tableName);

      logger.debug(`Calculating statistics for table ${tableName}`);

      const stats: TableStatistics = {};

      // Get table info
      const tableInfo = this.db.pragma(`table_info(${tableName})`) as TableInfoRow[];

      for (const column of tableInfo) {
        const colName = column.name;
        const colType = column.type;

        // Skip ID column
        if (colName === 'id') continue;

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
              WHERE ${colName} IS NOT NULL
            `
            )
            .get() as NumericStatsResult | undefined;

          if (result) {
            stats[colName] = {
              type: 'numeric',
              min: result.min_val !== null ? Number(result.min_val) : 0,
              max: result.max_val !== null ? Number(result.max_val) : 0,
              mean: result.mean_val !== null ? Number(result.mean_val) : 0,
              count: Number(result.count_val),
            } as NumericStatistics;
          }
        } else {
          // Categorical statistics
          const rows = this.db
            .prepare(
              `
              SELECT DISTINCT ${colName}
              FROM ${tableName}
              WHERE ${colName} IS NOT NULL
              ORDER BY ${colName}
              LIMIT 100
            `
            )
            .all() as RecordData[];

          const uniqueValues = rows.map((row) => row[colName]).filter((val): val is string | number | boolean => val !== null && val !== undefined);

          stats[colName] = {
            type: 'categorical',
            uniqueValues,
            count: uniqueValues.length,
          } as CategoricalStatistics;
        }
      }

      logger.info(`Statistics calculated for ${Object.keys(stats).length} columns`);

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(
        `Failed to calculate statistics for ${tableName}: ${message}`
      );
    }
  }

  /**
   * Gets the total number of rows in a table
   *
   * @param tableName - Name of the table
   * @returns Number of rows
   * @throws DatabaseError if count fails
   */
  getRowCount(tableName: string): number {
    this.ensureOpen();

    try {
      this.validateTableName(tableName);

      const result = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${tableName}`)
        .get() as CountResult | undefined;

      return result ? Number(result.count) : 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to get row count for ${tableName}: ${message}`);
    }
  }

  /**
   * Checks if a table exists in the database
   *
   * @param tableName - Name of the table
   * @returns True if table exists
   */
  tableExists(tableName: string): boolean {
    this.ensureOpen();

    try {
      const result = this.db
        .prepare(
          `
          SELECT name
          FROM sqlite_master
          WHERE type='table' AND name=?
        `
        )
        .get(tableName);

      return result !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Deletes a table from the database
   *
   * @param tableName - Name of the table to delete
   * @throws DatabaseError if deletion fails
   */
  dropTable(tableName: string): void {
    this.ensureOpen();

    try {
      this.validateTableName(tableName);

      logger.debug(`Dropping table ${tableName}`);

      this.db.exec(`DROP TABLE IF EXISTS ${tableName}`);

      logger.info(`Table ${tableName} dropped successfully`);
    } catch (error) {
      // Re-throw SQLError as-is
      if (error instanceof SQLError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to drop table ${tableName}: ${message}`);
    }
  }

  /**
   * Closes the database connection
   *
   * @example
   * ```typescript
   * db.close();
   * ```
   */
  close(): void {
    if (this.isOpen) {
      try {
        this.db.close();
        this.isOpen = false;
        logger.info(`Database closed: ${this.dbPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new DatabaseError(`Failed to close database: ${message}`);
      }
    }
  }

  /**
   * Converts JSON Schema type to SQL type
   *
   * @param jsonType - JSON Schema type
   * @returns SQL type
   */
  private jsonTypeToSql(jsonType: string): SQLType {
    const typeMap: Record<string, SQLType> = {
      string: 'TEXT',
      number: 'REAL',
      integer: 'INTEGER',
      boolean: 'INTEGER', // 0 or 1
    };

    return typeMap[jsonType] || 'TEXT';
  }

  /**
   * Validates table name to prevent SQL injection
   *
   * @param tableName - Table name to validate
   * @throws SQLError if table name is invalid
   */
  private validateTableName(tableName: string): void {
    // Only allow alphanumeric characters and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new SQLError(
        `Invalid table name: ${tableName}. Only alphanumeric characters and underscores are allowed.`
      );
    }
  }

  /**
   * Validates SQL query to ensure it's a SELECT statement
   *
   * @param sql - SQL query to validate
   * @throws SQLError if query is invalid
   */
  private validateQuery(sql: string): void {
    const sqlUpper = sql.trim().toUpperCase();

    // Only allow SELECT
    if (!sqlUpper.startsWith('SELECT')) {
      throw new SQLError('Only SELECT queries are allowed');
    }

    // Disallow dangerous operations
    const dangerous = [
      'DROP',
      'DELETE',
      'INSERT',
      'UPDATE',
      'ALTER',
      'CREATE',
      'TRUNCATE',
      'EXEC',
      'EXECUTE',
    ];

    for (const keyword of dangerous) {
      if (sqlUpper.includes(keyword)) {
        throw new SQLError(`Query contains forbidden keyword: ${keyword}`);
      }
    }
  }

  /**
   * Ensures database is open
   *
   * @throws DatabaseError if database is closed
   */
  private ensureOpen(): void {
    if (!this.isOpen) {
      throw new DatabaseError('Database is not open');
    }
  }

  /**
   * Gets the database path
   */
  getPath(): string {
    return this.dbPath;
  }

  /**
   * Checks if database is open
   */
  isDbOpen(): boolean {
    return this.isOpen;
  }
}
