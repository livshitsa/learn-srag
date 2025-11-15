/**
 * Metrics calculation and reporting for evaluation results
 *
 * This module provides utilities for analyzing evaluation results,
 * generating reports, and comparing multiple evaluation runs.
 */

import { EvaluationResult } from '../models/types.js';

/**
 * Basic statistics for a set of numbers
 */
export interface Statistics {
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  count: number;
}

/**
 * Performance summary for evaluation results
 */
export interface PerformanceSummary {
  answerComparison: {
    mean: number;
    median: number;
    min: number;
    max: number;
  };
  answerRecall: {
    mean: number;
    median: number;
    min: number;
    max: number;
  };
  correctAnswers: number;
  totalAnswers: number;
  accuracy: number;
}

/**
 * Comparison result between two evaluation runs
 */
export interface ComparisonResult {
  improvement: {
    answerComparison: number;
    answerRecall: number;
    accuracy: number;
  };
  percentChange: {
    answerComparison: number;
    answerRecall: number;
    accuracy: number;
  };
  better: boolean;
}

/**
 * Multi-run comparison result
 */
export interface MultiRunComparison {
  runs: Array<{
    index: number;
    answerComparison: number;
    answerRecall: number;
    accuracy: number;
  }>;
  bestRun: {
    index: number;
    answerComparison: number;
    answerRecall: number;
    accuracy: number;
  };
  statistics: {
    answerComparison: Statistics;
    answerRecall: Statistics;
    accuracy: Statistics;
  };
}

/**
 * Calculate basic statistics for an array of numbers
 */
export function calculateStatistics(values: number[]): Statistics {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      stdDev: 0,
      count: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  // Calculate median
  const median =
    count % 2 === 0
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

  // Calculate standard deviation
  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    min: sorted[0],
    max: sorted[count - 1],
    stdDev,
    count,
  };
}

/**
 * Calculate metrics from evaluation results
 */
export function calculateMetrics(
  results: EvaluationResult
): PerformanceSummary {
  const correctAnswers = results.perExampleResults.filter(
    (r) => r.isCorrect
  ).length;
  const accuracy = results.numExamples > 0 ? correctAnswers / results.numExamples : 0;

  const comparisonScores = results.perExampleResults.map((r) =>
    r.isCorrect ? 1 : 0
  );
  const recallScores = results.perExampleResults.map((r) => r.recall);

  const comparisonStats = calculateStatistics(comparisonScores);
  const recallStats = calculateStatistics(recallScores);

  return {
    answerComparison: {
      mean: results.answerComparison,
      median: comparisonStats.median,
      min: comparisonStats.min,
      max: comparisonStats.max,
    },
    answerRecall: {
      mean: results.answerRecall,
      median: recallStats.median,
      min: recallStats.min,
      max: recallStats.max,
    },
    correctAnswers,
    totalAnswers: results.numExamples,
    accuracy,
  };
}

/**
 * Get a performance summary from evaluation results
 */
export function getPerformanceSummary(
  results: EvaluationResult
): PerformanceSummary {
  return calculateMetrics(results);
}

/**
 * Compare two evaluation runs
 */
export function compareEvaluations(
  baseline: EvaluationResult,
  current: EvaluationResult
): ComparisonResult {
  const baselineMetrics = calculateMetrics(baseline);
  const currentMetrics = calculateMetrics(current);

  const improvement = {
    answerComparison:
      currentMetrics.answerComparison.mean -
      baselineMetrics.answerComparison.mean,
    answerRecall:
      currentMetrics.answerRecall.mean - baselineMetrics.answerRecall.mean,
    accuracy: currentMetrics.accuracy - baselineMetrics.accuracy,
  };

  const percentChange = {
    answerComparison:
      baselineMetrics.answerComparison.mean > 0
        ? (improvement.answerComparison /
            baselineMetrics.answerComparison.mean) *
          100
        : 0,
    answerRecall:
      baselineMetrics.answerRecall.mean > 0
        ? (improvement.answerRecall / baselineMetrics.answerRecall.mean) * 100
        : 0,
    accuracy:
      baselineMetrics.accuracy > 0
        ? (improvement.accuracy / baselineMetrics.accuracy) * 100
        : 0,
  };

  const better =
    improvement.answerComparison >= 0 &&
    improvement.answerRecall >= 0 &&
    improvement.accuracy >= 0;

  return {
    improvement,
    percentChange,
    better,
  };
}

