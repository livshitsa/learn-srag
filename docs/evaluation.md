# S-RAG Evaluation Guide

This guide explains how to evaluate S-RAG system performance using built-in metrics and benchmark datasets.

## Table of Contents

1. [Overview](#overview)
2. [Evaluation Metrics](#evaluation-metrics)
3. [Running Evaluations](#running-evaluations)
4. [Interpreting Results](#interpreting-results)
5. [Benchmark Datasets](#benchmark-datasets)
6. [Best Practices](#best-practices)

## Overview

S-RAG includes a comprehensive evaluation framework based on the paper's methodology. The system uses **LLM-as-judge** to compare generated answers against gold standard answers.

### Why Evaluate?

Evaluation helps you:
- Measure system accuracy
- Compare different models or configurations
- Track improvements over time
- Identify failure modes
- Validate before deployment

### Evaluation Phases

```
Prediction Phase:
Question → Text-to-SQL → Query → Answer Generation → Predicted Answer

Evaluation Phase:
Predicted Answer + Gold Answer → LLM-as-Judge → Metrics
```

## Evaluation Metrics

S-RAG implements two primary metrics from the paper:

### 1. Answer Comparison

**What it measures**: Binary correctness (0 or 1)

**How it works**:
1. LLM (GPT-4o) compares predicted answer to gold answer
2. Judges if they are semantically equivalent
3. Returns 1 (correct) or 0 (incorrect)

**Prompt**:
```
You are comparing two answers to determine if they are equivalent.

Question: {question}

Gold Answer: {gold_answer}

Predicted Answer: {predicted_answer}

Are these answers equivalent? Answer Yes or No.
```

**Example**:
- Question: "What is the average hotel price?"
- Gold: "$167.80"
- Predicted: "The average price is $167.80"
- **Score: 1** (correct)

**Strengths**:
- Simple and interpretable
- Works for any answer format
- High agreement with human judgment

**Limitations**:
- Binary (no partial credit)
- May miss nuanced differences
- Depends on LLM quality

### 2. Answer Recall

**What it measures**: Percentage of information covered (0.0 to 1.0)

**How it works**:
1. Decompose gold answer into individual claims
2. For each claim, check if covered in predicted answer
3. Calculate percentage of claims covered

**Example**:
- Question: "Which hotels allow pets?"
- Gold: "Grand Plaza Hotel and Riverside Boutique Hotel allow pets."
  - Claim 1: Grand Plaza Hotel allows pets
  - Claim 2: Riverside Boutique Hotel allows pets
- Predicted: "Grand Plaza Hotel allows pets"
  - Claim 1: ✓ Covered
  - Claim 2: ✗ Not covered
- **Score: 0.5** (50% recall)

**Strengths**:
- Gives partial credit
- Measures completeness
- Handles multi-part answers

**Limitations**:
- Doesn't penalize extra information
- Claim decomposition may vary
- More complex than binary comparison

### Aggregate Metrics

When evaluating multiple questions, S-RAG calculates:

- **Mean**: Average score
- **Median**: Middle score
- **Standard Deviation**: Score variation
- **Min/Max**: Range of scores
- **Accuracy**: Percentage with score = 1 (for Answer Comparison)

## Running Evaluations

### Method 1: Using the Evaluator Class

```typescript
import { Evaluator } from './src/evaluation/evaluator';
import { LLMClient } from './src/llm/llm-client';

// Initialize
const llmClient = new LLMClient(process.env.OPENAI_API_KEY);
const evaluator = new Evaluator(llmClient);

// Evaluate single answer
const comparisonScore = await evaluator.answerComparison(
  "What is the average price?",
  "$167.80",          // gold answer
  "$167.80 on average" // predicted answer
);
console.log(`Comparison: ${comparisonScore}`); // 1 or 0

const recallScore = await evaluator.answerRecall(
  "Which hotels allow pets?",
  "Grand Plaza and Riverside Boutique",  // gold
  "Grand Plaza"                           // predicted
);
console.log(`Recall: ${recallScore}`); // 0.0 - 1.0
```

### Method 2: Dataset Evaluation

```typescript
import { Evaluator } from './src/evaluation/evaluator';

const evaluator = new Evaluator(llmClient);

// Prepare evaluation dataset
const evalDataset = [
  {
    question: "What is the average price?",
    goldAnswer: "$167.80",
    predictedAnswer: "$167.80 on average",
  },
  {
    question: "Which hotels allow pets?",
    goldAnswer: "Grand Plaza and Riverside Boutique",
    predictedAnswer: "Grand Plaza",
  },
  // ... more examples
];

// Run evaluation
const results = await evaluator.evaluateDataset(evalDataset);

console.log('Results:', results);
// {
//   questions: 2,
//   comparison: { mean: 0.5, median: 0.5, ... },
//   recall: { mean: 0.75, median: 0.75, ... }
// }
```

### Method 3: Full Pipeline Evaluation

```typescript
import {
  LLMClient, DatabaseManager, TextToSQL,
  AnswerGenerator, Evaluator
} from './src';

async function evaluatePipeline() {
  const llmClient = new LLMClient(process.env.OPENAI_API_KEY);
  const db = new DatabaseManager('data/databases/hotels.db');
  const translator = new TextToSQL(llmClient);
  const generator = new AnswerGenerator(llmClient);
  const evaluator = new Evaluator(llmClient);

  // Test questions with gold answers
  const testSet = [
    {
      question: "What is the average price of a standard room?",
      goldAnswer: "$167.80"
    },
    {
      question: "How many hotels allow pets?",
      goldAnswer: "2 hotels"
    },
    // ... more test cases
  ];

  const results = [];

  for (const test of testSet) {
    // Generate prediction
    const sql = await translator.translate(
      test.question, schema, stats, 'hotels'
    );
    const queryResults = db.executeQuery(sql);
    const predicted = await generator.generateAnswer(
      test.question, queryResults, sql
    );

    // Evaluate
    const comparison = await evaluator.answerComparison(
      test.question, test.goldAnswer, predicted
    );
    const recall = await evaluator.answerRecall(
      test.question, test.goldAnswer, predicted
    );

    results.push({
      question: test.question,
      gold: test.goldAnswer,
      predicted,
      comparison,
      recall,
    });
  }

  return results;
}
```

### Generating Reports

```typescript
import { generateTextReport, generateMarkdownReport } from './src/evaluation/metrics';

// After running evaluation
const report = generateTextReport(results, 'Hotels Evaluation');
console.log(report);

// Or markdown for documentation
const markdown = generateMarkdownReport(results, 'Hotels Evaluation');
await writeFile('evaluation-report.md', markdown);
```

## Interpreting Results

### Score Ranges

**Answer Comparison**:
- **1.0**: Perfect match
- **0.0**: Incorrect answer

**Answer Recall**:
- **1.0**: All claims covered (perfect)
- **0.7-0.9**: Most claims covered (good)
- **0.5-0.7**: Some claims covered (acceptable)
- **< 0.5**: Few claims covered (poor)

### Target Benchmarks

Based on the S-RAG paper and our testing:

| Metric | Target | Good | Excellent |
|--------|--------|------|-----------|
| Answer Comparison | > 0.60 | > 0.70 | > 0.80 |
| Answer Recall | > 0.55 | > 0.65 | > 0.75 |

### Common Patterns

**High Comparison, High Recall**:
- System is working well
- Answers are accurate and complete

**High Comparison, Low Recall**:
- Answers are correct but incomplete
- May need to improve answer generation

**Low Comparison, High Recall**:
- System includes right info but wrong format
- May have hallucinations or extra info

**Low Comparison, Low Recall**:
- System is struggling
- Check schema, extraction, or SQL generation

## Benchmark Datasets

### Hotels Dataset

**Description**: 5 hotel documents with pricing, amenities, ratings

**Questions** (10 total):
- Aggregations: "What is the average price?"
- Counts: "How many hotels allow pets?"
- Filters: "Which hotels were built after 2010?"
- Rankings: "Which hotel has the highest rating?"

**Expected Performance**:
- Answer Comparison: > 0.70
- Answer Recall: > 0.65

**Location**: `data/datasets/hotels/`

### World Cup Dataset

**Description**: 5 World Cup match reports with scores, statistics

**Questions** (10 total):
- Aggregations: "What was total attendance?"
- Maximums: "Which match had most goals?"
- Counts: "How many yellow cards total?"
- Averages: "What was average temperature?"

**Expected Performance**:
- Answer Comparison: > 0.65
- Answer Recall: > 0.60

**Location**: `data/datasets/worldcup/`

### Creating Custom Benchmarks

```typescript
// benchmark-template.json
{
  "name": "My Benchmark",
  "description": "Product catalog evaluation",
  "questions": [
    {
      "id": 1,
      "question": "What is the average product price?",
      "goldAnswer": "$45.67",
      "answerType": "aggregation",
      "difficulty": "easy"
    },
    {
      "id": 2,
      "question": "How many products cost more than $100?",
      "goldAnswer": "12 products",
      "answerType": "count",
      "difficulty": "medium"
    }
  ]
}
```

### Benchmark Best Practices

1. **Diverse question types**:
   - Aggregations (AVG, SUM, COUNT)
   - Filters (WHERE clauses)
   - Rankings (ORDER BY + LIMIT)
   - Complex (JOINs, subqueries)

2. **Varied difficulty**:
   - Easy: Single table, simple query
   - Medium: Multiple conditions
   - Hard: Multiple tables, complex logic

3. **Gold answer quality**:
   - Precise numbers
   - Complete information
   - Consistent format
   - Verified correctness

4. **Sufficient size**:
   - Minimum: 20 questions
   - Good: 50 questions
   - Excellent: 100+ questions

## Best Practices

### 1. Consistent Evaluation Environment

Always use the same:
- LLM model (GPT-4o recommended for consistency)
- Temperature (0 for deterministic evaluation)
- Schema and database
- Question phrasing

### 2. Regular Evaluation

Run evaluations:
- After schema changes
- After prompt modifications
- When switching models
- Before deployment
- Weekly during development

### 3. Error Analysis

When scores are low:
1. **Check SQL generation**: Is SQL correct?
2. **Check query results**: Do results match expectations?
3. **Check answer format**: Is answer clear and complete?
4. **Check gold answers**: Are they accurate and complete?

### 4. Iterative Improvement

To improve scores:
1. **Refine schema**: Better schema → better extraction
2. **Improve prompts**: Clearer prompts → better SQL
3. **Add examples**: Few-shot learning helps
4. **Tune temperature**: Lower for factual, higher for creative
5. **Try different models**: GPT-4o vs Claude vs others

### 5. Human Validation

Periodically validate:
- Sample 10-20 predictions manually
- Compare LLM-as-judge with human judgment
- Identify systematic errors
- Update gold answers if needed

## Advanced Evaluation

### Ablation Studies

Test component impact:

```typescript
// Test different models
const models = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet'];
for (const model of models) {
  const llmClient = new LLMClient(apiKey, { model });
  const results = await runEvaluation(llmClient);
  console.log(`${model}: ${results.comparison.mean}`);
}

// Test different temperatures
const temps = [0.0, 0.3, 0.7, 1.0];
for (const temp of temps) {
  const results = await runEvaluation(llmClient, { temperature: temp });
  console.log(`Temp ${temp}: ${results.comparison.mean}`);
}
```

### Cross-Validation

Split data for robust evaluation:

```typescript
// 80/20 split
const trainDocs = documents.slice(0, Math.floor(documents.length * 0.8));
const testDocs = documents.slice(Math.floor(documents.length * 0.8));

// Train on 80%
const schema = await predictor.predictSchema(trainDocs, questions);
const records = await extractor.batchExtract(trainDocs, schema);

// Test on held-out 20%
const testRecords = await extractor.batchExtract(testDocs, schema);
const accuracy = evaluateExtraction(testRecords);
```

### Statistical Significance

For comparing systems:

```typescript
import { compareEvaluations, analyzeImprovement } from './src/evaluation/metrics';

const baseline = await runEvaluation(baselineConfig);
const improved = await runEvaluation(improvedConfig);

const comparison = compareEvaluations(baseline, improved);
console.log(comparison);
// {
//   comparison_diff: 0.05,
//   recall_diff: 0.08,
//   improvement: "8% better recall"
// }
```

## Debugging Poor Performance

### SQL Generation Issues

**Symptom**: Low accuracy across all questions

**Debug**:
```typescript
// Log SQL queries
const sql = await translator.translate(question, schema, stats, table);
console.log('Generated SQL:', sql);

// Manually verify SQL
const results = db.executeQuery(sql);
console.log('Results:', results);
```

**Common fixes**:
- Add more column statistics
- Improve schema descriptions
- Use better model (GPT-4o vs GPT-4o-mini)
- Add few-shot examples to prompt

### Answer Generation Issues

**Symptom**: SQL correct, but answers wrong format

**Debug**:
```typescript
// Check raw results
console.log('Query results:', results);

// Check formatted results
const formatted = executor.executeAndFormat(sql);
console.log('Formatted:', formatted);

// Check generated answer
const answer = await generator.generateAnswer(question, results, sql);
console.log('Answer:', answer);
```

**Common fixes**:
- Lower temperature (0.3 for factual)
- Improve answer generation prompt
- Better result formatting
- Include SQL in context

### Extraction Issues

**Symptom**: Empty results or wrong values

**Debug**:
```typescript
// Check extracted records
console.log('Extracted:', records);

// Verify against source
console.log('Source document:', documents[0]);
```

**Common fixes**:
- Simplify schema (fewer properties)
- Improve property descriptions
- Use better extraction model
- Add validation rules

## Example Evaluation Script

```typescript
// evaluate.ts
import { readFileSync } from 'fs';
import { LLMClient } from './src/llm/llm-client';
import { Evaluator } from './src/evaluation/evaluator';
import { generateMarkdownReport } from './src/evaluation/metrics';

async function main() {
  // Load test set
  const testSet = JSON.parse(
    readFileSync('data/benchmarks/hotels-test.json', 'utf-8')
  );

  // Initialize
  const llmClient = new LLMClient(process.env.OPENAI_API_KEY);
  const evaluator = new Evaluator(llmClient);

  // Run predictions (your code here)
  const predictions = await runPredictions(testSet.questions);

  // Evaluate
  const results = await evaluator.evaluateDataset(
    testSet.questions.map((q, i) => ({
      question: q.question,
      goldAnswer: q.goldAnswer,
      predictedAnswer: predictions[i],
    }))
  );

  // Generate report
  const report = generateMarkdownReport(results, 'Hotels Benchmark');
  console.log(report);

  // Check if passing
  const passing =
    results.comparison.mean > 0.70 &&
    results.recall.mean > 0.65;

  console.log(passing ? '✓ PASSED' : '✗ FAILED');
  process.exit(passing ? 0 : 1);
}

main();
```

Run with:
```bash
tsx evaluate.ts
```

## Summary

- Use **Answer Comparison** for binary correctness
- Use **Answer Recall** for completeness measurement
- Target **> 0.70** for comparison, **> 0.65** for recall
- Evaluate regularly and systematically
- Debug component by component
- Iterate based on results

For more details, see the [S-RAG paper](https://arxiv.org/abs/2511.08505v1) Section 4 on evaluation methodology.
