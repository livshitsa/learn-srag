/**
 * Custom Corpus Example - Template for Your Own Data
 *
 * This example provides a template for using S-RAG with your own corpus of documents.
 * Follow the steps below and customize for your specific use case.
 *
 * Steps to adapt this template:
 * 1. Prepare your documents (text, HTML, markdown, etc.)
 * 2. Create sample questions relevant to your domain
 * 3. Update the file paths to point to your data
 * 4. Run the example and iterate on your schema/questions
 *
 * Run with: npm run example:custom
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { LLMClient } from '../src/llm/llm-client.js';
import { SchemaPredictor } from '../src/ingestion/schema-predictor.js';
import { RecordExtractor } from '../src/ingestion/record-extractor.js';
import { DatabaseManager } from '../src/database/database-manager.js';
import { StatisticsCalculator } from '../src/ingestion/statistics-calculator.js';
import { TextToSQL } from '../src/inference/text-to-sql.js';
import { QueryExecutor } from '../src/inference/query-executor.js';
import { AnswerGenerator } from '../src/inference/answer-generator.js';
import { logger } from '../src/utils/logger.js';

/**
 * Configuration - Customize these values for your corpus
 */
const CONFIG = {
  // Directory containing your documents
  documentsDir: join(process.cwd(), 'data', 'datasets', 'custom'),

  // Pattern to match your document files (e.g., '*.txt', '*.html', '*.md')
  documentPattern: /\.(txt|md|html)$/,

  // Path to your questions file (one question per line)
  questionsFile: join(process.cwd(), 'data', 'datasets', 'custom', 'questions.txt'),

  // Number of sample documents to use for schema prediction
  sampleDocCount: 3,

  // Number of sample questions to use for schema prediction
  sampleQuestionCount: 5,

  // Batch size for record extraction (adjust based on document complexity)
  batchSize: 10,

  // Database path
  dbPath: join(process.cwd(), 'data', 'databases', 'custom-corpus.db'),

  // Table name
  tableName: 'records',
};

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('\n=== S-RAG Custom Corpus Example ===\n');
  console.log('This template helps you apply S-RAG to your own documents.');
  console.log('Customize the CONFIG object above for your specific use case.\n');

  try {
    // Validate API keys
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'API key required! Set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file'
      );
    }

    // Check if custom data directory exists
    if (!existsSync(CONFIG.documentsDir)) {
      console.log('\n⚠️  Custom data directory not found!\n');
      console.log('To use this example:');
      console.log(`1. Create directory: ${CONFIG.documentsDir}`);
      console.log('2. Add your document files (txt, md, html, etc.)');
      console.log('3. Create a questions.txt file with sample questions (one per line)');
      console.log('4. Update the CONFIG object in this file if needed');
      console.log('5. Run the example again\n');
      console.log('For reference, see the hotels or worldcup examples.');
      return;
    }

    // Initialize LLM client
    console.log('✓ Initializing LLM client...');
    const llmClient = new LLMClient(
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY
    );

    // STEP 1: Load Documents
    console.log('\n--- STEP 1: Loading Documents ---');
    const files = readdirSync(CONFIG.documentsDir).filter(f =>
      CONFIG.documentPattern.test(f)
    );

    if (files.length === 0) {
      throw new Error(
        `No documents found matching pattern ${CONFIG.documentPattern} in ${CONFIG.documentsDir}`
      );
    }

    const documents = files.map(f =>
      readFileSync(join(CONFIG.documentsDir, f), 'utf-8')
    );
    console.log(`✓ Loaded ${documents.length} documents`);

    // STEP 2: Load Questions
    console.log('\n--- STEP 2: Loading Questions ---');
    if (!existsSync(CONFIG.questionsFile)) {
      throw new Error(
        `Questions file not found: ${CONFIG.questionsFile}\n` +
        'Create this file with one question per line.'
      );
    }

    const questionsText = readFileSync(CONFIG.questionsFile, 'utf-8');
    const allQuestions = questionsText
      .split('\n')
      .filter(q => q.trim().length > 0);

    if (allQuestions.length === 0) {
      throw new Error('No questions found in questions file');
    }

    const sampleQuestions = allQuestions.slice(0, CONFIG.sampleQuestionCount);
    console.log(`✓ Loaded ${allQuestions.length} questions (using ${sampleQuestions.length} for schema)`);

    // STEP 3: Schema Prediction
    console.log('\n--- STEP 3: Schema Prediction ---');
    console.log('Analyzing documents to predict optimal schema...');
    console.log('(This may take a few minutes)');

    const predictor = new SchemaPredictor(llmClient);
    const sampleDocs = documents.slice(0, CONFIG.sampleDocCount);

    const schema = await predictor.predictSchema(sampleDocs, sampleQuestions);

    console.log('\n✓ Schema Generated:');
    console.log(JSON.stringify(schema, null, 2));
    console.log(`\nSchema contains ${Object.keys(schema.properties || {}).length} properties`);

    // Save schema for future use
    const schemaPath = join(CONFIG.documentsDir, 'schema.json');
    await predictor.saveSchema(schema, schemaPath);
    console.log(`✓ Schema saved to: ${schemaPath}`);

    // STEP 4: Record Extraction
    console.log('\n--- STEP 4: Record Extraction ---');
    console.log(`Extracting structured records from ${documents.length} documents...`);

    const extractor = new RecordExtractor(llmClient);
    const records = await extractor.batchExtract(documents, schema, {
      batchSize: CONFIG.batchSize,
    });

    console.log(`\n✓ Extracted ${records.length} records`);
    if (records.length > 0) {
      console.log('\nSample record:');
      console.log(JSON.stringify(records[0], null, 2));
    }

    // STEP 5: Database Creation
    console.log('\n--- STEP 5: Database Creation ---');
    console.log(`Creating database: ${CONFIG.dbPath}`);

    const db = new DatabaseManager(CONFIG.dbPath);

    // Create table from schema
    db.createTableFromSchema(schema, CONFIG.tableName);
    console.log(`✓ Created table: ${CONFIG.tableName}`);

    // Insert records
    db.insertRecords(records, CONFIG.tableName);
    console.log(`✓ Inserted ${records.length} records`);

    // Calculate and display statistics
    const statsCalc = new StatisticsCalculator(db);
    const stats = statsCalc.getAllStatistics(CONFIG.tableName);

    console.log('\nDatabase Statistics:');
    console.log(statsCalc.formatCompact(stats));

    // STEP 6: Natural Language Querying
    console.log('\n--- STEP 6: Query & Answer ---');
    console.log('Testing queries from your questions file...\n');

    const translator = new TextToSQL(llmClient);
    const executor = new QueryExecutor(db);
    const generator = new AnswerGenerator(llmClient);

    // Use first few questions as test queries
    const testQueries = allQuestions.slice(0, Math.min(5, allQuestions.length));

    for (let i = 0; i < testQueries.length; i++) {
      const question = testQueries[i];
      console.log(`\n[${i + 1}/${testQueries.length}] 📝 Question: ${question}`);

      try {
        // Translate to SQL
        const sql = await translator.translate(
          question,
          schema,
          stats,
          CONFIG.tableName
        );
        console.log(`    SQL: ${sql}`);

        // Execute query
        const results = executor.executeAndFormat(sql);
        console.log(`    Raw Results: ${JSON.stringify(results)}`);

        // Generate natural language answer
        const answer = await generator.generateAnswer(question, results, sql);
        console.log(`    ✅ Answer: ${answer}`);
      } catch (error) {
        console.error(
          `    ❌ Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Close database
    db.close();

    // Summary
    console.log('\n=== Custom Corpus Example Complete! ===\n');
    console.log('Summary:');
    console.log(`✓ Documents processed: ${documents.length}`);
    console.log(`✓ Records extracted: ${records.length}`);
    console.log(`✓ Schema properties: ${Object.keys(schema.properties || {}).length}`);
    console.log(`✓ Test queries answered: ${testQueries.length}`);
    console.log(`\nOutputs:`);
    console.log(`- Database: ${CONFIG.dbPath}`);
    console.log(`- Schema: ${schemaPath}`);
    console.log('\nNext steps:');
    console.log('- Review the generated schema and refine your questions if needed');
    console.log('- Test more queries to evaluate accuracy');
    console.log('- Adjust batch size or sample counts based on results');
    console.log('- Use the database for your application!\n');

  } catch (error) {
    logger.error('Error in custom corpus example', { error });
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    console.error('\nTroubleshooting:');
    console.error('- Ensure your documents directory exists and contains files');
    console.error('- Ensure your questions.txt file exists with at least one question');
    console.error('- Check that your API keys are correctly set in .env');
    console.error('- Review the error message above for specific issues\n');
    process.exit(1);
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
