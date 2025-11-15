import { describe, it, expect } from 'vitest';
import {
  calculateStatistics,
  calculateMetrics,
  getPerformanceSummary,
  compareEvaluations,
  compareRuns,
  findBestRun,
  analyzeImprovement,
  generateTextReport,
  generateMarkdownReport,
  generateJSONReport,
  formatAsTable,
  generateConfusionMatrix,
  createPerformanceChart,
  generateComparisonReport,
} from '../../src/evaluation/metrics.js';
import { EvaluationResult } from '../../src/models/types.js';

describe('Metrics - calculateStatistics', () => {
  it('should calculate statistics for an array of numbers', () => {
    const values = [1, 2, 3, 4, 5];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(3);
    expect(stats.median).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.count).toBe(5);
    expect(stats.stdDev).toBeCloseTo(1.414, 2);
  });

  it('should handle even number of values for median', () => {
    const values = [1, 2, 3, 4];
    const stats = calculateStatistics(values);

    expect(stats.median).toBe(2.5);
  });

  it('should handle empty array', () => {
    const values: number[] = [];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(0);
    expect(stats.median).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.stdDev).toBe(0);
    expect(stats.count).toBe(0);
  });

  it('should handle single value', () => {
    const values = [5];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(5);
    expect(stats.median).toBe(5);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);
    expect(stats.stdDev).toBe(0);
    expect(stats.count).toBe(1);
  });

  it('should handle all same values', () => {
    const values = [3, 3, 3, 3];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(3);
    expect(stats.median).toBe(3);
    expect(stats.min).toBe(3);
    expect(stats.max).toBe(3);
    expect(stats.stdDev).toBe(0);
    expect(stats.count).toBe(4);
  });

  it('should handle negative numbers', () => {
    const values = [-5, -3, 0, 3, 5];
    const stats = calculateStatistics(values);

    expect(stats.mean).toBe(0);
    expect(stats.median).toBe(0);
    expect(stats.min).toBe(-5);
    expect(stats.max).toBe(5);
  });
});

describe('Metrics - calculateMetrics', () => {
  it('should calculate metrics from evaluation results', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 5,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 0.9 },
        { question: 'Q3', isCorrect: true, recall: 0.8 },
        { question: 'Q4', isCorrect: true, recall: 0.7 },
        { question: 'Q5', isCorrect: false, recall: 0.35 },
      ],
    };

    const metrics = calculateMetrics(results);

    expect(metrics.answerComparison.mean).toBe(0.8);
    expect(metrics.answerRecall.mean).toBe(0.75);
    expect(metrics.correctAnswers).toBe(4);
    expect(metrics.totalAnswers).toBe(5);
    expect(metrics.accuracy).toBe(0.8);
  });

  it('should handle empty results', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const metrics = calculateMetrics(results);

    expect(metrics.answerComparison.mean).toBe(0);
    expect(metrics.answerRecall.mean).toBe(0);
    expect(metrics.correctAnswers).toBe(0);
    expect(metrics.totalAnswers).toBe(0);
    expect(metrics.accuracy).toBe(0);
  });

  it('should handle all correct answers', () => {
    const results: EvaluationResult = {
      answerComparison: 1.0,
      answerRecall: 1.0,
      numExamples: 3,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 1.0 },
        { question: 'Q3', isCorrect: true, recall: 1.0 },
      ],
    };

    const metrics = calculateMetrics(results);

    expect(metrics.accuracy).toBe(1.0);
    expect(metrics.correctAnswers).toBe(3);
  });

  it('should handle all incorrect answers', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0.2,
      numExamples: 3,
      perExampleResults: [
        { question: 'Q1', isCorrect: false, recall: 0.3 },
        { question: 'Q2', isCorrect: false, recall: 0.2 },
        { question: 'Q3', isCorrect: false, recall: 0.1 },
      ],
    };

    const metrics = calculateMetrics(results);

    expect(metrics.accuracy).toBe(0);
    expect(metrics.correctAnswers).toBe(0);
  });
});

