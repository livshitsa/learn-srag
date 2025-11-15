/**
 * Record Extractor
 *
 * Extracts structured records from unstructured documents using LLM-based extraction.
 * Supports single and batch extraction with automatic value standardization.
 */

import { LLMClient } from '../llm/llm-client.js';
import { JSONSchema } from '../models/schema.js';
import { Record } from '../models/record.js';
import { createLogger } from '../utils/logger.js';
import { readFileAsText } from '../utils/helpers.js';
import { LLMGenerateOptions, RecordData } from '../models/types.js';

const logger = createLogger({ module: 'record-extractor' });

/**
 * RecordExtractor class for extracting structured data from documents
 *
 * @example
 * ```typescript
 * const extractor = new RecordExtractor(llmClient);
 * const record = await extractor.extractRecord(documentText, schema);
 * const records = await extractor.batchExtract(documents, schema);
 * ```
 */
export class RecordExtractor {
  private llm: LLMClient;
  private promptTemplate?: string;

  /**
   * Create a new RecordExtractor instance
   *
   * @param llmClient - LLM client for extraction
   * @param promptTemplatePath - Optional path to custom prompt template
   */
  constructor(llmClient: LLMClient, promptTemplatePath?: string) {
    this.llm = llmClient;

    // Load prompt template if provided (asynchronously in background)
    if (promptTemplatePath) {
      readFileAsText(promptTemplatePath)
        .then((result) => {
          if (result.success) {
            this.promptTemplate = result.data;
            logger.debug('Loaded custom prompt template', { path: promptTemplatePath });
          } else {
            logger.warn('Failed to load prompt template, will use default', {
              path: promptTemplatePath,
              error: result.error?.message || 'Unknown error',
            });
          }
        })
        .catch((error) => {
          logger.warn('Failed to load prompt template, will use default', {
            path: promptTemplatePath,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }
  }

  /**
   * Extract a single record from a document
   *
   * @param document - Raw document text (HTML, markdown, or plain text)
   * @param schema - JSON Schema defining expected structure
   * @param options - Optional LLM generation options
   * @returns Extracted and standardized record
   *
   * @example
   * ```typescript
   * const record = await extractor.extractRecord(documentText, schema);
   * console.log(record.getValue('name'));
   * ```
   */
  async extractRecord(
    document: string,
    schema: JSONSchema,
    options?: Partial<LLMGenerateOptions>
  ): Promise<Record> {
    logger.debug('Extracting record from document', {
      documentLength: document.length,
      schemaTitle: schema.title,
      properties: schema.getPropertyNames().length,
    });

    try {
      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(document, schema);

      // Call LLM to extract data
      const response = await this.llm.generate(prompt, options);

      // Parse response into record data
      const recordData = this.parseRecordResponse(response.content, schema);

      // Create record (with validation disabled for now)
      const record = new Record(recordData, schema, false);

      // Standardize values using Record's built-in standardization
      const standardizedRecord = record.standardize();

      logger.info('Successfully extracted record', {
        schemaTitle: schema.title,
        fieldCount: Object.keys(recordData).length,
        tokens: response.usage?.totalTokens,
      });

      return standardizedRecord;
    } catch (error) {
      logger.error('Failed to extract record', error as Error, {
        documentLength: document.length,
        schemaTitle: schema.title,
      });
      throw error;
    }
  }

  /**
   * Extract records from multiple documents in batches
   *
   * @param documents - Array of document texts
   * @param schema - JSON Schema defining expected structure
   * @param batchSize - Number of documents to process concurrently (default: 10)
   * @param options - Optional LLM generation options
   * @returns Array of extracted and standardized records
   *
   * @example
   * ```typescript
   * const records = await extractor.batchExtract(documents, schema, 5);
   * console.log(`Extracted ${records.length} records`);
   * ```
   */
  async batchExtract(
    documents: string[],
    schema: JSONSchema,
    batchSize: number = 10,
    options?: Partial<LLMGenerateOptions>
  ): Promise<Record[]> {
    logger.info('Starting batch extraction', {
      totalDocuments: documents.length,
      batchSize,
      schemaTitle: schema.title,
    });

    const records: Record[] = [];
    const totalBatches = Math.ceil(documents.length / batchSize);

    try {
      for (let i = 0; i < documents.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1;
        const batch = documents.slice(i, i + batchSize);

        logger.debug('Processing batch', {
          batch: currentBatch,
          totalBatches,
          documentsInBatch: batch.length,
        });

        // Process batch concurrently
        const batchRecords = await Promise.all(
          batch.map((doc) => this.extractRecord(doc, schema, options))
        );

        records.push(...batchRecords);

        logger.info('Batch completed', {
          batch: currentBatch,
          totalBatches,
          recordsExtracted: batchRecords.length,
          totalRecords: records.length,
        });
      }

      logger.info('Batch extraction completed', {
        totalDocuments: documents.length,
        totalRecords: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Batch extraction failed', error as Error, {
        totalDocuments: documents.length,
        recordsExtracted: records.length,
      });
      throw error;
    }
  }

  /**
   * Build extraction prompt from document and schema
   *
   * @param document - Document text to extract from
   * @param schema - JSON Schema defining structure
   * @returns Formatted prompt for LLM
   */
  private buildExtractionPrompt(document: string, schema: JSONSchema): string {
    // Build property details section
    const propertyDetails = this.buildPropertyDetailsSection(schema);

    // Build schema section (compact JSON representation)
    const schemaJson = JSON.stringify(
      {
        title: schema.title,
        description: schema.description,
        type: 'object',
        properties: schema.properties,
        required: schema.required,
      },
      null,
      2
    );

    // Use custom template or default template
    const template = this.promptTemplate || this.getDefaultPromptTemplate();

    // Replace placeholders
    return template
      .replace('{document}', document.trim())
      .replace('{schema}', schemaJson)
      .replace('{property_details}', propertyDetails);
  }

  /**
   * Build detailed property information for the prompt
   */
  private buildPropertyDetailsSection(schema: JSONSchema): string {
    const properties = schema.getPropertyNames().map((propName) => {
      const property = schema.getProperty(propName);
      if (!property) {
        return '';
      }

      const type = property.type;
      const description = property.description;
      const examples = property.examples;
      const required = schema.isRequired(propName);

      let details = `- **${propName}** (${type})`;
      if (required) {
        details += ' [REQUIRED]';
      }
      if (description) {
        details += `\n  Description: ${description}`;
      }
      if (examples && examples.length > 0) {
        details += `\n  Examples: ${examples.map((ex: string | number | boolean) => JSON.stringify(ex)).join(', ')}`;
      }
      return details;
    });

    return properties.join('\n\n');
  }

  /**
   * Get default prompt template
   */
  private getDefaultPromptTemplate(): string {
    return `You are an expert data extraction system tasked with extracting structured information from a document based on a predefined JSON Schema.

## Task

Extract structured data from the following document according to the provided schema. Read the document carefully and extract the requested information as accurately as possible.

## Document

{document}

## Schema

{schema}

## Extraction Requirements

1. **Follow the Schema**: Extract data for each property defined in the schema
2. **Type Accuracy**: Ensure each value matches the expected type (string, number, integer, boolean)
3. **Handle Missing Data**: If information is not available in the document, use \`null\` for that field
4. **No Assumptions**: Only extract information explicitly stated in the document - do not infer or guess
5. **Standardize Values**: When possible, standardize formats:
   - Numbers: Convert abbreviated forms (e.g., "1M" → 1000000, "5K" → 5000, "2.5B" → 2500000000)
   - Booleans: Convert text to boolean (e.g., "yes" → true, "no" → false)
   - Strings: Use the exact text from the document, trimmed of extra whitespace

## Property Details

{property_details}

## Output Format

Return ONLY a valid JSON object with the extracted data. Do not include any explanations, markdown formatting, or additional text.

The output must be a single JSON object with keys matching the schema properties:

{{
  "property1": "value1",
  "property2": 123,
  "property3": true,
  "property4": null
}}

## Important Notes

- If a value is not found in the document, use \`null\`
- If a value is found but in a different format, standardize it according to the type
- Do not add properties not defined in the schema
- Ensure all required properties are present (even if \`null\`)
- For numeric values with suffixes (K, M, B), convert to full numbers
- For boolean-like text (yes/no, true/false), convert to actual booleans
- Remove currency symbols, commas, and other formatting from numbers

## Example

If the schema asks for "population" (integer) and the document says "Population: 2.5M", extract as:
{{ "population": 2500000 }}

If the schema asks for "is_active" (boolean) and the document says "Status: Active", extract as:
{{ "is_active": true }}

If the schema asks for "founded_year" (integer) but it's not mentioned in the document, extract as:
{{ "founded_year": null }}

Now extract the data from the document above and return ONLY the JSON object.`;
  }

  /**
   * Parse LLM response into record data
   *
   * @param response - LLM response text
   * @param schema - JSON Schema for validation
   * @returns Parsed record data
   * @throws Error if JSON cannot be extracted or parsed
   */
  private parseRecordResponse(response: string, _schema: JSONSchema): RecordData {
    logger.debug('Parsing record response', {
      responseLength: response.length,
    });

    // Try to extract JSON from response
    // Look for JSON object in the response (handles markdown code blocks)
    let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(jsonMatch[1]);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return parsed as RecordData;
        }
      } catch (error) {
        logger.debug('Failed to parse JSON from markdown block', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Try to extract plain JSON object
    jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return parsed as RecordData;
        }
      } catch (error) {
        logger.debug('Failed to parse JSON from plain text', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // If no JSON found, throw error
    logger.error('No valid JSON found in LLM response', new Error('Invalid response format'), {
      responsePreview: response.substring(0, 200),
    });
    throw new Error('No valid JSON found in LLM response');
  }
}

/**
 * Create a default RecordExtractor instance
 *
 * @param llmClient - LLM client for extraction
 * @param promptTemplatePath - Optional path to custom prompt template (defaults to prompts/record-extraction.txt)
 * @returns RecordExtractor instance
 *
 * @example
 * ```typescript
 * const extractor = createRecordExtractor(llmClient);
 * const records = await extractor.batchExtract(documents, schema);
 * ```
 */
export function createRecordExtractor(
  llmClient: LLMClient,
  promptTemplatePath?: string
): RecordExtractor {
  return new RecordExtractor(llmClient, promptTemplatePath);
}
