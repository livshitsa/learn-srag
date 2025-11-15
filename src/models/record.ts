/**
 * Record Model
 *
 * Represents a structured data record extracted from a document.
 * Records conform to a JSON Schema and support validation and type coercion.
 */

import { JSONSchema } from './schema.js';
import type { RecordData, JSONSchemaType } from './types.js';
import { ValidationError } from './types.js';

/**
 * Record class for managing structured data records
 */
export class Record {
  private _data: RecordData;
  private _schema: JSONSchema;

  /**
   * Creates a new Record instance
   *
   * @param data - Record data as key-value pairs
   * @param schema - JSON Schema that the record conforms to
   * @param validate - Whether to validate the record on creation (default: true)
   * @throws ValidationError if record is invalid and validate is true
   */
  constructor(data: RecordData, schema: JSONSchema, validate: boolean = true) {
    this._schema = schema;
    this._data = { ...data };

    if (validate) {
      this.validate();
    }
  }

  /**
   * Gets the record data
   */
  get data(): RecordData {
    return { ...this._data };
  }

  /**
   * Gets the schema
   */
  get schema(): JSONSchema {
    return this._schema;
  }

  /**
   * Gets a specific field value
   *
   * @param fieldName - Name of the field
   * @returns Field value or undefined if field doesn't exist
   */
  getValue(fieldName: string): string | number | boolean | null | undefined {
    return this._data[fieldName];
  }

  /**
   * Sets a field value
   *
   * @param fieldName - Name of the field
   * @param value - Value to set
   * @param validate - Whether to validate after setting (default: true)
   * @throws ValidationError if field doesn't exist in schema or value is invalid
   */
  setValue(
    fieldName: string,
    value: string | number | boolean | null,
    validate: boolean = true
  ): void {
    if (!this._schema.hasProperty(fieldName)) {
      throw new ValidationError(`Field "${fieldName}" does not exist in schema`);
    }

    this._data[fieldName] = value;

    if (validate && !this._schema.validatePropertyValue(fieldName, value)) {
      const expectedType = this._schema.getPropertyType(fieldName);
      throw new ValidationError(
        `Invalid value for field "${fieldName}". Expected type: ${expectedType}, received: ${typeof value}`
      );
    }
  }

  /**
   * Checks if a field exists in the record
   *
   * @param fieldName - Name of the field
   */
  hasField(fieldName: string): boolean {
    return fieldName in this._data;
  }

  /**
   * Gets all field names in the record
   */
  getFieldNames(): string[] {
    return Object.keys(this._data);
  }