/**
 * Compare multiple evaluation runs
 */
export function compareRuns(runs: EvaluationResult[]): MultiRunComparison {
  if (runs.length === 0) {
    throw new Error('At least one evaluation run is required');
  }

  const runMetrics = runs.map((run, index) => {
    const metrics = calculateMetrics(run);
    return {
      index,
      answerComparison: metrics.answerComparison.mean,
      answerRecall: metrics.answerRecall.mean,
      accuracy: metrics.accuracy,
    };
  });

  // Find best run based on overall performance (average of all metrics)
  const bestRun = runMetrics.reduce((best, current) => {
    const bestScore =
      (best.answerComparison + best.answerRecall + best.accuracy) / 3;
    const currentScore =
      (current.answerComparison + current.answerRecall + current.accuracy) / 3;
    return currentScore > bestScore ? current : best;
  });

  const statistics = {
    answerComparison: calculateStatistics(
      runMetrics.map((r) => r.answerComparison)
    ),
    answerRecall: calculateStatistics(runMetrics.map((r) => r.answerRecall)),
    accuracy: calculateStatistics(runMetrics.map((r) => r.accuracy)),
  };

  return {
    runs: runMetrics,
    bestRun,
    statistics,
  };
}

/**
 * Find the best run from multiple evaluation results
 */
export function findBestRun(runs: EvaluationResult[]): {
  index: number;
  result: EvaluationResult;
  metrics: PerformanceSummary;
} {
  if (runs.length === 0) {
    throw new Error('At least one evaluation run is required');
  }

  const comparison = compareRuns(runs);
  const bestIndex = comparison.bestRun.index;

  return {
    index: bestIndex,
    result: runs[bestIndex],
    metrics: calculateMetrics(runs[bestIndex]),
  };
}

/**
 * Analyze improvement from baseline to current
 */
export function analyzeImprovement(
  baseline: EvaluationResult,
  current: EvaluationResult
): {
  comparison: ComparisonResult;
  baselineMetrics: PerformanceSummary;
  currentMetrics: PerformanceSummary;
  summary: string;
} {
  const comparison = compareEvaluations(baseline, current);
  const baselineMetrics = calculateMetrics(baseline);
  const currentMetrics = calculateMetrics(current);

  let summary = '';
  if (comparison.better) {
    summary = 'Performance improved across all metrics';
  } else if (
    comparison.improvement.answerComparison < 0 &&
    comparison.improvement.answerRecall < 0 &&
    comparison.improvement.accuracy < 0
  ) {
    summary = 'Performance decreased across all metrics';
  } else {
    summary = 'Mixed results - some metrics improved, others decreased';
  }

  return {
    comparison,
    baselineMetrics,
    currentMetrics,
    summary,
  };
}

/**
 * Generate a text report from evaluation results
 */
