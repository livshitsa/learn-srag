#!/usr/bin/env node

/**
 * S-RAG CLI Interface
 * Command-line interface for S-RAG operations
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import {
  runIngestion,
  runQuery,
  runEvaluation,
  type IngestionOptions,
  type QueryOptions,
  type EvaluationOptions,
} from './index.js';
import { readFileAsText, readJSONFile, writeJSONFile } from './utils/helpers.js';
import { logger } from './utils/logger.js';
import { JSONSchema } from './models/schema.js';

const program = new Command();

/**
 * Format duration in milliseconds to human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Load documents from file or directory
 */
async function loadDocuments(path: string): Promise<string[]> {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Documents path not found: ${path}`);
  }

  // Check if it's a JSON file
  if (path.endsWith('.json')) {
    const result = await readJSONFile(absolutePath);
    if (!result.success) {
      throw result.error;
    }
    const data = result.data;
    if (Array.isArray(data)) {
      return data.map((doc: unknown) => (typeof doc === 'string' ? doc : JSON.stringify(doc)));
    }
    throw new Error('JSON file must contain an array of documents');
  }

  // Check if it's a text file
  if (path.endsWith('.txt')) {
    const result = await readFileAsText(absolutePath);
    if (!result.success) {
      throw result.error;
    }
    const content = result.data;
    // Split by double newlines or similar delimiter
    return content
      .split('\n\n')
      .map((doc: string) => doc.trim())
      .filter((doc: string) => doc.length > 0);
  }

  throw new Error(
    'Documents file must be .json (array) or .txt (separated by double newlines)'
  );
}

/**
 * Load questions from file
 */
async function loadQuestions(path: string): Promise<string[]> {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new Error(`Questions path not found: ${path}`);
  }

  // Check if it's a JSON file
  if (path.endsWith('.json')) {
    const result = await readJSONFile(absolutePath);
    if (!result.success) {
      throw result.error;
    }
    const data = result.data;
    if (Array.isArray(data)) {
      return data.map((q: unknown) => (typeof q === 'string' ? q : JSON.stringify(q)));
    }
    throw new Error('JSON file must contain an array of questions');
  }

  // Check if it's a text file
  if (path.endsWith('.txt')) {
    const result = await readFileAsText(absolutePath);
    if (!result.success) {
      throw result.error;
    }
    const content = result.data;
    return content
      .split('\n')
      .map((q: string) => q.trim())
      .filter((q: string) => q.length > 0);
  }

  throw new Error('Questions file must be .json (array) or .txt (one per line)');
}

/**
 * Ingest command
 */
program
  .command('ingest')
  .description('Ingest documents and create structured database')
  .requiredOption('--docs <path>', 'Path to documents file (.json or .txt)')
  .requiredOption('--questions <path>', 'Path to questions file (.json or .txt)')
  .requiredOption('--db <path>', 'Path to database file')
  .requiredOption('--table <name>', 'Table name')
  .option('--schema <path>', 'Path to existing schema file (optional)')
  .option('--sample-size <number>', 'Number of sample documents for schema generation', '12')
  .option(
    '--question-sample-size <number>',
    'Number of sample questions for schema generation',
    '10'
  )
  .option('--batch-size <number>', 'Batch size for record extraction', '10')
  .option('--output <path>', 'Path to save ingestion result JSON (optional)')
  .action(async (options) => {
    const spinner = ora('Starting ingestion...').start();

    try {
      // Load documents and questions
      spinner.text = 'Loading documents...';
      const documents = await loadDocuments(options.docs);
      spinner.succeed(`Loaded ${documents.length} documents`);

      spinner.start('Loading questions...');
      const questions = await loadQuestions(options.questions);
      spinner.succeed(`Loaded ${questions.length} questions`);

      // Load schema if provided
      let schema: JSONSchema | undefined;
      if (options.schema) {
        spinner.start('Loading schema...');
        const result = await readJSONFile(resolve(options.schema));
        if (!result.success) {
          throw result.error;
        }
        schema = new JSONSchema(result.data as Record<string, unknown>);
        spinner.succeed('Schema loaded');
      }

      // Run ingestion
      spinner.start('Running ingestion pipeline...');
      const ingestionOptions: IngestionOptions = {
        documents,
        questions,
        dbPath: resolve(options.db),
        tableName: options.table,
        sampleSize: parseInt(options.sampleSize),
        questionSampleSize: parseInt(options.questionSampleSize),
        batchSize: parseInt(options.batchSize),
        schema,
      };

      const result = await runIngestion(ingestionOptions);
      spinner.succeed('Ingestion complete!');

      // Display results
      console.log('');
      console.log(chalk.bold.green('Ingestion Results:'));
      console.log(chalk.cyan('  Table:'), options.table);
      console.log(chalk.cyan('  Database:'), options.db);
      console.log(chalk.cyan('  Records:'), result.recordCount);
      console.log(
        chalk.cyan('  Attributes:'),
        Object.keys(result.schema.properties).length
      );
      console.log('');
      console.log(chalk.bold('Schema Attributes:'));
      for (const [name, def] of Object.entries(result.schema.properties)) {
        console.log(
          chalk.gray('  -'),
          chalk.yellow(name),
          chalk.gray(`(${def.type}):`),
          def.description
        );
      }

      // Save output if specified
      if (options.output) {
        const outputPath = resolve(options.output);
        const writeResult = await writeJSONFile(outputPath, {
          schema: result.schema.toJSON(),
          tableName: result.tableName,
          dbPath: result.dbPath,
          recordCount: result.recordCount,
          statistics: result.statistics,
        });
        if (!writeResult.success) {
          throw writeResult.error;
        }
        console.log('');
        console.log(chalk.cyan('Result saved to:'), outputPath);
      }

      console.log('');
      console.log(chalk.green('✓'), 'Ingestion completed successfully!');
    } catch (error) {
      spinner.fail('Ingestion failed');
      console.error('');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        logger.error('Ingestion error', { error: error.stack });
      }
      process.exit(1);
    }
  });

/**
 * Query command
 */
program
  .command('query')
  .description('Query the structured database with natural language')
  .requiredOption('--question <text>', 'Question to answer')
  .requiredOption('--db <path>', 'Path to database file')
  .requiredOption('--table <name>', 'Table name')
  .option('--schema <path>', 'Path to schema file (optional if schema path is known)')
  .option('--output <path>', 'Path to save query result JSON (optional)')
  .action(async (options) => {
    const spinner = ora('Processing query...').start();

    try {
      // Load schema if provided
      let schemaPath: string | undefined;
      if (options.schema) {
        schemaPath = resolve(options.schema);
        if (!existsSync(schemaPath)) {
          throw new Error(`Schema file not found: ${options.schema}`);
        }
      } else {
        // Try to find schema in data/schemas directory
        const defaultSchemaPath = join(
          process.cwd(),
          'data',
          'schemas',
          `${options.table}.json`
        );
        if (existsSync(defaultSchemaPath)) {
          schemaPath = defaultSchemaPath;
          spinner.info(`Using schema from: ${defaultSchemaPath}`);
        }
      }

      // Run query
      spinner.start('Translating question to SQL...');
      const queryOptions: QueryOptions = {
        question: options.question,
        dbPath: resolve(options.db),
        tableName: options.table,
        schemaPath,
      };

      const result = await runQuery(queryOptions);
      spinner.succeed('Query complete!');

      // Display results
      console.log('');
      console.log(chalk.bold.green('Query Results:'));
      console.log(chalk.cyan('  Question:'), options.question);
      console.log('');
      console.log(chalk.bold('Generated SQL:'));
      console.log(chalk.gray('  ' + result.sql));
      console.log('');
      console.log(chalk.bold('Results:'));
      console.log(
        chalk.gray('  ' + JSON.stringify(result.results, null, 2).split('\n').join('\n  '))
      );
      console.log('');
      console.log(chalk.bold.yellow('Answer:'));
      console.log('  ' + result.answer);
      console.log('');

      // Display metadata
      if (result.metadata) {
        console.log(chalk.bold('Performance:'));
        console.log(
          chalk.gray('  SQL Generation:'),
          formatDuration(result.metadata.sqlGenerationTime || 0)
        );
        console.log(
          chalk.gray('  Execution:'),
          formatDuration(result.metadata.executionTime || 0)
        );
        console.log(
          chalk.gray('  Answer Generation:'),
          formatDuration(result.metadata.answerGenerationTime || 0)
        );
        console.log(chalk.gray('  Total:'), formatDuration(result.metadata.totalTime));
      }

      // Save output if specified
      if (options.output) {
        const outputPath = resolve(options.output);
        const writeResult = await writeJSONFile(outputPath, result);
        if (!writeResult.success) {
          throw writeResult.error;
        }
        console.log('');
        console.log(chalk.cyan('Result saved to:'), outputPath);
      }

      console.log('');
      console.log(chalk.green('✓'), 'Query completed successfully!');
    } catch (error) {
      spinner.fail('Query failed');
      console.error('');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        logger.error('Query error', { error: error.stack });
      }
      process.exit(1);
    }
  });

/**
 * Evaluate command
 */
program
  .command('evaluate')
  .description('Evaluate system performance on test dataset')
  .requiredOption('--dataset <path>', 'Path to test dataset JSON file')
  .option('--output <path>', 'Path to save evaluation result JSON (optional)')
  .action(async (options) => {
    const spinner = ora('Loading test dataset...').start();

    try {
      // Load test dataset
      const datasetPath = resolve(options.dataset);
      if (!existsSync(datasetPath)) {
        throw new Error(`Dataset file not found: ${options.dataset}`);
      }

      const result = await readJSONFile(datasetPath);
      if (!result.success) {
        throw result.error;
      }

      const testCases = result.data;
      if (!Array.isArray(testCases)) {
        throw new Error('Dataset must be an array of test cases');
      }

      spinner.succeed(`Loaded ${testCases.length} test cases`);

      // Validate test cases
      for (const tc of testCases) {
        if (!tc.question || !tc.gold_answer || !tc.predicted_answer) {
          throw new Error(
            'Each test case must have question, gold_answer, and predicted_answer'
          );
        }
      }

      // Run evaluation
      spinner.start('Running evaluation...');
      const evaluationOptions: EvaluationOptions = { testCases };
      const evalResult = await runEvaluation(evaluationOptions);
      spinner.succeed('Evaluation complete!');

      // Display results
      console.log('');
      console.log(chalk.bold.green('Evaluation Results:'));
      console.log(chalk.cyan('  Test Cases:'), evalResult.num_examples);
      console.log(
        chalk.cyan('  Answer Comparison (Accuracy):'),
        (evalResult.answer_comparison * 100).toFixed(2) + '%'
      );
      console.log(
        chalk.cyan('  Answer Recall:'),
        (evalResult.answer_recall * 100).toFixed(2) + '%'
      );
      console.log('');

      // Display per-example results
      console.log(chalk.bold('Per-Example Results:'));
      for (let i = 0; i < evalResult.per_example_results.length; i++) {
        const ex = evalResult.per_example_results[i];
        const status = ex.is_correct ? chalk.green('✓') : chalk.red('✗');
        console.log(
          `  ${status}`,
          chalk.gray(`[${i + 1}/${evalResult.num_examples}]`),
          chalk.gray(ex.question.substring(0, 60) + '...'),
          chalk.yellow(`(recall: ${(ex.recall * 100).toFixed(0)}%)`)
        );
      }

      // Save output if specified
      if (options.output) {
        const outputPath = resolve(options.output);
        const writeResult = await writeJSONFile(outputPath, evalResult);
        if (!writeResult.success) {
          throw writeResult.error;
        }
        console.log('');
        console.log(chalk.cyan('Result saved to:'), outputPath);
      }

      console.log('');
      console.log(chalk.green('✓'), 'Evaluation completed successfully!');
    } catch (error) {
      spinner.fail('Evaluation failed');
      console.error('');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        logger.error('Evaluation error', { error: error.stack });
      }
      process.exit(1);
    }
  });

// Program configuration
program
  .name('srag')
  .description('S-RAG - Structured RAG for Answering Aggregative Questions')
  .version('1.0.0');

// Add examples to help
program.addHelpText(
  'after',
  `
${chalk.bold('Examples:')}

  ${chalk.cyan('Ingest documents:')}
    $ srag ingest --docs data/documents.json --questions data/questions.txt --db data/my.db --table records

  ${chalk.cyan('Query with natural language:')}
    $ srag query --question "What is the average price?" --db data/my.db --table records --schema data/schemas/records.json

  ${chalk.cyan('Evaluate system performance:')}
    $ srag evaluate --dataset data/test-cases.json --output results/evaluation.json

${chalk.bold('For more information:')}
  Visit: https://github.com/your-repo/learn-srag
`
);

// Parse command-line arguments
program.parse();
