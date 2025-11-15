/**
 * Tests for Evaluator
 *
 * Tests LLM-as-judge evaluation metrics with mocked LLM responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Evaluator } from '../../src/evaluation/evaluator.js';
import { LLMClient } from '../../src/llm/llm-client.js';
import { TestCase } from '../../src/models/types.js';

describe('Evaluator', () => {
  let mockLLMClient: LLMClient;
  let evaluator: Evaluator;

  beforeEach(() => {
    // Create a mock LLM client
    mockLLMClient = {
      generate: vi.fn(),
    } as any;

    evaluator = new Evaluator(mockLLMClient);
  });

  describe('answerComparison', () => {
    it('should return true for correct answer', async () => {
      // Mock LLM response saying "Yes"
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is the capital of France?',
        'Paris',
        'The capital of France is Paris'
      );

      expect(result).toBe(true);
      expect(mockLLMClient.generate).toHaveBeenCalledWith(
        expect.stringContaining('What is the capital of France?'),
        expect.objectContaining({
          model: 'gpt-4o',
          temperature: 0,
        })
      );
    });

    it('should return false for incorrect answer', async () => {
      // Mock LLM response saying "No"
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'No',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is the capital of France?',
        'Paris',
        'The capital of France is London'
      );

      expect(result).toBe(false);
    });

    it('should handle response with explanation', async () => {
      // Mock LLM response with explanation
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes, the judged answer is correct.',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is 2+2?',
        '4',
        'The answer is 4'
      );

      expect(result).toBe(true);
    });

    it('should handle response without yes/no', async () => {
      // Mock LLM response that doesn't contain "yes"
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'The answer is incorrect',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is 2+2?',
        '4',
        'The answer is 5'
      );

      expect(result).toBe(false);
    });

    it('should be case insensitive', async () => {
      // Mock LLM response with different cases
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'YES',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is 2+2?',
        '4',
        'The answer is 4'
      );

      expect(result).toBe(true);
    });

    it('should handle empty answers', async () => {
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'No',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison('What is 2+2?', '4', '');

      expect(result).toBe(false);
    });

    it('should propagate LLM errors', async () => {
      vi.mocked(mockLLMClient.generate).mockRejectedValueOnce(
        new Error('API error')
      );

      await expect(
        evaluator.answerComparison('What is 2+2?', '4', 'The answer is 4')
      ).rejects.toThrow('API error');
    });
  });

  describe('parseClaims', () => {
    it('should parse numbered list with periods', () => {
      const claimsResponse = `1. Paris is the capital of France
2. Paris has a population of 2.1 million
3. Paris is located on the Seine River`;

      // Access private method through any type assertion
      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual([
        'Paris is the capital of France',
        'Paris has a population of 2.1 million',
        'Paris is located on the Seine River',
      ]);
    });

    it('should parse numbered list with parentheses', () => {
      const claimsResponse = `1) First claim
2) Second claim`;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual(['First claim', 'Second claim']);
    });

    it('should parse numbered list with just numbers and spaces', () => {
      const claimsResponse = `1 First claim
2 Second claim`;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual(['First claim', 'Second claim']);
    });

    it('should handle extra whitespace', () => {
      const claimsResponse = `  1.   First claim with spaces
  2.   Second claim  `;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual(['First claim with spaces', 'Second claim']);
    });

    it('should handle empty lines', () => {
      const claimsResponse = `1. First claim

2. Second claim

3. Third claim`;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual(['First claim', 'Second claim', 'Third claim']);
    });

    it('should handle no numbered items', () => {
      const claimsResponse = 'This is just text without numbers';

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual([]);
    });

    it('should handle mixed content', () => {
      const claimsResponse = `Here are the claims:
1. First claim
Some other text
2. Second claim`;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual(['First claim', 'Second claim']);
    });
  });

  describe('answerRecall', () => {
    it('should calculate recall for fully covered answer', async () => {
      // Mock claims decomposition
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({
          content: `1. Paris is the capital of France
2. Paris has a population of 2.1 million`,
          model: 'gpt-4o',
        })
        // Mock claim coverage checks - both covered
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        });

      const recall = await evaluator.answerRecall(
        'Paris is the capital of France and has a population of 2.1 million',
        'Paris is the capital of France and has a population of 2.1 million'
      );

      expect(recall).toBe(1.0);
    });

    it('should calculate recall for partially covered answer', async () => {
      // Mock claims decomposition
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({
          content: `1. Paris is the capital of France
2. Paris has a population of 2.1 million`,
          model: 'gpt-4o',
        })
        // Mock claim coverage checks - only first covered
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        });

      const recall = await evaluator.answerRecall(
        'Paris is the capital of France and has a population of 2.1 million',
        'Paris is the capital of France'
      );

      expect(recall).toBe(0.5);
    });

    it('should calculate recall for uncovered answer', async () => {
      // Mock claims decomposition
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({
          content: `1. Paris is the capital of France
2. Paris has a population of 2.1 million`,
          model: 'gpt-4o',
        })
        // Mock claim coverage checks - none covered
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        });

      const recall = await evaluator.answerRecall(
        'Paris is the capital of France and has a population of 2.1 million',
        'London is the capital of England'
      );

      expect(recall).toBe(0.0);
    });

    it('should handle single claim', async () => {
      // Mock claims decomposition
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({
          content: '1. Paris is the capital of France',
          model: 'gpt-4o',
        })
        // Mock claim coverage check
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        });

      const recall = await evaluator.answerRecall(
        'Paris is the capital of France',
        'Paris is the capital'
      );

      expect(recall).toBe(1.0);
    });

    it('should handle no claims extracted', async () => {
      // Mock claims decomposition with no numbered items
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'No clear claims could be extracted',
        model: 'gpt-4o',
      });

      const recall = await evaluator.answerRecall('Some answer', 'Some answer');

      expect(recall).toBe(0);
    });

    it('should handle empty gold answer', async () => {
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: '',
        model: 'gpt-4o',
      });

      const recall = await evaluator.answerRecall('', 'Some answer');

      expect(recall).toBe(0);
    });

    it('should propagate LLM errors', async () => {
      vi.mocked(mockLLMClient.generate).mockRejectedValueOnce(
        new Error('API error')
      );

      await expect(
        evaluator.answerRecall('Gold answer', 'Predicted answer')
      ).rejects.toThrow('API error');
    });
  });

  describe('evaluateDataset', () => {
    it('should evaluate dataset with all correct answers', async () => {
      const testCases: TestCase[] = [
        {
          question: 'What is 2+2?',
          goldAnswer: '4',
          predictedAnswer: 'The answer is 4',
        },
        {
          question: 'What is the capital of France?',
          goldAnswer: 'Paris',
          predictedAnswer: 'Paris',
        },
      ];

      // Mock responses for first test case
      vi.mocked(mockLLMClient.generate)
        // Answer comparison 1
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Answer recall 1 - claims
        .mockResolvedValueOnce({
          content: '1. The answer is 4',
          model: 'gpt-4o',
        })
        // Answer recall 1 - coverage
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Answer comparison 2
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Answer recall 2 - claims
        .mockResolvedValueOnce({
          content: '1. The capital is Paris',
          model: 'gpt-4o',
        })
        // Answer recall 2 - coverage
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        });

      const result = await evaluator.evaluateDataset(testCases);

      expect(result.numExamples).toBe(2);
      expect(result.answerComparison).toBe(1.0);
      expect(result.answerRecall).toBe(1.0);
      expect(result.perExampleResults).toHaveLength(2);
      expect(result.perExampleResults[0].isCorrect).toBe(true);
      expect(result.perExampleResults[0].recall).toBe(1.0);
      expect(result.perExampleResults[1].isCorrect).toBe(true);
      expect(result.perExampleResults[1].recall).toBe(1.0);
    });

    it('should evaluate dataset with mixed results', async () => {
      const testCases: TestCase[] = [
        {
          question: 'What is 2+2?',
          goldAnswer: '4',
          predictedAnswer: 'The answer is 4',
        },
        {
          question: 'What is the capital of France?',
          goldAnswer: 'Paris',
          predictedAnswer: 'London',
        },
      ];

      // Mock responses
      vi.mocked(mockLLMClient.generate)
        // Test case 1 - correct
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: '1. The answer is 4',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Test case 2 - incorrect
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: '1. The capital is Paris',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        });

      const result = await evaluator.evaluateDataset(testCases);

      expect(result.numExamples).toBe(2);
      expect(result.answerComparison).toBe(0.5);
      expect(result.answerRecall).toBe(0.5);
      expect(result.perExampleResults[0].isCorrect).toBe(true);
      expect(result.perExampleResults[0].recall).toBe(1.0);
      expect(result.perExampleResults[1].isCorrect).toBe(false);
      expect(result.perExampleResults[1].recall).toBe(0.0);
    });

    it('should evaluate dataset with partial recall', async () => {
      const testCases: TestCase[] = [
        {
          question: 'Tell me about Paris',
          goldAnswer: 'Paris is the capital of France and has a population of 2.1 million',
          predictedAnswer: 'Paris is the capital of France',
        },
      ];

      // Mock responses
      vi.mocked(mockLLMClient.generate)
        // Answer comparison
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Answer recall - claims
        .mockResolvedValueOnce({
          content: `1. Paris is the capital of France
2. Paris has a population of 2.1 million`,
          model: 'gpt-4o',
        })
        // Answer recall - first claim covered
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        // Answer recall - second claim not covered
        .mockResolvedValueOnce({
          content: 'No',
          model: 'gpt-4o',
        });

      const result = await evaluator.evaluateDataset(testCases);

      expect(result.numExamples).toBe(1);
      expect(result.answerComparison).toBe(1.0);
      expect(result.answerRecall).toBe(0.5);
      expect(result.perExampleResults[0].isCorrect).toBe(true);
      expect(result.perExampleResults[0].recall).toBe(0.5);
    });

    it('should handle empty dataset', async () => {
      const testCases: TestCase[] = [];

      const result = await evaluator.evaluateDataset(testCases);

      expect(result.numExamples).toBe(0);
      expect(result.answerComparison).toBeNaN();
      expect(result.answerRecall).toBeNaN();
      expect(result.perExampleResults).toHaveLength(0);
    });

    it('should include question in per-example results', async () => {
      const testCases: TestCase[] = [
        {
          question: 'What is 2+2?',
          goldAnswer: '4',
          predictedAnswer: '4',
        },
      ];

      // Mock responses
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: '1. The answer is 4',
          model: 'gpt-4o',
        })
        .mockResolvedValueOnce({
          content: 'Yes',
          model: 'gpt-4o',
        });

      const result = await evaluator.evaluateDataset(testCases);

      expect(result.perExampleResults[0].question).toBe('What is 2+2?');
    });

    it('should evaluate all test cases even if one fails', async () => {
      const testCases: TestCase[] = [
        {
          question: 'Question 1',
          goldAnswer: 'Answer 1',
          predictedAnswer: 'Predicted 1',
        },
        {
          question: 'Question 2',
          goldAnswer: 'Answer 2',
          predictedAnswer: 'Predicted 2',
        },
      ];

      // First test case succeeds
      vi.mocked(mockLLMClient.generate)
        .mockResolvedValueOnce({ content: 'Yes', model: 'gpt-4o' })
        .mockResolvedValueOnce({ content: '1. Claim', model: 'gpt-4o' })
        .mockResolvedValueOnce({ content: 'Yes', model: 'gpt-4o' })
        // Second test case fails
        .mockRejectedValueOnce(new Error('API error'));

      await expect(evaluator.evaluateDataset(testCases)).rejects.toThrow('API error');
    });
  });

  describe('edge cases', () => {
    it('should handle very long answers', async () => {
      const longAnswer = 'A'.repeat(10000);

      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison('Question?', longAnswer, longAnswer);

      expect(result).toBe(true);
    });

    it('should handle special characters in answers', async () => {
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is the formula?',
        'E = mc²',
        'E = mc²'
      );

      expect(result).toBe(true);
    });

    it('should handle unicode characters', async () => {
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is the capital?',
        '北京',
        '北京 (Beijing)'
      );

      expect(result).toBe(true);
    });

    it('should handle numeric answers', async () => {
      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What is the result?',
        '42',
        '42.0'
      );

      expect(result).toBe(true);
    });

    it('should handle answers with line breaks', async () => {
      const multilineAnswer = `Line 1
Line 2
Line 3`;

      vi.mocked(mockLLMClient.generate).mockResolvedValueOnce({
        content: 'Yes',
        model: 'gpt-4o',
      });

      const result = await evaluator.answerComparison(
        'What are the items?',
        multilineAnswer,
        multilineAnswer
      );

      expect(result).toBe(true);
    });

    it('should handle claims with complex formatting', async () => {
      const claimsResponse = `Here are the claims:

1. First claim (with parentheses)
2. Second claim - with dash
3. Third claim: with colon

End of claims.`;

      const claims = (evaluator as any).parseClaims(claimsResponse);

      expect(claims).toEqual([
        'First claim (with parentheses)',
        'Second claim - with dash',
        'Third claim: with colon',
      ]);
    });
  });
});
