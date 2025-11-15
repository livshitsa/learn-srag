/**
 * Hotels Example - Complete S-RAG Workflow
 *
 * This example demonstrates the full S-RAG pipeline using hotel data:
 * 1. Schema prediction from sample documents and questions
 * 2. Record extraction from all hotel documents
 * 3. Database creation and data ingestion
 * 4. Natural language querying with Text-to-SQL
 * 5. Answer generation from query results
 *
 * Run with: npm run example:hotels
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import S-RAG components
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
 * Main function to run the hotels example
 */
async function main(): Promise<void> {
  console.log('\n=== S-RAG Hotels Example ===\n');

  try {
    // Check for API keys
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'No API keys found. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file'
      );
    }

    // Initialize LLM client
    console.log('Initializing LLM client...');
    const llmClient = new LLMClient(
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY
    );

    // Load hotel documents
    console.log('\nLoading hotel documents...');
    const hotelsDir = join(process.cwd(), 'data', 'datasets', 'hotels');
    const hotelFiles = readdirSync(hotelsDir).filter(f => f.startsWith('hotel') && f.endsWith('.txt'));
    const hotelDocs = hotelFiles.map(f =>
      readFileSync(join(hotelsDir, f), 'utf-8')
    );
    console.log(`Loaded ${hotelDocs.length} hotel documents`);

    // Load sample questions
    console.log('Loading sample questions...');
    const questionsPath = join(hotelsDir, 'questions.txt');
    const questionsText = readFileSync(questionsPath, 'utf-8');
    const sampleQuestions = questionsText
      .split('\n')
      .filter(q => q.trim().length > 0)
      .slice(0, 5); // Use first 5 questions for schema prediction
    console.log(`Loaded ${sampleQuestions.length} sample questions for schema prediction`);

    // STEP 1: Schema Prediction
    console.log('\n--- STEP 1: Schema Prediction ---');
    console.log('Predicting schema from sample documents and questions...');
    console.log('(This may take a few minutes with 4 iterations of refinement)');

    const predictor = new SchemaPredictor(llmClient);
    const schema = await predictor.predictSchema(
      hotelDocs.slice(0, 3), // Use first 3 documents as samples
      sampleQuestions
    );

    console.log('\nGenerated Schema:');
    console.log(JSON.stringify(schema, null, 2));
    console.log(`\nSchema has ${Object.keys(schema.properties || {}).length} properties`);

    // STEP 2: Record Extraction
    console.log('\n--- STEP 2: Record Extraction ---');
    console.log('Extracting structured records from all hotel documents...');

    const extractor = new RecordExtractor(llmClient);
    const records = await extractor.batchExtract(hotelDocs, schema, { batchSize: 5 });

    console.log(`\nExtracted ${records.length} records`);
    console.log('Sample record:');
    console.log(JSON.stringify(records[0], null, 2));

    // STEP 3: Database Creation and Ingestion
    console.log('\n--- STEP 3: Database Creation ---');
    const dbPath = join(process.cwd(), 'data', 'databases', 'hotels-example.db');
    console.log(`Creating database at: ${dbPath}`);

    const db = new DatabaseManager(dbPath);
    const tableName = 'hotels';

    // Create table from schema
    db.createTableFromSchema(schema, tableName);
    console.log(`Created table: ${tableName}`);

    // Insert records
    db.insertRecords(records, tableName);
    console.log(`Inserted ${records.length} records into database`);

    // Calculate statistics
    const statsCalc = new StatisticsCalculator(db);
    const stats = statsCalc.getAllStatistics(tableName);
    console.log('\nDatabase Statistics:');
    console.log(statsCalc.formatCompact(stats));

    // STEP 4: Natural Language Querying
    console.log('\n--- STEP 4: Querying with Natural Language ---');

    const translator = new TextToSQL(llmClient);
    const executor = new QueryExecutor(db);
    const generator = new AnswerGenerator(llmClient);

    // Example queries
    const queries = [
      "What is the average price of a standard room?",
      "Which hotel has the highest rating?",
      "How many hotels allow pets?",
      "What is the total room capacity across all hotels?",
      "Which hotels were built after 2010?"
    ];

    for (const question of queries) {
      console.log(`\n📝 Question: ${question}`);

      try {
        // Translate to SQL
        const sql = await translator.translate(question, schema, stats, tableName);
        console.log(`   SQL: ${sql}`);

        // Execute query
        const results = executor.executeAndFormat(sql);
        console.log(`   Results: ${JSON.stringify(results)}`);

        // Generate natural language answer
        const answer = await generator.generateAnswer(question, results, sql);
        console.log(`   ✅ Answer: ${answer}`);
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Close database
    db.close();

    console.log('\n=== Hotels Example Complete! ===\n');
    console.log('Summary:');
    console.log(`- Documents processed: ${hotelDocs.length}`);
    console.log(`- Records extracted: ${records.length}`);
    console.log(`- Schema properties: ${Object.keys(schema.properties || {}).length}`);
    console.log(`- Queries executed: ${queries.length}`);
    console.log(`\nDatabase saved at: ${dbPath}`);

  } catch (error) {
    logger.error('Error in hotels example', { error });
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
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
