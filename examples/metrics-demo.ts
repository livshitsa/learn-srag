/**
 * Demo script showing how to use the metrics and reporting module
 *
 * This demonstrates the main features of src/evaluation/metrics.ts
 */

import {
  calculateMetrics,
  generateTextReport,
  generateMarkdownReport,
  generateJSONReport,
  createPerformanceChart,
  compareEvaluations,
  analyzeImprovement,
  compareRuns,
  findBestRun,
  formatAsTable,
  generateConfusionMatrix,
  generateComparisonReport,
} from '../src/evaluation/metrics.js';
import { EvaluationResult } from '../src/models/types.js';

// Example evaluation result
const exampleResult: EvaluationResult = {
  answerComparison: 0.8,
  answerRecall: 0.75,
  numExamples: 5,
  perExampleResults: [
    {
      question: 'What is the capital of France?',
      isCorrect: true,
      recall: 1.0,
    },
    {
      question: 'Who wrote Romeo and Juliet?',
      isCorrect: true,
      recall: 0.9,
    },
    {
      question: 'What is the largest planet in our solar system?',
      isCorrect: true,
      recall: 1.0,
    },
    {
      question: 'In what year did World War II end?',
      isCorrect: true,
      recall: 0.8,
    },
    {
      question: 'What is the speed of light?',
      isCorrect: false,
      recall: 0.05,
    },
  ],
};

console.log('='.repeat(70));
console.log('METRICS & REPORTING DEMO');
console.log('='.repeat(70));
console.log('');

// 1. Calculate basic metrics
console.log('1. BASIC METRICS');
console.log('-'.repeat(70));
const metrics = calculateMetrics(exampleResult);
console.log('Answer Comparison (Mean):', (metrics.answerComparison.mean * 100).toFixed(1) + '%');
console.log('Answer Recall (Mean):', (metrics.answerRecall.mean * 100).toFixed(1) + '%');
console.log('Accuracy:', (metrics.accuracy * 100).toFixed(1) + '%');
console.log('Correct Answers:', `${metrics.correctAnswers}/${metrics.totalAnswers}`);
console.log('');

// 2. Generate text report
console.log('2. TEXT REPORT');
console.log('-'.repeat(70));
const textReport = generateTextReport(exampleResult);
console.log(textReport);
console.log('');

// 3. Generate performance chart
console.log('3. PERFORMANCE CHART');
console.log('-'.repeat(70));
const chart = createPerformanceChart(exampleResult);
console.log(chart);
console.log('');

// 4. Generate confusion matrix
console.log('4. CONFUSION MATRIX');
console.log('-'.repeat(70));
const confusionMatrix = generateConfusionMatrix(exampleResult);
console.log(confusionMatrix.matrix);
console.log('');

// 5. Format as table
console.log('5. RESULTS TABLE');
console.log('-'.repeat(70));
const table = formatAsTable(exampleResult);
console.log(table);
console.log('');

// 6. Compare two evaluation runs
console.log('6. COMPARISON BETWEEN TWO RUNS');
console.log('-'.repeat(70));
const baselineResult: EvaluationResult = {
  answerComparison: 0.6,
  answerRecall: 0.5,
  numExamples: 2,
  perExampleResults: [
    { question: 'Q1', isCorrect: true, recall: 0.6 },
    { question: 'Q2', isCorrect: false, recall: 0.4 },
  ],
};

const currentResult: EvaluationResult = {
  answerComparison: 0.8,
  answerRecall: 0.75,
  numExamples: 2,
  perExampleResults: [
    { question: 'Q1', isCorrect: true, recall: 0.8 },
    { question: 'Q2', isCorrect: true, recall: 0.7 },
  ],
};

const comparison = compareEvaluations(baselineResult, currentResult);
console.log('Performance improved?', comparison.better ? 'Yes' : 'No');
console.log('Answer Comparison improvement:', (comparison.improvement.answerComparison * 100).toFixed(1) + '%');
console.log('Answer Recall improvement:', (comparison.improvement.answerRecall * 100).toFixed(1) + '%');
console.log('Accuracy improvement:', (comparison.improvement.accuracy * 100).toFixed(1) + '%');
console.log('');

// 7. Analyze improvement
console.log('7. IMPROVEMENT ANALYSIS');
console.log('-'.repeat(70));
const analysis = analyzeImprovement(baselineResult, currentResult);
console.log('Summary:', analysis.summary);
console.log('Percent change (Answer Comparison):', analysis.comparison.percentChange.answerComparison.toFixed(1) + '%');
console.log('Percent change (Answer Recall):', analysis.comparison.percentChange.answerRecall.toFixed(1) + '%');
console.log('Percent change (Accuracy):', analysis.comparison.percentChange.accuracy.toFixed(1) + '%');
console.log('');

// 8. Compare multiple runs
console.log('8. MULTI-RUN COMPARISON');
console.log('-'.repeat(70));
const runs: EvaluationResult[] = [baselineResult, currentResult, exampleResult];
const multiComparison = compareRuns(runs);
console.log('Total runs:', runs.length);
console.log('Best run index:', multiComparison.bestRun.index + 1);
console.log('Best run Answer Comparison:', (multiComparison.bestRun.answerComparison * 100).toFixed(1) + '%');
console.log('Best run Answer Recall:', (multiComparison.bestRun.answerRecall * 100).toFixed(1) + '%');
console.log('');

const comparisonReport = generateComparisonReport(runs);
console.log(comparisonReport);
console.log('');

// 9. Find best run
console.log('9. BEST RUN');
console.log('-'.repeat(70));
const best = findBestRun(runs);
console.log('Best run index:', best.index + 1);
console.log('Answer Comparison:', (best.metrics.answerComparison.mean * 100).toFixed(1) + '%');
console.log('Answer Recall:', (best.metrics.answerRecall.mean * 100).toFixed(1) + '%');
console.log('Accuracy:', (best.metrics.accuracy * 100).toFixed(1) + '%');
console.log('');

// 10. Generate markdown report
console.log('10. MARKDOWN REPORT');
console.log('-'.repeat(70));
const markdownReport = generateMarkdownReport(exampleResult);
console.log('First 20 lines of markdown report:');
console.log(markdownReport.split('\n').slice(0, 20).join('\n'));
console.log('...');
console.log('');

// 11. Generate JSON report
console.log('11. JSON REPORT');
console.log('-'.repeat(70));
const jsonReport = generateJSONReport(exampleResult);
console.log('JSON report (formatted):');
console.log(JSON.stringify(jsonReport, null, 2).split('\n').slice(0, 25).join('\n'));
console.log('...');
console.log('');

console.log('='.repeat(70));
console.log('DEMO COMPLETE');
console.log('='.repeat(70));