  /**
   * Validates the entire record against the schema
   *
   * @throws ValidationError if record is invalid
   */
  validate(): void {
    const errors: string[] = [];

    // Check all schema properties
    for (const propertyName of this._schema.getPropertyNames()) {
      const value = this._data[propertyName];
      const isRequired = this._schema.isRequired(propertyName);

      // Check required fields
      if (isRequired && (value === null || value === undefined)) {
        errors.push(`Required field "${propertyName}" is missing`);
        continue;
      }

      // Validate non-null values
      if (value !== null && value !== undefined) {
        if (!this._schema.validatePropertyValue(propertyName, value)) {
          const expectedType = this._schema.getPropertyType(propertyName);
          errors.push(
            `Invalid value for field "${propertyName}". Expected type: ${expectedType}, received: ${typeof value}`
          );
        }
      }
    }

    // Check for extra fields not in schema
    for (const fieldName of Object.keys(this._data)) {
      if (!this._schema.hasProperty(fieldName)) {
        errors.push(`Field "${fieldName}" is not defined in schema`);
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(`Record validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Standardizes a value based on its type
   *
   * @param value - Value to standardize
   * @param type - Expected type
   * @returns Standardized value
   */
  static standardizeValue(value: any, type: JSONSchemaType): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    switch (type) {
      case 'integer':
        return this.standardizeInteger(value);
      case 'number':
        return this.standardizeNumber(value);
      case 'boolean':
        return this.standardizeBoolean(value);
      case 'string':
        return this.standardizeString(value);
      default:
        return null;
    }
  }

  /**
   * Standardizes an integer value
   * Handles formats like "1M", "1B", "1K", etc.
   *
   * @param value - Value to standardize
   * @returns Standardized integer or null
   */
  private static standardizeInteger(value: any): number | null {
    if (typeof value === 'number') {
      return Math.floor(value);
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toUpperCase().replace(/,/g, '');

      // Handle suffixes (K, M, B)
      const multipliers = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
        T: 1_000_000_000_000,
      };

      for (const [suffix, mult] of Object.entries(multipliers)) {
        if (cleaned.endsWith(suffix)) {
          const num = cleaned.slice(0, -1).trim();
          const parsed = parseFloat(num);
          return isNaN(parsed) ? null : Math.floor(parsed * mult);
        }
      }

      // Handle regular numbers
      const parsed = parseInt(cleaned, 10);
      return isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return null;
  }

  /**
   * Standardizes a number value
   * Handles formats like "1M", "1B", "1K", etc.
   *
   * @param value - Value to standardize
   * @returns Standardized number or null
   */
  private static standardizeNumber(value: any): number | null {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toUpperCase().replace(/,/g, '');

      // Handle percentage
      if (cleaned.endsWith('%')) {
        const num = cleaned.slice(0, -1).trim();
        const parsed = parseFloat(num);
        return isNaN(parsed) ? null : parsed / 100;
      }

      // Handle suffixes (K, M, B)
      const multipliers = {
        K: 1_000,
        M: 1_000_000,
        B: 1_000_000_000,
        T: 1_000_000_000_000,
      };

      for (const [suffix, mult] of Object.entries(multipliers)) {
        if (cleaned.endsWith(suffix)) {
          const num = cleaned.slice(0, -1).trim();
          const parsed = parseFloat(num);
          return isNaN(parsed) ? null : parsed * mult;
        }
      }

      // Handle regular numbers
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'boolean') {
      return value ? 1.0 : 0.0;
    }

    return null;
  }

  /**
   * Standardizes a boolean value
   *
   * @param value - Value to standardize
   * @returns Standardized boolean or null
   */
  private static standardizeBoolean(value: any): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toLowerCase();
      const truthyValues = ['yes', 'true', '1', 'y', 't', 'on', 'enabled'];
      const falsyValues = ['no', 'false', '0', 'n', 'f', 'off', 'disabled'];

      if (truthyValues.includes(cleaned)) {
        return true;
      }
      if (falsyValues.includes(cleaned)) {
        return false;
      }
    }

    if (typeof value === 'number') {
      return value !== 0;
    }

    return null;
  }

  /**
   * Standardizes a string value
   *
   * @param value - Value to standardize
   * @returns Standardized string or null
   */
  private static standardizeString(value: any): string | null {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  /**
   * Applies standardization to all fields in the record
   *
   * @returns New Record instance with standardized values
   */
  standardize(): Record {
    const standardizedData: RecordData = {};

    for (const fieldName of this._schema.getPropertyNames()) {
      const value = this._data[fieldName];
      const type = this._schema.getPropertyType(fieldName);

      if (type) {
        standardizedData[fieldName] = Record.standardizeValue(value, type);
      } else {
        standardizedData[fieldName] = value;
      }
    }

    return new Record(standardizedData, this._schema, true);
  }

  /**
   * Serializes the record to a plain object
   *
   * @returns Plain object representation of the record
   */
  toJSON(): RecordData {
    return { ...this._data };
  }

  /**
   * Serializes the record to a JSON string
   *
   * @param pretty - Whether to pretty-print the JSON
   * @returns JSON string representation
   */
  toString(pretty: boolean = false): string {
    return JSON.stringify(this._data, null, pretty ? 2 : 0);
  }

  /**
   * Creates a Record from a plain object
   *
   * @param data - Record data
   * @param schema - JSON Schema
   * @param validate - Whether to validate on creation
   * @returns Record instance
   */
  static fromObject(data: RecordData, schema: JSONSchema, validate: boolean = true): Record {
    return new Record(data, schema, validate);
  }

  /**
   * Creates a Record from a JSON string
   *
   * @param json - JSON string
   * @param schema - JSON Schema
   * @param validate - Whether to validate on creation
   * @returns Record instance
   * @throws ValidationError if JSON is invalid
   */
  static fromString(json: string, schema: JSONSchema, validate: boolean = true): Record {
    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ValidationError('JSON must be an object');
      }
      return new Record(parsed as RecordData, schema, validate);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Clones the record
   *
   * @returns New Record instance with the same data and schema
   */
  clone(): Record {
    return new Record({ ...this._data }, this._schema, false);
  }
}
