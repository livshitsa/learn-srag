/**
 * Evaluator for S-RAG System
 *
 * Implements LLM-as-judge evaluation metrics:
 * - Answer Comparison: Binary judgment (correct/incorrect)
 * - Answer Recall: Percentage of gold answer claims covered
 */

import { LLMClient } from '../llm/llm-client.js';
import { TestCase, EvaluationResult, LLMModel } from '../models/types.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger({ module: 'evaluator' });

/**
 * Evaluator class for assessing system performance
 *
 * Uses GPT-4o as judge to evaluate answer quality through:
 * 1. Answer Comparison: Binary correctness judgment
 * 2. Answer Recall: Claim-level coverage analysis
 *
 * @example
 * ```typescript
 * const evaluator = new Evaluator(llmClient);
 * const isCorrect = await evaluator.answerComparison(
 *   'What is the capital of France?',
 *   'Paris',
 *   'The capital of France is Paris'
 * );
 * ```
 */
export class Evaluator {
  private llm: LLMClient;
  private evaluationModel: LLMModel = 'gpt-4o';

  /**
   * Create a new Evaluator
   *
   * @param llmClient - LLM client for evaluation calls
   */
  constructor(llmClient: LLMClient) {
    this.llm = llmClient;
    logger.info('Evaluator initialized', { model: this.evaluationModel });
  }

  /**
   * Compare predicted answer against gold answer using LLM as judge
   *
   * Uses GPT-4o to determine if the predicted answer is correct based on
   * the gold answer, without using external knowledge. Returns a binary
   * judgment (true/false).
   *
   * @param question - The question being answered
   * @param goldAnswer - The reference answer
   * @param predictedAnswer - The answer to evaluate
   * @returns True if predicted answer is correct, false otherwise
   *
   * @example
   * ```typescript
   * const isCorrect = await evaluator.answerComparison(
   *   'What is 2+2?',
   *   '4',
   *   'The answer is 4'
   * );
   * // Returns: true
   * ```
   */
  async answerComparison(
    question: string,
    goldAnswer: string,
    predictedAnswer: string
  ): Promise<boolean> {
    logger.debug('Evaluating answer comparison', {
      questionLength: question.length,
      goldAnswerLength: goldAnswer.length,
      predictedAnswerLength: predictedAnswer.length,
    });

    const prompt = `You are given a query, a gold answer, and a judged answer.
Decide if the judged answer is a correct answer for the query, based on the gold answer.
Do not use any external or prior knowledge. Only use the gold answer.

Answer Yes if the judged answer is a correct answer for the query, and No otherwise.

<query>
${question}
</query>

<gold_answer>
${goldAnswer}
</gold_answer>

<judged_answer>
${predictedAnswer}
</judged_answer>

Answer (Yes or No):`;

    try {
      const response = await this.llm.generate(prompt, {
        model: this.evaluationModel,
        temperature: 0,
        maxTokens: 10,
      });

      const isCorrect = response.content.trim().toLowerCase().includes('yes');

      logger.info('Answer comparison complete', {
        isCorrect,
        response: response.content.trim(),
      });

      return isCorrect;
    } catch (error) {
      logger.error('Answer comparison failed', error as Error);
      throw error;
    }
  }

  /**
   * Calculate answer recall by decomposing gold answer into claims
   * and checking coverage in predicted answer
   *
   * Process:
   * 1. Decompose gold answer into individual factual claims
   * 2. Check which claims are covered in predicted answer
   * 3. Return percentage of claims covered (0.0 to 1.0)
   *
   * @param goldAnswer - The reference answer
   * @param predictedAnswer - The answer to evaluate
   * @returns Recall score from 0.0 to 1.0
   *
   * @example
   * ```typescript
   * const recall = await evaluator.answerRecall(
   *   'Paris is the capital of France and has a population of 2.1 million',
   *   'Paris is the capital of France'
   * );
   * // Returns: 0.5 (1 of 2 claims covered)
   * ```
   */
  async answerRecall(goldAnswer: string, predictedAnswer: string): Promise<number> {
    logger.debug('Calculating answer recall', {
      goldAnswerLength: goldAnswer.length,
      predictedAnswerLength: predictedAnswer.length,
    });

    // Step 1: Decompose gold answer into claims
    const claimsPrompt = `Break down the following answer into individual factual claims.
Return a numbered list of claims.

Answer: ${goldAnswer}

Claims:`;

    try {
      const claimsResponse = await this.llm.generate(claimsPrompt, {
        model: this.evaluationModel,
        temperature: 0,
        maxTokens: 1000,
      });

      const claims = this.parseClaims(claimsResponse.content);

      logger.debug('Claims extracted', { claimCount: claims.length, claims });

      if (claims.length === 0) {
        logger.warn('No claims extracted from gold answer');
        return 0;
      }

      // Step 2: Check coverage for each claim
      let coveredCount = 0;
      for (const claim of claims) {
        const isCovered = await this.isClaimCovered(claim, predictedAnswer);
        if (isCovered) {
          coveredCount++;
        }
      }

      const recall = coveredCount / claims.length;

      logger.info('Answer recall calculated', {
        totalClaims: claims.length,
        coveredClaims: coveredCount,
        recall,
      });

      return recall;
    } catch (error) {
      logger.error('Answer recall calculation failed', error as Error);
      throw error;
    }
  }

