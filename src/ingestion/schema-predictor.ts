/**
 * Schema Predictor
 *
 * Generates JSON Schema from sample documents using LLM with iterative refinement.
 * Implements both Part 1 (Iteration 6A) and Part 2 (Iteration 6B).
 *
 * Features:
 * - Initial schema generation from sample documents
 * - Iterative refinement based on sample questions (4 iterations total)
 * - Schema validation and versioning
 * - Schema storage and loading capabilities
 */

import { LLMClient } from '../llm/llm-client.js';
import { JSONSchema } from '../models/schema.js';
import { createLogger } from '../utils/logger.js';
import { readFileAsText, writeJSONFile, fileExists } from '../utils/helpers.js';
import { extractJSON } from '../utils/helpers.js';
import { ValidationError, LLMModel } from '../models/types.js';
import path from 'path';
import { fileURLToPath } from 'url';

const logger = createLogger({ module: 'schema-predictor' });

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_DIR = path.resolve(__dirname, '../../prompts');

/**
 * Schema Predictor for generating JSON schemas from documents
 *
 * @example
 * ```typescript
 * const llm = new LLMClient();
 * const predictor = new SchemaPredictor(llm);
 * const schema = await predictor.generateInitialSchema([
 *   "Document 1 content...",
 *   "Document 2 content..."
 * ]);
 * console.log(schema.title);
 * ```
 */
export class SchemaPredictor {
  private llm: LLMClient;

