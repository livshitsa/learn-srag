/**
 * Statistics Calculator
 *
 * Provides utilities for calculating and formatting column statistics
 * for use in LLM prompts and analysis. Wraps DatabaseManager's statistics
 * functionality with additional helper methods.
 */

import { DatabaseManager } from '../database/database-manager.js';
import type {
  TableStatistics,
  ColumnStatistics,
  NumericStatistics,
  CategoricalStatistics,
} from '../models/types.js';
import { logger } from '../utils/logger.js';

/**
 * Statistics summary for a table
 */
export interface StatisticsSummary {
  tableName: string;
  totalColumns: number;
  numericColumns: number;
  categoricalColumns: number;
  rowCount: number;
  statistics: TableStatistics;
}

/**
 * Column statistics with metadata
 */
export interface ColumnStatisticsDetail {
  columnName: string;
  type: 'numeric' | 'categorical';
  statistics: ColumnStatistics;
  summary: string;
  warnings: string[];
}

/**
 * StatisticsCalculator class for calculating and formatting statistics
 */
export class StatisticsCalculator {
  private db: DatabaseManager;

  /**
   * Creates a new StatisticsCalculator instance
   *
   * @param db - DatabaseManager instance
   *
   * @example
   * ```typescript
   * const db = new DatabaseManager('data/databases/my-db.db');
   * const calculator = new StatisticsCalculator(db);
   * ```
   */
  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /**
   * Calculates statistics for all columns in a table
   *
   * @param tableName - Name of the table
   * @returns Table statistics
   *
   * @example
   * ```typescript
   * const stats = calculator.calculateStatistics('hotels');
   * console.log(stats);
   * ```
   */
  calculateStatistics(tableName: string): TableStatistics {
    logger.debug(`Calculating statistics for table: ${tableName}`);
    return this.db.getColumnStatistics(tableName);
  }

  /**
   * Gets a summary of statistics for a table
   *
   * @param tableName - Name of the table
   * @returns Statistics summary with counts and metadata
   *
   * @example
   * ```typescript
   * const summary = calculator.getStatisticsSummary('hotels');
   * console.log(`Table has ${summary.totalColumns} columns`);
   * ```
   */
  getStatisticsSummary(tableName: string): StatisticsSummary {
    const statistics = this.calculateStatistics(tableName);
    const rowCount = this.db.getRowCount(tableName);

    const numericColumns = Object.values(statistics).filter(
      (stat) => stat.type === 'numeric'
    ).length;

    const categoricalColumns = Object.values(statistics).filter(
      (stat) => stat.type === 'categorical'
    ).length;

    return {
      tableName,
      totalColumns: Object.keys(statistics).length,
      numericColumns,
      categoricalColumns,
      rowCount,
      statistics,
    };
  }

