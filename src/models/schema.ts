/**
 * JSONSchema Model
 *
 * Represents a JSON Schema used to define the structure of extracted records.
 * Supports validation, serialization, and type checking.
 */

import { z } from 'zod';
import type { JSONSchemaDefinition, JSONSchemaProperty, JSONSchemaType } from './types.js';
import { ValidationError } from './types.js';

/**
 * Zod schema for JSON Schema property validation
 */
const JSONSchemaPropertySchema = z.object({
  type: z.enum(['string', 'number', 'integer', 'boolean']),
  description: z.string().min(1, 'Property description is required'),
  examples: z
    .array(z.union([z.string(), z.number(), z.boolean()]))
    .min(1, 'At least one example is required'),
});

/**
 * Zod schema for JSON Schema definition validation
 */
const JSONSchemaDefinitionSchema = z.object({
  title: z.string().min(1, 'Schema title is required'),
  description: z.string().min(1, 'Schema description is required'),
  type: z.literal('object'),
  properties: z
    .record(z.string(), JSONSchemaPropertySchema)
    .refine((props) => Object.keys(props).length > 0, 'At least one property is required'),
  required: z.array(z.string()).optional(),
});

/**
 * JSONSchema class for managing JSON Schema definitions
 */
export class JSONSchema {
  private schema: JSONSchemaDefinition;

  /**
   * Creates a new JSONSchema instance
   *
   * @param schema - The JSON Schema definition object
   * @throws ValidationError if schema is invalid
   */
  constructor(schema: JSONSchemaDefinition | Record<string, any>) {
    this.schema = this.validate(schema);
  }

  /**
   * Validates a JSON Schema definition
   *
   * @param schema - Schema to validate
   * @returns Validated schema
   * @throws ValidationError if schema is invalid
   */
  private validate(schema: Record<string, any>): JSONSchemaDefinition {
    try {
      const validated = JSONSchemaDefinitionSchema.parse(schema);
      return validated as JSONSchemaDefinition;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        throw new ValidationError(`Invalid JSON Schema: ${issues}`);
      }
      throw error;
    }
  }

  /**
   * Gets the schema title
   */
  get title(): string {
    return this.schema.title;
  }

  /**
   * Gets the schema description
   */
  get description(): string {
    return this.schema.description;
  }

  /**
   * Gets the schema properties
   */
  get properties(): Record<string, JSONSchemaProperty> {
    return this.schema.properties;
  }

  /**
   * Gets the required properties
   */
  get required(): string[] | undefined {
    return this.schema.required;
  }

  /**
   * Gets a specific property definition
   *
   * @param propertyName - Name of the property
   * @returns Property definition or undefined
   */
  getProperty(propertyName: string): JSONSchemaProperty | undefined {
    return this.schema.properties[propertyName];
  }

  /**
   * Gets all property names
   */
  getPropertyNames(): string[] {
    return Object.keys(this.schema.properties);
  }

  /**
   * Checks if a property exists
   *
   * @param propertyName - Name of the property
   */
  hasProperty(propertyName: string): boolean {
    return propertyName in this.schema.properties;
  }

  /**
   * Checks if a property is required
   *
   * @param propertyName - Name of the property
   */
  isRequired(propertyName: string): boolean {
    return this.schema.required?.includes(propertyName) ?? false;
  }

  /**
   * Gets the type of a property
   *
   * @param propertyName - Name of the property
   * @returns Property type or undefined if property doesn't exist
   */
  getPropertyType(propertyName: string): JSONSchemaType | undefined {
    return this.schema.properties[propertyName]?.type;
  }

  /**
   * Validates a value against a property type
   *
   * @param propertyName - Name of the property
   * @param value - Value to validate
   * @returns true if valid, false otherwise
   */
  validatePropertyValue(propertyName: string, value: any): boolean {
    const property = this.getProperty(propertyName);
    if (!property) {
      return false;
    }

    if (value === null || value === undefined) {
      return !this.isRequired(propertyName);
    }

    const type = property.type;
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return false;
    }
  }

  /**
   * Serializes the schema to a JSON object
   *
   * @returns Plain object representation of the schema
   */
  toJSON(): JSONSchemaDefinition {
    return {
      title: this.schema.title,
      description: this.schema.description,
      type: this.schema.type,
      properties: { ...this.schema.properties },
      ...(this.schema.required && { required: [...this.schema.required] }),
    };
  }

  /**
   * Serializes the schema to a JSON string
   *
   * @param pretty - Whether to pretty-print the JSON
   * @returns JSON string representation
   */
  toString(pretty: boolean = false): string {
    return JSON.stringify(this.toJSON(), null, pretty ? 2 : 0);
  }

  /**
   * Creates a JSONSchema from a JSON string
   *
   * @param json - JSON string
   * @returns JSONSchema instance
   * @throws ValidationError if JSON is invalid or schema is invalid
   */
  static fromString(json: string): JSONSchema {
    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new ValidationError('JSON must be an object');
      }
      return new JSONSchema(parsed as Record<string, any>);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Creates a JSONSchema from a plain object
   *
   * @param obj - Plain object
   * @returns JSONSchema instance
   */
  static fromObject(obj: Record<string, any>): JSONSchema {
    return new JSONSchema(obj);
  }

  /**
   * Validates that the schema only contains primitive types (MVP requirement)
   *
   * @returns true if schema only has primitive types
   */
  isPrimitiveOnly(): boolean {
    const validTypes: JSONSchemaType[] = ['string', 'number', 'integer', 'boolean'];
    return Object.values(this.schema.properties).every((prop) => validTypes.includes(prop.type));
  }

  /**
   * Gets a summary of the schema (useful for logging/debugging)
   */
  getSummary(): string {
    const propCount = this.getPropertyNames().length;
    const requiredCount = this.schema.required?.length ?? 0;
    return `Schema "${this.title}": ${propCount} properties (${requiredCount} required)`;
  }

  /**
   * Clones the schema
   *
   * @returns New JSONSchema instance with the same definition
   */
  clone(): JSONSchema {
    return new JSONSchema(this.toJSON());
  }
}