export function generateTextReport(results: EvaluationResult): string {
  const metrics = calculateMetrics(results);
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('EVALUATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push('OVERALL METRICS');
  lines.push('-'.repeat(60));
  lines.push(
    `Answer Comparison: ${(metrics.answerComparison.mean * 100).toFixed(1)}%`
  );
  lines.push(
    `Answer Recall:     ${(metrics.answerRecall.mean * 100).toFixed(1)}%`
  );
  lines.push(`Accuracy:          ${(metrics.accuracy * 100).toFixed(1)}%`);
  lines.push(
    `Correct Answers:   ${metrics.correctAnswers}/${metrics.totalAnswers}`
  );
  lines.push('');

  lines.push('DETAILED STATISTICS');
  lines.push('-'.repeat(60));
  lines.push('Answer Comparison:');
  lines.push(
    `  Mean:   ${(metrics.answerComparison.mean * 100).toFixed(1)}%`
  );
  lines.push(
    `  Median: ${(metrics.answerComparison.median * 100).toFixed(1)}%`
  );
  lines.push(`  Min:    ${(metrics.answerComparison.min * 100).toFixed(1)}%`);
  lines.push(`  Max:    ${(metrics.answerComparison.max * 100).toFixed(1)}%`);
  lines.push('');

  lines.push('Answer Recall:');
  lines.push(`  Mean:   ${(metrics.answerRecall.mean * 100).toFixed(1)}%`);
  lines.push(`  Median: ${(metrics.answerRecall.median * 100).toFixed(1)}%`);
  lines.push(`  Min:    ${(metrics.answerRecall.min * 100).toFixed(1)}%`);
  lines.push(`  Max:    ${(metrics.answerRecall.max * 100).toFixed(1)}%`);
  lines.push('');

  if (results.perExampleResults.length > 0) {
    lines.push('PER-EXAMPLE RESULTS');
    lines.push('-'.repeat(60));
    results.perExampleResults.forEach((example, index) => {
      const status = example.isCorrect ? '✓' : '✗';
      lines.push(
        `${index + 1}. ${status} ${example.question.substring(0, 50)}${example.question.length > 50 ? '...' : ''}`
      );
      lines.push(
        `   Correct: ${example.isCorrect ? 'Yes' : 'No'}, Recall: ${(example.recall * 100).toFixed(1)}%`
      );
    });
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Generate a markdown report from evaluation results
 */
export function generateMarkdownReport(results: EvaluationResult): string {
  const metrics = calculateMetrics(results);
  const lines: string[] = [];

  lines.push('# Evaluation Report');
  lines.push('');

  lines.push('## Overall Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(
    `| Answer Comparison | ${(metrics.answerComparison.mean * 100).toFixed(1)}% |`
  );
  lines.push(
    `| Answer Recall | ${(metrics.answerRecall.mean * 100).toFixed(1)}% |`
  );
  lines.push(`| Accuracy | ${(metrics.accuracy * 100).toFixed(1)}% |`);
  lines.push(
    `| Correct Answers | ${metrics.correctAnswers}/${metrics.totalAnswers} |`
  );
  lines.push('');

  lines.push('## Detailed Statistics');
  lines.push('');
  lines.push('### Answer Comparison');
  lines.push('');
  lines.push('| Statistic | Value |');
  lines.push('|-----------|-------|');
  lines.push(
    `| Mean | ${(metrics.answerComparison.mean * 100).toFixed(1)}% |`
  );
  lines.push(
    `| Median | ${(metrics.answerComparison.median * 100).toFixed(1)}% |`
  );
  lines.push(
    `| Min | ${(metrics.answerComparison.min * 100).toFixed(1)}% |`
  );
  lines.push(
    `| Max | ${(metrics.answerComparison.max * 100).toFixed(1)}% |`
  );
  lines.push('');

  lines.push('### Answer Recall');
  lines.push('');
  lines.push('| Statistic | Value |');
  lines.push('|-----------|-------|');
  lines.push(
    `| Mean | ${(metrics.answerRecall.mean * 100).toFixed(1)}% |`
  );
  lines.push(
    `| Median | ${(metrics.answerRecall.median * 100).toFixed(1)}% |`
  );
  lines.push(`| Min | ${(metrics.answerRecall.min * 100).toFixed(1)}% |`);
  lines.push(`| Max | ${(metrics.answerRecall.max * 100).toFixed(1)}% |`);
  lines.push('');

  if (results.perExampleResults.length > 0) {
    lines.push('## Per-Example Results');
    lines.push('');
    lines.push('| # | Question | Correct | Recall |');
    lines.push('|---|----------|---------|--------|');
    results.perExampleResults.forEach((example, index) => {
      const question = example.question.substring(0, 50);
      const truncated = example.question.length > 50 ? '...' : '';
      lines.push(
        `| ${index + 1} | ${question}${truncated} | ${example.isCorrect ? '✓' : '✗'} | ${(example.recall * 100).toFixed(1)}% |`
      );
    });
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a JSON report from evaluation results
 */
export function generateJSONReport(
  results: EvaluationResult
): Record<string, unknown> {
  const metrics = calculateMetrics(results);

  return {
    timestamp: new Date().toISOString(),
    overall: {
      answerComparison: metrics.answerComparison.mean,
      answerRecall: metrics.answerRecall.mean,
      accuracy: metrics.accuracy,
      correctAnswers: metrics.correctAnswers,
      totalAnswers: metrics.totalAnswers,
    },
    statistics: {
      answerComparison: metrics.answerComparison,
      answerRecall: metrics.answerRecall,
    },
    perExampleResults: results.perExampleResults.map((example, index) => ({
      index: index + 1,
      question: example.question,
      isCorrect: example.isCorrect,
      recall: example.recall,
    })),
  };
}

/**
 * Format results as an ASCII table
 */
export function formatAsTable(results: EvaluationResult): string {
  const lines: string[] = [];
  const colWidths = {
    index: 5,
    question: 50,
    correct: 8,
    recall: 8,
  };

  // Header
  lines.push(
    `${'#'.padEnd(colWidths.index)} | ${'Question'.padEnd(colWidths.question)} | ${'Correct'.padEnd(colWidths.correct)} | ${'Recall'.padEnd(colWidths.recall)}`
  );
  lines.push(
    `${'-'.repeat(colWidths.index)}-+-${'-'.repeat(colWidths.question)}-+-${'-'.repeat(colWidths.correct)}-+-${'-'.repeat(colWidths.recall)}`
  );

  // Rows
  results.perExampleResults.forEach((example, index) => {
    const num = String(index + 1).padEnd(colWidths.index);
    const question = example.question
      .substring(0, colWidths.question - 3)
      .padEnd(colWidths.question);
    const correct = (example.isCorrect ? 'Yes' : 'No').padEnd(
      colWidths.correct
    );
    const recall = `${(example.recall * 100).toFixed(1)}%`.padEnd(
      colWidths.recall
    );
    lines.push(`${num} | ${question} | ${correct} | ${recall}`);
  });

  return lines.join('\n');
}

/**
 * Generate a confusion matrix for binary classification
 * (correct vs incorrect answers)
 */
export function generateConfusionMatrix(results: EvaluationResult): {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  matrix: string;
} {
  // For S-RAG evaluation, we consider:
  // - True Positive: Answer is correct (isCorrect = true)
  // - True Negative: Not applicable in this context (we don't have negative examples)
  // - False Positive: Not applicable in this context
  // - False Negative: Answer is incorrect (isCorrect = false)

  const truePositives = results.perExampleResults.filter(
    (r) => r.isCorrect
  ).length;
  const falseNegatives = results.perExampleResults.filter(
    (r) => !r.isCorrect
  ).length;
  const trueNegatives = 0; // Not applicable
  const falsePositives = 0; // Not applicable

  const total = results.numExamples;
  const accuracy = total > 0 ? truePositives / total : 0;
  const precision = truePositives > 0 ? 1 : 0; // We don't have false positives
  const recall = accuracy; // Same as accuracy in this context
  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const matrix = [
    '          Predicted',
    '          Correct  Incorrect',
    `Actual Correct  ${String(truePositives).padStart(4)}     ${String(falseNegatives).padStart(4)}`,
    '',
    `Total: ${total} examples`,
    `Accuracy: ${(accuracy * 100).toFixed(1)}%`,
  ].join('\n');

  return {
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    accuracy,
    precision,
    recall,
    f1Score,
    matrix,
  };
}

/**
 * Create a simple performance chart (text-based)
 */
export function createPerformanceChart(results: EvaluationResult): string {
  const metrics = calculateMetrics(results);
  const lines: string[] = [];

  lines.push('Performance Chart');
  lines.push('='.repeat(60));
  lines.push('');

  const createBar = (value: number, maxWidth = 50): string => {
    const barWidth = Math.round(value * maxWidth);
    const bar = '█'.repeat(barWidth);
    const empty = '░'.repeat(maxWidth - barWidth);
    return `${bar}${empty} ${(value * 100).toFixed(1)}%`;
  };

  lines.push('Answer Comparison:');
  lines.push(createBar(metrics.answerComparison.mean));
  lines.push('');

  lines.push('Answer Recall:');
  lines.push(createBar(metrics.answerRecall.mean));
  lines.push('');

  lines.push('Accuracy:');
  lines.push(createBar(metrics.accuracy));
  lines.push('');

  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Generate a comparison report for multiple runs
 */
export function generateComparisonReport(runs: EvaluationResult[]): string {
  if (runs.length === 0) {
    return 'No evaluation runs to compare';
  }

  const comparison = compareRuns(runs);
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('MULTI-RUN COMPARISON REPORT');
  lines.push('='.repeat(60));
  lines.push('');

  lines.push(`Total Runs: ${runs.length}`);
  lines.push('');

  lines.push('RUN METRICS');
  lines.push('-'.repeat(60));
  lines.push(
    'Run | Answer Comparison | Answer Recall | Accuracy'
  );
  lines.push('-'.repeat(60));

  comparison.runs.forEach((run) => {
    const ac = (run.answerComparison * 100).toFixed(1);
    const ar = (run.answerRecall * 100).toFixed(1);
    const acc = (run.accuracy * 100).toFixed(1);
    const best =
      run.index === comparison.bestRun.index ? ' *BEST*' : '';
    lines.push(
      `${String(run.index + 1).padStart(3)} | ${ac.padStart(17)}% | ${ar.padStart(13)}% | ${acc.padStart(8)}%${best}`
    );
  });
  lines.push('');

  lines.push('STATISTICS ACROSS RUNS');
  lines.push('-'.repeat(60));
  lines.push('Answer Comparison:');
  lines.push(
    `  Mean:   ${(comparison.statistics.answerComparison.mean * 100).toFixed(1)}%`
  );
  lines.push(
    `  Median: ${(comparison.statistics.answerComparison.median * 100).toFixed(1)}%`
  );
  lines.push(
    `  StdDev: ${(comparison.statistics.answerComparison.stdDev * 100).toFixed(1)}%`
  );
  lines.push(
    `  Min:    ${(comparison.statistics.answerComparison.min * 100).toFixed(1)}%`
  );
  lines.push(
    `  Max:    ${(comparison.statistics.answerComparison.max * 100).toFixed(1)}%`
  );
  lines.push('');

  lines.push('Answer Recall:');
  lines.push(
    `  Mean:   ${(comparison.statistics.answerRecall.mean * 100).toFixed(1)}%`
  );
  lines.push(
    `  Median: ${(comparison.statistics.answerRecall.median * 100).toFixed(1)}%`
  );
  lines.push(
    `  StdDev: ${(comparison.statistics.answerRecall.stdDev * 100).toFixed(1)}%`
  );
  lines.push(
    `  Min:    ${(comparison.statistics.answerRecall.min * 100).toFixed(1)}%`
  );
  lines.push(
    `  Max:    ${(comparison.statistics.answerRecall.max * 100).toFixed(1)}%`
  );
  lines.push('');

  lines.push('Accuracy:');
  lines.push(
    `  Mean:   ${(comparison.statistics.accuracy.mean * 100).toFixed(1)}%`
  );
  lines.push(
    `  Median: ${(comparison.statistics.accuracy.median * 100).toFixed(1)}%`
  );
  lines.push(
    `  StdDev: ${(comparison.statistics.accuracy.stdDev * 100).toFixed(1)}%`
  );
  lines.push(
    `  Min:    ${(comparison.statistics.accuracy.min * 100).toFixed(1)}%`
  );
  lines.push(
    `  Max:    ${(comparison.statistics.accuracy.max * 100).toFixed(1)}%`
  );
  lines.push('');

  lines.push('='.repeat(60));

  return lines.join('\n');
}