  /**
   * Formats statistics as human-readable text for LLM prompts
   *
   * @param tableName - Name of the table
   * @returns Formatted statistics text
   *
   * @example
   * ```typescript
   * const text = calculator.formatForLLM('hotels');
   * console.log(text);
   * // Output:
   * // Table: hotels (150 rows)
   * //
   * // Columns (5 total, 2 numeric, 3 categorical):
   * //
   * // rating (numeric):
   * //   - Range: 3.5 to 5.0
   * //   - Average: 4.2
   * //   - Count: 150 values
   * // ...
   * ```
   */
  formatForLLM(tableName: string): string {
    const summary = this.getStatisticsSummary(tableName);
    const lines: string[] = [];

    // Header
    lines.push(`Table: ${tableName} (${summary.rowCount} rows)`);
    lines.push('');
    lines.push(
      `Columns (${summary.totalColumns} total, ${summary.numericColumns} numeric, ${summary.categoricalColumns} categorical):`
    );
    lines.push('');

    // Column statistics
    for (const [columnName, stats] of Object.entries(summary.statistics)) {
      const columnSummary = this.formatColumnForLLM(columnName, stats);
      lines.push(columnSummary);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Formats a single column's statistics for LLM prompts
   *
   * @param columnName - Name of the column
   * @param stats - Column statistics
   * @returns Formatted column statistics text
   *
   * @example
   * ```typescript
   * const text = calculator.formatColumnForLLM('rating', stats);
   * ```
   */
  formatColumnForLLM(columnName: string, stats: ColumnStatistics): string {
    if (stats.type === 'numeric') {
      const numStats = stats;
      return [
        `${columnName} (numeric):`,
        `  - Range: ${numStats.min} to ${numStats.max}`,
        `  - Average: ${numStats.mean.toFixed(2)}`,
        `  - Count: ${numStats.count} values`,
      ].join('\n');
    } else {
      const catStats = stats;
      const valuePreview =
        catStats.uniqueValues.length <= 10
          ? catStats.uniqueValues.join(', ')
          : `${catStats.uniqueValues.slice(0, 10).join(', ')} ... (${catStats.count} total)`;

      return [
        `${columnName} (categorical):`,
        `  - Unique values (${catStats.count}): ${valuePreview}`,
      ].join('\n');
    }
  }

  /**
   * Formats statistics as compact text for text-to-sql context
   *
   * @param tableName - Name of the table
   * @returns Compact statistics text
   *
   * @example
   * ```typescript
   * const text = calculator.formatCompact('hotels');
   * // Output: "rating: 3.5-5.0 (avg 4.2), stars: 1-5 (avg 3.8), ..."
   * ```
   */
  formatCompact(tableName: string): string {
    const statistics = this.calculateStatistics(tableName);
    const parts: string[] = [];

    for (const [columnName, stats] of Object.entries(statistics)) {
      if (stats.type === 'numeric') {
        const numStats = stats;
        parts.push(
          `${columnName}: ${numStats.min}-${numStats.max} (avg ${numStats.mean.toFixed(1)})`
        );
      } else {
        const catStats = stats;
        if (catStats.count <= 5) {
          parts.push(`${columnName}: [${catStats.uniqueValues.join(', ')}]`);
        } else {
          parts.push(`${columnName}: ${catStats.count} unique values`);
        }
      }
    }

    return parts.join(', ');
  }

  /**
   * Gets only numeric column statistics
   *
   * @param tableName - Name of the table
   * @returns Object with only numeric statistics
   *
   * @example
   * ```typescript
   * const numStats = calculator.getNumericStatistics('hotels');
   * console.log(numStats.rating.mean); // 4.2
   * ```
   */
  getNumericStatistics(tableName: string): Record<string, NumericStatistics> {
    const statistics = this.calculateStatistics(tableName);
    const numericStats: Record<string, NumericStatistics> = {};

    for (const [columnName, stats] of Object.entries(statistics)) {
      if (stats.type === 'numeric') {
        numericStats[columnName] = stats;
      }
    }

    return numericStats;
  }

  /**
   * Gets only categorical column statistics
   *
   * @param tableName - Name of the table
   * @returns Object with only categorical statistics
   *
   * @example
   * ```typescript
   * const catStats = calculator.getCategoricalStatistics('hotels');
   * console.log(catStats.city.uniqueValues); // ['New York', 'London', ...]
   * ```
   */
  getCategoricalStatistics(
    tableName: string
  ): Record<string, CategoricalStatistics> {
    const statistics = this.calculateStatistics(tableName);
    const categoricalStats: Record<string, CategoricalStatistics> = {};

    for (const [columnName, stats] of Object.entries(statistics)) {
      if (stats.type === 'categorical') {
        categoricalStats[columnName] = stats;
      }
    }

    return categoricalStats;
  }

  /**
   * Gets detailed statistics for a specific column
   *
   * @param tableName - Name of the table
   * @param columnName - Name of the column
   * @returns Detailed column statistics with summary and warnings
   *
   * @example
   * ```typescript
   * const detail = calculator.getColumnDetail('hotels', 'rating');
   * console.log(detail.summary);
   * console.log(detail.warnings);
   * ```
   */
  getColumnDetail(tableName: string, columnName: string): ColumnStatisticsDetail {
    const statistics = this.calculateStatistics(tableName);
    const stats = statistics[columnName];

    if (!stats) {
      throw new Error(`Column ${columnName} not found in table ${tableName}`);
    }

    const summary = this.formatColumnForLLM(columnName, stats);
    const warnings = this.detectWarnings(columnName, stats, tableName);

    return {
      columnName,
      type: stats.type,
      statistics: stats,
      summary,
      warnings,
    };
  }

  /**
   * Detects potential issues in column statistics
   *
   * @param columnName - Name of the column
   * @param stats - Column statistics
   * @param tableName - Name of the table
   * @returns Array of warning messages
   *
   * @example
   * ```typescript
   * const warnings = calculator.detectWarnings('age', stats, 'users');
   * // Might return: ["Very few values (only 3), possible data quality issue"]
   * ```
   */
  detectWarnings(
    _columnName: string,
    stats: ColumnStatistics,
    tableName: string
  ): string[] {
    const warnings: string[] = [];
    const rowCount = this.db.getRowCount(tableName);

    if (stats.type === 'numeric') {
      const numStats = stats;

      // Check for very few values
      if (numStats.count < rowCount * 0.5) {
        warnings.push(
          `Only ${numStats.count} out of ${rowCount} rows have values (${((numStats.count / rowCount) * 100).toFixed(1)}% coverage)`
        );
      }

      // Check for zero variance
      if (numStats.min === numStats.max && numStats.count > 1) {
        warnings.push(`All values are identical (${numStats.min})`);
      }

      // Check for potential outliers (very large range)
      const range = numStats.max - numStats.min;
      const avgDistanceFromMean = range / 2;
      if (avgDistanceFromMean > Math.abs(numStats.mean) * 10) {
        warnings.push(
          `Large range detected (${numStats.min} to ${numStats.max}), potential outliers`
        );
      }
    } else {
      const catStats = stats;

      // Check for very few unique values
      if (catStats.count === 1) {
        warnings.push(`Only one unique value: ${catStats.uniqueValues[0]}`);
      }

      // Check for very many unique values (potential ID column)
      if (catStats.count >= rowCount * 0.9 && rowCount > 10) {
        warnings.push(
          `Very high cardinality (${catStats.count} unique values out of ${rowCount} rows), possibly an ID column`
        );
      }

      // Check for very few unique values in large dataset
      if (catStats.count <= 5 && rowCount > 100) {
        warnings.push(
          `Very few unique values (${catStats.count}) in large dataset (${rowCount} rows)`
        );
      }
    }

    return warnings;
  }

  /**
   * Suggests SQL-friendly column name
   *
   * @param columnName - Original column name
   * @returns Suggested column name
   *
   * @example
   * ```typescript
   * const suggested = calculator.suggestColumnName('User Name');
   * console.log(suggested); // 'user_name'
   * ```
   */
  suggestColumnName(columnName: string): string {
    return columnName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Formats statistics as JSON for API responses
   *
   * @param tableName - Name of the table
   * @returns Statistics as JSON object
   *
   * @example
   * ```typescript
   * const json = calculator.formatAsJSON('hotels');
   * console.log(JSON.stringify(json, null, 2));
   * ```
   */
  formatAsJSON(tableName: string): StatisticsSummary {
    return this.getStatisticsSummary(tableName);
  }

  /**
   * Analyzes value distribution for numeric columns
   *
   * @param tableName - Name of the table
   * @param columnName - Name of the numeric column
   * @returns Distribution analysis
   *
   * @example
   * ```typescript
   * const dist = calculator.analyzeDistribution('hotels', 'rating');
   * console.log(dist.skewness); // Measure of asymmetry
   * ```
   */
  analyzeDistribution(
    tableName: string,
    columnName: string
  ): {
    range: number;
    midpoint: number;
    spread: number;
    description: string;
  } {
    const statistics = this.calculateStatistics(tableName);
    const stats = statistics[columnName];

    if (!stats || stats.type !== 'numeric') {
      throw new Error(`Column ${columnName} is not numeric`);
    }

    const numStats = stats;
    const range = numStats.max - numStats.min;
    const midpoint = (numStats.max + numStats.min) / 2;
    const spread = range / 2;

    let description = '';
    if (numStats.mean < midpoint - spread * 0.2) {
      description = 'Left-skewed (most values are higher)';
    } else if (numStats.mean > midpoint + spread * 0.2) {
      description = 'Right-skewed (most values are lower)';
    } else {
      description = 'Approximately centered';
    }

    return {
      range,
      midpoint,
      spread,
      description,
    };
  }

  /**
   * Creates a concise summary for a table suitable for debugging
   *
   * @param tableName - Name of the table
   * @returns Debug summary string
   *
   * @example
   * ```typescript
   * const summary = calculator.getDebugSummary('hotels');
   * console.log(summary);
   * ```
   */
  getDebugSummary(tableName: string): string {
    const summary = this.getStatisticsSummary(tableName);
    const lines: string[] = [];

    lines.push(`=== ${tableName} Statistics ===`);
    lines.push(`Rows: ${summary.rowCount}`);
    lines.push(`Columns: ${summary.totalColumns}`);
    lines.push(`  - Numeric: ${summary.numericColumns}`);
    lines.push(`  - Categorical: ${summary.categoricalColumns}`);
    lines.push('');

    // Add warnings if any
    for (const [columnName, stats] of Object.entries(summary.statistics)) {
      const warnings = this.detectWarnings(columnName, stats, tableName);
      if (warnings.length > 0) {
        lines.push(`Warnings for ${columnName}:`);
        warnings.forEach((warning) => lines.push(`  - ${warning}`));
      }
    }

    return lines.join('\n');
  }
}