  /**
   * Check if a specific claim is covered in the answer
   *
   * @param claim - The claim to check
   * @param answer - The answer to check against
   * @returns True if claim is covered, false otherwise
   */
  private async isClaimCovered(claim: string, answer: string): Promise<boolean> {
    const prompt = `Is the following claim covered in the answer?

Claim: ${claim}

Answer: ${answer}

Respond with Yes or No:`;

    try {
      const response = await this.llm.generate(prompt, {
        model: this.evaluationModel,
        temperature: 0,
        maxTokens: 10,
      });

      const isCovered = response.content.trim().toLowerCase().includes('yes');

      logger.debug('Claim coverage checked', { claim, isCovered });

      return isCovered;
    } catch (error) {
      logger.error('Claim coverage check failed', error as Error);
      throw error;
    }
  }

  /**
   * Parse numbered list of claims from LLM response
   *
   * Supports formats like:
   * - "1. First claim"
   * - "1) First claim"
   * - "1 First claim"
   *
   * @param claimsResponse - LLM response containing claims
   * @returns Array of claim strings
   */
  private parseClaims(claimsResponse: string): string[] {
    const lines = claimsResponse.split('\n');
    const claims: string[] = [];

    for (const line of lines) {
      // Match patterns like "1. ", "1) ", or just "1 "
      const match = line.match(/^\s*\d+[.)\s]\s*(.+)$/);
      if (match && match[1]) {
        claims.push(match[1].trim());
      }
    }

    return claims;
  }

  /**
   * Evaluate a dataset of test cases
   *
   * Runs both answer comparison and answer recall metrics on all test cases
   * and returns aggregated results with per-example breakdown.
   *
   * @param testCases - Array of test cases to evaluate
   * @returns Evaluation results with metrics and per-example details
   *
   * @example
   * ```typescript
   * const results = await evaluator.evaluateDataset([
   *   {
   *     question: 'What is 2+2?',
   *     goldAnswer: '4',
   *     predictedAnswer: 'The answer is 4'
   *   }
   * ]);
   * console.log(results.answerComparison); // 1.0 (100% accuracy)
   * ```
   */
  async evaluateDataset(testCases: TestCase[]): Promise<EvaluationResult> {
    logger.info('Starting dataset evaluation', { testCaseCount: testCases.length });

    const comparisonResults: boolean[] = [];
    const recallResults: number[] = [];
    const perExampleResults: Array<{
      question: string;
      isCorrect: boolean;
      recall: number;
    }> = [];

    // Process test cases sequentially to avoid rate limiting
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      logger.debug(`Evaluating test case ${i + 1}/${testCases.length}`, {
        question: tc.question.substring(0, 50) + '...',
      });

      // Answer comparison
      const isCorrect = await this.answerComparison(
        tc.question,
        tc.goldAnswer,
        tc.predictedAnswer
      );
      comparisonResults.push(isCorrect);

      // Answer recall
      const recall = await this.answerRecall(tc.goldAnswer, tc.predictedAnswer);
      recallResults.push(recall);

      // Store per-example results
      perExampleResults.push({
        question: tc.question,
        isCorrect,
        recall,
      });

      logger.debug(`Test case ${i + 1} evaluated`, { isCorrect, recall });
    }

    // Calculate aggregate metrics
    const answerComparison =
      comparisonResults.reduce((sum, isCorrect) => sum + (isCorrect ? 1 : 0), 0) /
      comparisonResults.length;

    const answerRecall =
      recallResults.reduce((sum, recall) => sum + recall, 0) / recallResults.length;

    const result: EvaluationResult = {
      answerComparison,
      answerRecall,
      numExamples: testCases.length,
      perExampleResults,
    };

    logger.info('Dataset evaluation complete', {
      numExamples: result.numExamples,
      answerComparison: result.answerComparison.toFixed(3),
      answerRecall: result.answerRecall.toFixed(3),
    });

    return result;
  }
}

/**
 * Create a default Evaluator instance
 *
 * @param llmClient - LLM client for evaluation calls
 * @returns Configured Evaluator instance
 *
 * @example
 * ```typescript
 * import { createLLMClient } from '../llm/llm-client.js';
 * import { createEvaluator } from './evaluator.js';
 *
 * const client = createLLMClient();
 * const evaluator = createEvaluator(client);
 * ```
 */
export function createEvaluator(llmClient: LLMClient): Evaluator {
  return new Evaluator(llmClient);
}