describe('Metrics - getPerformanceSummary', () => {
  it('should return performance summary', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 5,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 0.9 },
        { question: 'Q3', isCorrect: true, recall: 0.8 },
        { question: 'Q4', isCorrect: true, recall: 0.7 },
        { question: 'Q5', isCorrect: false, recall: 0.35 },
      ],
    };

    const summary = getPerformanceSummary(results);

    expect(summary.answerComparison.mean).toBe(0.8);
    expect(summary.answerRecall.mean).toBe(0.75);
    expect(summary.accuracy).toBe(0.8);
  });
});

describe('Metrics - compareEvaluations', () => {
  it('should compare two evaluation runs', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.6,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.6 },
        { question: 'Q2', isCorrect: false, recall: 0.4 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const comparison = compareEvaluations(baseline, current);

    expect(comparison.improvement.answerComparison).toBeCloseTo(0.2, 2);
    expect(comparison.improvement.answerRecall).toBeCloseTo(0.25, 2);
    expect(comparison.improvement.accuracy).toBeCloseTo(0.5, 2);
    expect(comparison.better).toBe(true);
  });

  it('should detect performance decrease', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.6,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.6 },
        { question: 'Q2', isCorrect: false, recall: 0.4 },
      ],
    };

    const comparison = compareEvaluations(baseline, current);

    expect(comparison.improvement.answerComparison).toBeLessThan(0);
    expect(comparison.improvement.answerRecall).toBeLessThan(0);
    expect(comparison.improvement.accuracy).toBeLessThan(0);
    expect(comparison.better).toBe(false);
  });

  it('should handle equal performance', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const comparison = compareEvaluations(baseline, current);

    expect(comparison.improvement.answerComparison).toBe(0);
    expect(comparison.improvement.answerRecall).toBe(0);
    expect(comparison.improvement.accuracy).toBe(0);
    expect(comparison.better).toBe(true);
  });

  it('should calculate percent change correctly', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.5,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.5 },
        { question: 'Q2', isCorrect: false, recall: 0.5 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.75,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.75 },
        { question: 'Q2', isCorrect: true, recall: 0.75 },
      ],
    };

    const comparison = compareEvaluations(baseline, current);

    expect(comparison.percentChange.answerComparison).toBeCloseTo(50, 0);
    expect(comparison.percentChange.answerRecall).toBeCloseTo(50, 0);
    expect(comparison.percentChange.accuracy).toBeCloseTo(100, 0);
  });
});

describe('Metrics - compareRuns', () => {
  it('should compare multiple runs', () => {
    const runs: EvaluationResult[] = [
      {
        answerComparison: 0.6,
        answerRecall: 0.5,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.6 },
          { question: 'Q2', isCorrect: false, recall: 0.4 },
        ],
      },
      {
        answerComparison: 0.8,
        answerRecall: 0.75,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.8 },
          { question: 'Q2', isCorrect: true, recall: 0.7 },
        ],
      },
      {
        answerComparison: 0.7,
        answerRecall: 0.65,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.7 },
          { question: 'Q2', isCorrect: true, recall: 0.6 },
        ],
      },
    ];

    const comparison = compareRuns(runs);

    expect(comparison.runs.length).toBe(3);
    expect(comparison.bestRun.index).toBe(1); // Second run has best overall performance
    expect(comparison.statistics.answerComparison.mean).toBeCloseTo(0.7, 1);
    expect(comparison.statistics.answerRecall.mean).toBeCloseTo(0.633, 2);
  });

  it('should throw error for empty runs', () => {
    expect(() => compareRuns([])).toThrow(
      'At least one evaluation run is required'
    );
  });

  it('should handle single run', () => {
    const runs: EvaluationResult[] = [
      {
        answerComparison: 0.8,
        answerRecall: 0.75,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.8 },
          { question: 'Q2', isCorrect: true, recall: 0.7 },
        ],
      },
    ];

    const comparison = compareRuns(runs);

    expect(comparison.runs.length).toBe(1);
    expect(comparison.bestRun.index).toBe(0);
    expect(comparison.statistics.answerComparison.mean).toBe(0.8);
  });
});

