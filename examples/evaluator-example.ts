/**
 * Example: Using the Evaluator to assess answer quality
 *
 * This example demonstrates how to use the Evaluator class to:
 * 1. Compare predicted answers against gold answers
 * 2. Calculate answer recall based on claim coverage
 * 3. Evaluate a dataset of test cases
 */

import { createLLMClient } from '../src/llm/llm-client.js';
import { createEvaluator } from '../src/evaluation/evaluator.js';
import { TestCase } from '../src/models/types.js';

async function main() {
  // Initialize LLM client and evaluator
  const llmClient = createLLMClient();
  const evaluator = createEvaluator(llmClient);

  console.log('=== S-RAG Evaluator Example ===\n');

  // Example 1: Answer Comparison
  console.log('Example 1: Answer Comparison (Binary Judgment)');
  console.log('------------------------------------------------');

  const question1 = 'What is the capital of France?';
  const goldAnswer1 = 'Paris';
  const predictedAnswer1 = 'The capital of France is Paris.';

  const isCorrect1 = await evaluator.answerComparison(
    question1,
    goldAnswer1,
    predictedAnswer1
  );

  console.log(`Question: ${question1}`);
  console.log(`Gold Answer: ${goldAnswer1}`);
  console.log(`Predicted Answer: ${predictedAnswer1}`);
  console.log(`Is Correct: ${isCorrect1 ? '✓ Yes' : '✗ No'}\n`);

  // Example 2: Answer Recall
  console.log('Example 2: Answer Recall (Claim Coverage)');
  console.log('------------------------------------------');

  const goldAnswer2 =
    'Paris is the capital of France and has a population of approximately 2.1 million people.';
  const predictedAnswer2 = 'Paris is the capital of France.';

  const recall2 = await evaluator.answerRecall(goldAnswer2, predictedAnswer2);

  console.log(`Gold Answer: ${goldAnswer2}`);
  console.log(`Predicted Answer: ${predictedAnswer2}`);
  console.log(`Recall Score: ${(recall2 * 100).toFixed(1)}%\n`);

  // Example 3: Dataset Evaluation
  console.log('Example 3: Dataset Evaluation');
  console.log('------------------------------');

  const testCases: TestCase[] = [
    {
      question: 'What is 2+2?',
      goldAnswer: '4',
      predictedAnswer: 'The answer is 4',
    },
    {
      question: 'What is the capital of Japan?',
      goldAnswer: 'Tokyo',
      predictedAnswer: 'Tokyo',
    },
    {
      question: 'Who wrote Romeo and Juliet?',
      goldAnswer: 'William Shakespeare',
      predictedAnswer: 'Shakespeare wrote it',
    },
  ];

  console.log(`Evaluating ${testCases.length} test cases...\n`);

  const results = await evaluator.evaluateDataset(testCases);

  console.log('Evaluation Results:');
  console.log(`  Total Examples: ${results.numExamples}`);
  console.log(
    `  Answer Comparison (Accuracy): ${(results.answerComparison * 100).toFixed(1)}%`
  );
  console.log(`  Answer Recall (Avg): ${(results.answerRecall * 100).toFixed(1)}%\n`);

  console.log('Per-Example Results:');
  results.perExampleResults.forEach((result, i) => {
    console.log(`  ${i + 1}. ${result.question}`);
    console.log(`     Correct: ${result.isCorrect ? '✓' : '✗'}`);
    console.log(`     Recall: ${(result.recall * 100).toFixed(1)}%`);
  });

  console.log('\n=== Evaluation Complete ===');
}

// Run the example
main().catch(console.error);