  /**
   * Create a new Schema Predictor
   *
   * @param llmClient - LLM client for schema generation
   */
  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
    logger.debug('SchemaPredictor initialized');
  }

  /**
   * Generate initial schema from sample documents (first iteration)
   *
   * This method implements the first iteration of schema generation,
   * focusing on recurring concepts across documents.
   *
   * @param documents - Sample documents to analyze
   * @param model - LLM model to use (default: gpt-4o)
   * @returns JSONSchema instance
   * @throws ValidationError if schema generation fails
   *
   * @example
   * ```typescript
   * const schema = await predictor.generateInitialSchema([
   *   "Hotel A: 5 stars, pool, wifi",
   *   "Hotel B: 4 stars, gym, parking"
   * ]);
   * ```
   */
  async generateInitialSchema(
    documents: string[],
    model: LLMModel = 'gpt-4o'
  ): Promise<JSONSchema> {
    logger.info('Generating initial schema', {
      numDocuments: documents.length,
      model,
    });

    try {
      // Build prompt
      const prompt = await this.buildFirstIterationPrompt(documents);

      logger.debug('Prompt built', {
        promptLength: prompt.length,
      });

      // Call LLM
      const response = await this.llm.generate(prompt, { model });

      logger.debug('LLM response received', {
        responseLength: response.content.length,
        tokens: response.usage?.totalTokens,
      });

      // Parse JSON response
      const schemaObject = this.parseJsonResponse(response.content);

      logger.debug('JSON parsed successfully', {
        numProperties: Object.keys(schemaObject.properties || {}).length,
      });

      // Validate and create JSONSchema
      const schema = new JSONSchema(schemaObject);

      // Additional validation for primitive types only
      if (!schema.isPrimitiveOnly()) {
        throw new ValidationError('Schema must contain only primitive types');
      }

      logger.info('Initial schema generated successfully', {
        title: schema.title,
        numProperties: schema.getPropertyNames().length,
        requiredCount: schema.required?.length || 0,
      });

      return schema;
    } catch (error) {
      logger.error('Schema generation failed', error as Error);
      throw error;
    }
  }

  /**
   * Build prompt for first iteration schema generation
   *
   * Loads the prompt template and substitutes sample documents.
   *
   * @param documents - Sample documents to include in prompt
   * @returns Formatted prompt string
   */
  async buildFirstIterationPrompt(documents: string[]): Promise<string> {
    logger.debug('Building first iteration prompt', {
      numDocuments: documents.length,
    });

    // Load prompt template
    const templatePath = path.join(PROMPTS_DIR, 'schema-generation-first.txt');
    const templateResult = await readFileAsText(templatePath);

    if (!templateResult.success) {
      throw new ValidationError(
        `Failed to load prompt template: ${templateResult.error.message}`
      );
    }

    const template = templateResult.data;

    // Format documents for prompt
    const formattedDocs = documents
      .map((doc, idx) => `### Document ${idx + 1}\n\n${doc.trim()}\n`)
      .join('\n');

    // Substitute placeholders
    const prompt = template.replace('{documents}', formattedDocs);

    logger.debug('Prompt built successfully', {
      templateLength: template.length,
      promptLength: prompt.length,
    });

    return prompt;
  }

  /**
   * Parse JSON response from LLM
   *
   * Extracts JSON from LLM response (which may contain markdown, explanations, etc.)
   * and validates it as a schema object.
   *
   * @param response - Raw LLM response
   * @returns Parsed schema object
   * @throws ValidationError if JSON is invalid or not found
   */
  parseJsonResponse(response: string): Record<string, any> {
    logger.debug('Parsing JSON response', {
      responseLength: response.length,
    });

    // Extract JSON using helper function
    const jsonResult = extractJSON(response);

    if (!jsonResult.success) {
      throw new ValidationError('No JSON found in LLM response');
    }

    const parsed = jsonResult.data as any;

    // Basic validation
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError('Response must be a JSON object');
    }

    if (!parsed.title) {
      throw new ValidationError('Schema missing required field: title');
    }

    if (!parsed.properties || typeof parsed.properties !== 'object') {
      throw new ValidationError('Schema missing required field: properties');
    }

    logger.debug('JSON parsed and validated', {
      title: parsed.title,
      numProperties: Object.keys(parsed.properties).length,
    });

    return parsed as Record<string, any>;
  }

  /**
   * Validate a schema object meets basic requirements
   *
   * This is a helper for basic validation. Full validation happens
   * in the JSONSchema constructor.
   *
   * @param schema - Schema object to validate
   * @returns true if valid
   * @throws ValidationError if invalid
   */
  validateSchemaStructure(schema: Record<string, any>): boolean {
    // Check required top-level fields
    if (!schema.title || typeof schema.title !== 'string') {
      throw new ValidationError('Schema must have a string title');
    }

    if (!schema.description || typeof schema.description !== 'string') {
      throw new ValidationError('Schema must have a string description');
    }

    if (schema.type !== 'object') {
      throw new ValidationError('Schema type must be "object"');
    }

    if (!schema.properties || typeof schema.properties !== 'object') {
      throw new ValidationError('Schema must have properties object');
    }

    // Check at least one property exists
    const propNames = Object.keys(schema.properties);
    if (propNames.length === 0) {
      throw new ValidationError('Schema must have at least one property');
    }

    // Validate each property
    const validTypes = ['string', 'number', 'integer', 'boolean'];
    for (const [propName, propDef] of Object.entries(schema.properties)) {
      const prop = propDef as any;

      if (!prop.type || !validTypes.includes(prop.type)) {
        throw new ValidationError(
          `Property "${propName}" must have a valid primitive type (string, number, integer, boolean)`
        );
      }

      if (!prop.description || typeof prop.description !== 'string') {
        throw new ValidationError(`Property "${propName}" must have a description`);
      }

      if (!prop.examples || !Array.isArray(prop.examples) || prop.examples.length === 0) {
        throw new ValidationError(`Property "${propName}" must have at least one example`);
      }
    }

    logger.debug('Schema structure validated', {
      numProperties: propNames.length,
    });

    return true;
  }

  /**
   * Predict schema with iterative refinement (FULL PIPELINE - Iteration 6B)
   *
   * This is the main method that orchestrates the full schema generation pipeline:
   * 1. First iteration: Generate initial schema from sample documents only
   * 2. Iterations 2-4: Refine schema based on sample questions
   *
   * @param sampleDocuments - Sample documents from corpus
   * @param sampleQuestions - Sample questions to answer
   * @param numDocs - Number of documents to use (default: 12)
   * @param numQuestions - Number of questions to use (default: 10)
   * @param model - LLM model to use (default: gpt-4o)
   * @returns Final refined JSONSchema
   * @throws ValidationError if schema generation or refinement fails
   */
  async predictSchema(
    sampleDocuments: string[],
    sampleQuestions: string[],
    numDocs: number = 12,
    numQuestions: number = 10,
    model: LLMModel = 'gpt-4o'
  ): Promise<JSONSchema> {
    logger.info('Starting schema prediction with iterative refinement', {
      totalDocs: sampleDocuments.length,
      totalQuestions: sampleQuestions.length,
      numDocs,
      numQuestions,
      model,
    });

    try {
      // Select sample subsets
      const docs = sampleDocuments.slice(0, numDocs);
      const questions = sampleQuestions.slice(0, numQuestions);

      logger.debug('Samples selected', {
        docsSelected: docs.length,
        questionsSelected: questions.length,
      });

      // First iteration: Generate initial schema from documents only
      logger.info('Iteration 1/4: Generating initial schema from documents');
      let schema = await this.generateInitialSchema(docs, model);

      logger.info('Initial schema generated', {
        title: schema.title,
        numProperties: schema.getPropertyNames().length,
      });

      // Refinement iterations (2-4)
      const numRefinements = 3;
      for (let i = 0; i < numRefinements; i++) {
        const iteration = i + 2;
        logger.info(`Iteration ${iteration}/4: Refining schema based on questions`);

        schema = await this.refineSchema(schema, docs, questions, model);

        logger.info(`Refinement ${i + 1} complete`, {
          title: schema.title,
          numProperties: schema.getPropertyNames().length,
        });
      }

      // Final validation
      this.validateSchema(schema);

      logger.info('Schema prediction complete', {
        title: schema.title,
        numProperties: schema.getPropertyNames().length,
        requiredCount: schema.required?.length || 0,
      });

      return schema;
    } catch (error) {
      logger.error('Schema prediction failed', error as Error);
      throw error;
    }
  }

  /**
   * Refine schema based on documents and questions (Iteration 6B)
   *
   * This method takes a current schema and refines it based on:
   * - The sample documents (to ensure consistency)
   * - The sample questions (to ensure the schema can answer them)
   *
   * @param currentSchema - Current schema to refine
   * @param documents - Sample documents
   * @param questions - Sample questions
   * @param model - LLM model to use (default: gpt-4o)
   * @returns Refined JSONSchema
   * @throws ValidationError if refinement fails
   */
  async refineSchema(
    currentSchema: JSONSchema,
    documents: string[],
    questions: string[],
    model: LLMModel = 'gpt-4o'
  ): Promise<JSONSchema> {
    logger.debug('Refining schema', {
      currentTitle: currentSchema.title,
      numDocs: documents.length,
      numQuestions: questions.length,
      model,
    });

    try {
      // Build refinement prompt
      const prompt = await this.buildRefinementPrompt(currentSchema, documents, questions);

      logger.debug('Refinement prompt built', {
        promptLength: prompt.length,
      });

      // Call LLM
      const response = await this.llm.generate(prompt, { model });

      logger.debug('LLM response received', {
        responseLength: response.content.length,
        tokens: response.usage?.totalTokens,
      });

      // Parse JSON response
      const schemaObject = this.parseJsonResponse(response.content);

      logger.debug('JSON parsed successfully', {
        numProperties: Object.keys(schemaObject.properties || {}).length,
      });

      // Create and validate new schema
      const refinedSchema = new JSONSchema(schemaObject);

      // Additional validation for primitive types only
      if (!refinedSchema.isPrimitiveOnly()) {
        throw new ValidationError('Refined schema must contain only primitive types');
      }

      logger.debug('Schema refined successfully', {
        title: refinedSchema.title,
        numProperties: refinedSchema.getPropertyNames().length,
      });

      return refinedSchema;
    } catch (error) {
      logger.error('Schema refinement failed', error as Error);
      throw error;
    }
  }

  /**
   * Build refinement prompt for schema refinement iterations (Iteration 6B)
   *
   * Loads the refinement prompt template and substitutes:
   * - Current schema
   * - Sample documents
   * - Sample questions
   *
   * @param currentSchema - Current schema to refine
   * @param documents - Sample documents
   * @param questions - Sample questions
   * @returns Formatted refinement prompt string
   */
  async buildRefinementPrompt(
    currentSchema: JSONSchema,
    documents: string[],
    questions: string[]
  ): Promise<string> {
    logger.debug('Building refinement prompt', {
      numDocs: documents.length,
      numQuestions: questions.length,
    });

    // Load refinement template
    const templatePath = path.join(PROMPTS_DIR, 'schema-generation-refine.txt');
    const templateResult = await readFileAsText(templatePath);

    if (!templateResult.success) {
      throw new ValidationError(
        `Failed to load refinement prompt template: ${(templateResult as any).error.message}`
      );
    }

    const template = templateResult.data;

    // Format current schema
    const schemaJson = currentSchema.toString(true); // Pretty print

    // Format documents
    const formattedDocs = documents
      .map((doc, idx) => `### Document ${idx + 1}\n\n${doc.trim()}\n`)
      .join('\n');

    // Format questions
    const formattedQuestions = questions
      .map((q, idx) => `${idx + 1}. ${q.trim()}`)
      .join('\n');

    // Substitute placeholders
    const prompt = template
      .replace('{current_schema}', schemaJson)
      .replace('{documents}', formattedDocs)
      .replace('{questions}', formattedQuestions);

    logger.debug('Refinement prompt built successfully', {
      templateLength: template.length,
      promptLength: prompt.length,
    });

    return prompt;
  }

  /**
   * Validate a schema comprehensively (Iteration 6B)
   *
   * Performs comprehensive validation including:
   * - Structure validation (title, type, properties)
   * - Type constraints (primitive types only)
   * - Property validation (type, description, examples)
   * - Required fields validation
   *
   * @param schema - Schema to validate
   * @returns true if valid
   * @throws ValidationError if invalid
   */
  validateSchema(schema: JSONSchema): boolean {
    logger.debug('Validating schema comprehensively', {
      title: schema.title,
    });

    // The JSONSchema constructor already validates structure via Zod
    // Here we add additional business logic validation

    // Check for primitive types only (MVP requirement)
    if (!schema.isPrimitiveOnly()) {
      throw new ValidationError(
        'Schema must contain only primitive types (string, number, integer, boolean)'
      );
    }

    // Check minimum number of properties
    const propNames = schema.getPropertyNames();
    if (propNames.length === 0) {
      throw new ValidationError('Schema must have at least one property');
    }

    // Check maximum number of properties (reasonable limit)
    if (propNames.length > 50) {
      logger.warn('Schema has many properties', {
        count: propNames.length,
      });
    }

    // Validate each property has sufficient examples
    for (const propName of propNames) {
      const prop = schema.getProperty(propName);
      if (!prop) continue;

      if (prop.examples.length < 2) {
        logger.warn(`Property "${propName}" has fewer than 2 examples`, {
          count: prop.examples.length,
        });
      }

      // Check description is meaningful (not too short)
      if (prop.description.length < 10) {
        logger.warn(`Property "${propName}" has short description`, {
          length: prop.description.length,
        });
      }
    }

    // Check if required array makes sense
    if (schema.required && schema.required.length > 0) {
      for (const reqProp of schema.required) {
        if (!schema.hasProperty(reqProp)) {
          throw new ValidationError(
            `Required property "${reqProp}" does not exist in schema`
          );
        }
      }
    }

    logger.debug('Schema validation passed', {
      numProperties: propNames.length,
      requiredCount: schema.required?.length || 0,
    });

    return true;
  }

  /**
   * Save schema to file with versioning (Iteration 6B)
   *
   * Saves the schema as a JSON file with optional version suffix.
   * Useful for tracking schema evolution across iterations.
   *
   * @param schema - Schema to save
   * @param outputPath - Path where schema should be saved
   * @param version - Optional version number (e.g., 1, 2, 3, 4 for each iteration)
   * @returns Path to saved file
   */
  async saveSchema(
    schema: JSONSchema,
    outputPath: string,
    version?: number
  ): Promise<string> {
    logger.debug('Saving schema', {
      outputPath,
      version,
    });

    // Add version suffix if provided
    let finalPath = outputPath;
    if (version !== undefined) {
      const ext = path.extname(outputPath);
      const base = outputPath.slice(0, -ext.length);
      finalPath = `${base}.v${version}${ext}`;
    }

    // Save schema (create directories if needed)
    const result = await writeJSONFile(finalPath, schema.toJSON(), true, true);

    if (!result.success) {
      throw new ValidationError(
        `Failed to save schema: ${(result as any).error.message}`
      );
    }

    logger.info('Schema saved successfully', {
      path: finalPath,
      size: JSON.stringify(schema.toJSON()).length,
    });

    return finalPath;
  }

  /**
   * Load schema from file (Iteration 6B)
   *
   * Loads a previously saved schema from a JSON file.
   *
   * @param filePath - Path to schema JSON file
   * @returns Loaded JSONSchema
   * @throws ValidationError if file doesn't exist or schema is invalid
   */
  async loadSchema(filePath: string): Promise<JSONSchema> {
    logger.debug('Loading schema', {
      filePath,
    });

    // Check if file exists
    const exists = await fileExists(filePath);
    if (!exists) {
      throw new ValidationError(`Schema file not found: ${filePath}`);
    }

    // Read and parse file
    const contentResult = await readFileAsText(filePath);
    if (!contentResult.success) {
      throw new ValidationError(
        `Failed to read schema file: ${(contentResult as any).error.message}`
      );
    }

    const schemaObj = JSON.parse(contentResult.data);

    // Create and validate schema
    const schema = new JSONSchema(schemaObj);

    logger.info('Schema loaded successfully', {
      path: filePath,
      title: schema.title,
      numProperties: schema.getPropertyNames().length,
    });

    return schema;
  }
}

/**
 * Create a default SchemaPredictor instance
 *
 * @param llmClient - LLM client to use
 * @returns SchemaPredictor instance
 */
export function createSchemaPredictor(llmClient: LLMClient): SchemaPredictor {
  return new SchemaPredictor(llmClient);
}