describe('Metrics - findBestRun', () => {
  it('should find the best run', () => {
    const runs: EvaluationResult[] = [
      {
        answerComparison: 0.6,
        answerRecall: 0.5,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.6 },
          { question: 'Q2', isCorrect: false, recall: 0.4 },
        ],
      },
      {
        answerComparison: 0.8,
        answerRecall: 0.75,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.8 },
          { question: 'Q2', isCorrect: true, recall: 0.7 },
        ],
      },
      {
        answerComparison: 0.7,
        answerRecall: 0.65,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.7 },
          { question: 'Q2', isCorrect: true, recall: 0.6 },
        ],
      },
    ];

    const best = findBestRun(runs);

    expect(best.index).toBe(1);
    expect(best.metrics.answerComparison.mean).toBe(0.8);
    expect(best.result).toBe(runs[1]);
  });

  it('should throw error for empty runs', () => {
    expect(() => findBestRun([])).toThrow(
      'At least one evaluation run is required'
    );
  });
});

describe('Metrics - analyzeImprovement', () => {
  it('should analyze improvement with positive changes', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.6,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.6 },
        { question: 'Q2', isCorrect: false, recall: 0.4 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const analysis = analyzeImprovement(baseline, current);

    expect(analysis.summary).toBe('Performance improved across all metrics');
    expect(analysis.comparison.better).toBe(true);
    expect(analysis.baselineMetrics.answerComparison.mean).toBe(0.6);
    expect(analysis.currentMetrics.answerComparison.mean).toBe(0.8);
  });

  it('should analyze improvement with negative changes', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: true, recall: 0.7 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.6,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.6 },
        { question: 'Q2', isCorrect: false, recall: 0.4 },
      ],
    };

    const analysis = analyzeImprovement(baseline, current);

    expect(analysis.summary).toBe('Performance decreased across all metrics');
    expect(analysis.comparison.better).toBe(false);
  });

  it('should analyze improvement with mixed changes', () => {
    const baseline: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.5,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.6 },
        { question: 'Q2', isCorrect: true, recall: 0.4 },
      ],
    };

    const current: EvaluationResult = {
      answerComparison: 0.6,
      answerRecall: 0.75,
      numExamples: 2,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 0.8 },
        { question: 'Q2', isCorrect: false, recall: 0.7 },
      ],
    };

    const analysis = analyzeImprovement(baseline, current);

    expect(analysis.summary).toBe(
      'Mixed results - some metrics improved, others decreased'
    );
    expect(analysis.comparison.better).toBe(false);
  });
});

describe('Metrics - generateTextReport', () => {
  it('should generate a text report', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 3,
      perExampleResults: [
        { question: 'What is the capital of France?', isCorrect: true, recall: 1.0 },
        { question: 'Who wrote Romeo and Juliet?', isCorrect: true, recall: 0.9 },
        { question: 'What is 2+2?', isCorrect: false, recall: 0.35 },
      ],
    };

    const report = generateTextReport(results);

    expect(report).toContain('EVALUATION REPORT');
    expect(report).toContain('Answer Comparison: 80.0%');
    expect(report).toContain('Answer Recall:     75.0%');
    expect(report).toContain('Correct Answers:   2/3');
    expect(report).toContain('PER-EXAMPLE RESULTS');
    expect(report).toContain('What is the capital of France?');
  });

  it('should handle empty results', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const report = generateTextReport(results);

    expect(report).toContain('EVALUATION REPORT');
    expect(report).toContain('Answer Comparison: 0.0%');
    expect(report).not.toContain('PER-EXAMPLE RESULTS');
  });

  it('should truncate long questions', () => {
    const results: EvaluationResult = {
      answerComparison: 1.0,
      answerRecall: 1.0,
      numExamples: 1,
      perExampleResults: [
        {
          question:
            'This is a very long question that should be truncated in the report because it exceeds the maximum length limit',
          isCorrect: true,
          recall: 1.0,
        },
      ],
    };

    const report = generateTextReport(results);

    expect(report).toContain('...');
  });
});

