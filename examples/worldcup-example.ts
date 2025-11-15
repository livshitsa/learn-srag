/**
 * World Cup Example - S-RAG for Sports Data
 *
 * This example demonstrates S-RAG with World Cup 2022 match data:
 * - Extracting structured data from match reports
 * - Answering aggregative questions about multiple matches
 * - Handling complex nested data (scores, statistics, lineups)
 *
 * Run with: npm run example:worldcup
 */

import { readFileSync, readdirSync } from 'fs';
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

async function main(): Promise<void> {
  console.log('\n=== S-RAG World Cup 2022 Example ===\n');

  try {
    // Validate API keys
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file'
      );
    }

    // Initialize components
    console.log('Initializing LLM client...');
    const llmClient = new LLMClient(
      process.env.OPENAI_API_KEY,
      process.env.ANTHROPIC_API_KEY
    );

    // Load match documents
    console.log('\nLoading World Cup match documents...');
    const wcDir = join(process.cwd(), 'data', 'datasets', 'worldcup');
    const matchFiles = readdirSync(wcDir).filter(f => f.startsWith('match') && f.endsWith('.txt'));
    const matchDocs = matchFiles.map(f =>
      readFileSync(join(wcDir, f), 'utf-8')
    );
    console.log(`Loaded ${matchDocs.length} match reports`);

    // Load questions
    console.log('Loading sample questions...');
    const questionsPath = join(wcDir, 'questions.txt');
    const questionsText = readFileSync(questionsPath, 'utf-8');
    const sampleQuestions = questionsText
      .split('\n')
      .filter(q => q.trim().length > 0)
      .slice(0, 5);
    console.log(`Loaded ${sampleQuestions.length} sample questions`);

    // STEP 1: Schema Prediction
    console.log('\n--- STEP 1: Schema Prediction ---');
    console.log('Analyzing match reports to predict schema...');

    const predictor = new SchemaPredictor(llmClient);
    const schema = await predictor.predictSchema(
      matchDocs.slice(0, 2), // Use first 2 matches as samples
      sampleQuestions
    );

    console.log('\nGenerated Schema:');
    console.log(JSON.stringify(schema, null, 2));

    // STEP 2: Record Extraction
    console.log('\n--- STEP 2: Record Extraction ---');
    console.log('Extracting structured data from all match reports...');

    const extractor = new RecordExtractor(llmClient);
    const records = await extractor.batchExtract(matchDocs, schema, { batchSize: 5 });

    console.log(`\nExtracted ${records.length} match records`);
    console.log('Sample record:');
    console.log(JSON.stringify(records[0], null, 2));

    // STEP 3: Database Setup
    console.log('\n--- STEP 3: Database Setup ---');
    const dbPath = join(process.cwd(), 'data', 'databases', 'worldcup-example.db');
    console.log(`Creating database: ${dbPath}`);

    const db = new DatabaseManager(dbPath);
    const tableName = 'matches';

    db.createTableFromSchema(schema, tableName);
    db.insertRecords(records, tableName);
    console.log(`Inserted ${records.length} records`);

    const statsCalc = new StatisticsCalculator(db);
    const stats = statsCalc.getAllStatistics(tableName);
    console.log('\nDatabase Statistics:');
    console.log(statsCalc.formatCompact(stats));

    // STEP 4: Query & Answer
    console.log('\n--- STEP 4: Natural Language Queries ---');

    const translator = new TextToSQL(llmClient);
    const executor = new QueryExecutor(db);
    const generator = new AnswerGenerator(llmClient);

    const queries = [
      "What was the total attendance across all matches?",
      "Which match had the highest number of total goals?",
      "How many yellow cards were shown in total?",
      "What was the average temperature across all matches?",
      "Which team(s) appeared in the most matches?"
    ];

    for (const question of queries) {
      console.log(`\n📝 Question: ${question}`);

      try {
        const sql = await translator.translate(question, schema, stats, tableName);
        console.log(`   SQL: ${sql}`);

        const results = executor.executeAndFormat(sql);
        console.log(`   Results: ${JSON.stringify(results)}`);

        const answer = await generator.generateAnswer(question, results, sql);
        console.log(`   ✅ Answer: ${answer}`);
      } catch (error) {
        console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    db.close();

    console.log('\n=== World Cup Example Complete! ===\n');
    console.log('Summary:');
    console.log(`- Match reports processed: ${matchDocs.length}`);
    console.log(`- Records extracted: ${records.length}`);
    console.log(`- Queries answered: ${queries.length}`);
    console.log(`\nDatabase saved at: ${dbPath}`);

  } catch (error) {
    logger.error('Error in worldcup example', { error });
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