describe('Metrics - generateMarkdownReport', () => {
  it('should generate a markdown report', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 3,
      perExampleResults: [
        { question: 'What is the capital of France?', isCorrect: true, recall: 1.0 },
        { question: 'Who wrote Romeo and Juliet?', isCorrect: true, recall: 0.9 },
        { question: 'What is 2+2?', isCorrect: false, recall: 0.35 },
      ],
    };

    const report = generateMarkdownReport(results);

    expect(report).toContain('# Evaluation Report');
    expect(report).toContain('## Overall Metrics');
    expect(report).toContain('| Answer Comparison | 80.0% |');
    expect(report).toContain('| Answer Recall | 75.0% |');
    expect(report).toContain('| Correct Answers | 2/3 |');
    expect(report).toContain('## Per-Example Results');
    expect(report).toContain('What is the capital of France?');
    expect(report).toContain('✓');
    expect(report).toContain('✗');
  });

  it('should handle empty results', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const report = generateMarkdownReport(results);

    expect(report).toContain('# Evaluation Report');
    expect(report).toContain('| Answer Comparison | 0.0% |');
    expect(report).not.toContain('## Per-Example Results');
  });
});

describe('Metrics - generateJSONReport', () => {
  it('should generate a JSON report', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 3,
      perExampleResults: [
        { question: 'What is the capital of France?', isCorrect: true, recall: 1.0 },
        { question: 'Who wrote Romeo and Juliet?', isCorrect: true, recall: 0.9 },
        { question: 'What is 2+2?', isCorrect: false, recall: 0.35 },
      ],
    };

    const report = generateJSONReport(results);

    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('overall');
    expect(report).toHaveProperty('statistics');
    expect(report).toHaveProperty('perExampleResults');

    const overall = report.overall as Record<string, unknown>;
    expect(overall.answerComparison).toBe(0.8);
    expect(overall.answerRecall).toBe(0.75);
    expect(overall.correctAnswers).toBe(2);
    expect(overall.totalAnswers).toBe(3);

    const perExample = report.perExampleResults as Array<Record<string, unknown>>;
    expect(perExample.length).toBe(3);
    expect(perExample[0].question).toBe('What is the capital of France?');
  });

  it('should include timestamp', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const report = generateJSONReport(results);

    expect(report.timestamp).toBeDefined();
    expect(typeof report.timestamp).toBe('string');
  });
});

describe('Metrics - formatAsTable', () => {
  it('should format results as an ASCII table', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 3,
      perExampleResults: [
        { question: 'What is the capital of France?', isCorrect: true, recall: 1.0 },
        { question: 'Who wrote Romeo and Juliet?', isCorrect: true, recall: 0.9 },
        { question: 'What is 2+2?', isCorrect: false, recall: 0.35 },
      ],
    };

    const table = formatAsTable(results);

    expect(table).toContain('#');
    expect(table).toContain('Question');
    expect(table).toContain('Correct');
    expect(table).toContain('Recall');
    expect(table).toContain('What is the capital of France?');
    expect(table).toContain('Yes');
    expect(table).toContain('No');
    expect(table).toContain('100.0%');
    expect(table).toContain('35.0%');
  });

  it('should handle empty results', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const table = formatAsTable(results);

    expect(table).toContain('Question');
    expect(table).toContain('Correct');
  });
});

describe('Metrics - generateConfusionMatrix', () => {
  it('should generate a confusion matrix', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 5,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 0.9 },
        { question: 'Q3', isCorrect: true, recall: 0.8 },
        { question: 'Q4', isCorrect: true, recall: 0.7 },
        { question: 'Q5', isCorrect: false, recall: 0.35 },
      ],
    };

    const matrix = generateConfusionMatrix(results);

    expect(matrix.truePositives).toBe(4);
    expect(matrix.falseNegatives).toBe(1);
    expect(matrix.trueNegatives).toBe(0);
    expect(matrix.falsePositives).toBe(0);
    expect(matrix.accuracy).toBe(0.8);
    expect(matrix.matrix).toContain('Predicted');
    expect(matrix.matrix).toContain('Actual');
    expect(matrix.matrix).toContain('Total: 5 examples');
  });

  it('should handle all correct answers', () => {
    const results: EvaluationResult = {
      answerComparison: 1.0,
      answerRecall: 1.0,
      numExamples: 3,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 1.0 },
        { question: 'Q3', isCorrect: true, recall: 1.0 },
      ],
    };

    const matrix = generateConfusionMatrix(results);

    expect(matrix.truePositives).toBe(3);
    expect(matrix.falseNegatives).toBe(0);
    expect(matrix.accuracy).toBe(1.0);
  });

  it('should handle all incorrect answers', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0.2,
      numExamples: 3,
      perExampleResults: [
        { question: 'Q1', isCorrect: false, recall: 0.3 },
        { question: 'Q2', isCorrect: false, recall: 0.2 },
        { question: 'Q3', isCorrect: false, recall: 0.1 },
      ],
    };

    const matrix = generateConfusionMatrix(results);

    expect(matrix.truePositives).toBe(0);
    expect(matrix.falseNegatives).toBe(3);
    expect(matrix.accuracy).toBe(0);
  });

  it('should handle empty results', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const matrix = generateConfusionMatrix(results);

    expect(matrix.truePositives).toBe(0);
    expect(matrix.falseNegatives).toBe(0);
    expect(matrix.accuracy).toBe(0);
  });
});

describe('Metrics - createPerformanceChart', () => {
  it('should create a performance chart', () => {
    const results: EvaluationResult = {
      answerComparison: 0.8,
      answerRecall: 0.75,
      numExamples: 3,
      perExampleResults: [
        { question: 'Q1', isCorrect: true, recall: 1.0 },
        { question: 'Q2', isCorrect: true, recall: 0.9 },
        { question: 'Q3', isCorrect: false, recall: 0.35 },
      ],
    };

    const chart = createPerformanceChart(results);

    expect(chart).toContain('Performance Chart');
    expect(chart).toContain('Answer Comparison:');
    expect(chart).toContain('Answer Recall:');
    expect(chart).toContain('Accuracy:');
    expect(chart).toContain('80.0%');
    expect(chart).toContain('75.0%');
    expect(chart).toContain('█');
    expect(chart).toContain('░');
  });

  it('should handle zero values', () => {
    const results: EvaluationResult = {
      answerComparison: 0,
      answerRecall: 0,
      numExamples: 0,
      perExampleResults: [],
    };

    const chart = createPerformanceChart(results);

    expect(chart).toContain('Performance Chart');
    expect(chart).toContain('0.0%');
  });

  it('should handle perfect scores', () => {
    const results: EvaluationResult = {
      answerComparison: 1.0,
      answerRecall: 1.0,
      numExamples: 1,
      perExampleResults: [{ question: 'Q1', isCorrect: true, recall: 1.0 }],
    };

    const chart = createPerformanceChart(results);

    expect(chart).toContain('100.0%');
  });
});

describe('Metrics - generateComparisonReport', () => {
  it('should generate a comparison report', () => {
    const runs: EvaluationResult[] = [
      {
        answerComparison: 0.6,
        answerRecall: 0.5,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.6 },
          { question: 'Q2', isCorrect: false, recall: 0.4 },
        ],
      },
      {
        answerComparison: 0.8,
        answerRecall: 0.75,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.8 },
          { question: 'Q2', isCorrect: true, recall: 0.7 },
        ],
      },
      {
        answerComparison: 0.7,
        answerRecall: 0.65,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.7 },
          { question: 'Q2', isCorrect: true, recall: 0.6 },
        ],
      },
    ];

    const report = generateComparisonReport(runs);

    expect(report).toContain('MULTI-RUN COMPARISON REPORT');
    expect(report).toContain('Total Runs: 3');
    expect(report).toContain('RUN METRICS');
    expect(report).toContain('STATISTICS ACROSS RUNS');
    expect(report).toContain('*BEST*');
    expect(report).toContain('Answer Comparison');
    expect(report).toContain('Answer Recall');
    expect(report).toContain('Accuracy');
  });

  it('should handle empty runs', () => {
    const report = generateComparisonReport([]);

    expect(report).toBe('No evaluation runs to compare');
  });

  it('should handle single run', () => {
    const runs: EvaluationResult[] = [
      {
        answerComparison: 0.8,
        answerRecall: 0.75,
        numExamples: 2,
        perExampleResults: [
          { question: 'Q1', isCorrect: true, recall: 0.8 },
          { question: 'Q2', isCorrect: true, recall: 0.7 },
        ],
      },
    ];

    const report = generateComparisonReport(runs);

    expect(report).toContain('Total Runs: 1');
    expect(report).toContain('*BEST*');
  });
});
