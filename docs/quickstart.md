# S-RAG Quickstart Guide

This guide will walk you through using S-RAG from installation to running your first queries.

## Table of Contents

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Your First Ingestion](#your-first-ingestion)
4. [Your First Query](#your-first-query)
5. [Running Examples](#running-examples)
6. [Using Your Own Data](#using-your-own-data)
7. [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

Ensure you have:
- **Node.js** version 18.0.0 or higher
- **npm** (comes with Node.js)
- An **OpenAI API key** or **Anthropic API key**

Check your Node.js version:
```bash
node --version  # Should be >= 18.0.0
```

### Install S-RAG

```bash
# Clone the repository
git clone https://github.com/yourusername/learn-srag.git
cd learn-srag

# Install dependencies
npm install

# Build the project
npm run build
```

### Verify Installation

```bash
# Run tests to ensure everything is working
npm test

# Check TypeScript compilation
npm run typecheck
```

You should see all tests passing and no TypeScript errors.

## Configuration

### Set Up Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your API key(s):

```bash
# For OpenAI (GPT-4o, GPT-4o-mini, etc.)
OPENAI_API_KEY=sk-your-openai-key-here

# For Anthropic (Claude models)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# You need at least one of the above

# Optional: Customize settings
LLM_MODEL=gpt-4o                    # Default model
LLM_TEMPERATURE=0.7                 # Default temperature
LLM_MAX_TOKENS=2000                 # Default max tokens
DATABASE_PATH=data/databases/       # Database storage
LOG_LEVEL=info                      # Logging level
```

### Configuration Options

S-RAG uses sensible defaults, but you can customize:

- **LLM_MODEL**: Which model to use (`gpt-4o`, `claude-3-5-sonnet`, etc.)
- **LLM_TEMPERATURE**: Creativity (0.0 = deterministic, 1.0 = creative)
- **LLM_MAX_TOKENS**: Maximum response length
- **DATABASE_PATH**: Where to store SQLite databases
- **SCHEMA_ITERATIONS**: Schema refinement iterations (default: 4)
- **LOG_LEVEL**: Logging verbosity (`debug`, `info`, `warn`, `error`)

## Your First Ingestion

Let's ingest some hotel data and create a queryable database.

### Step 1: Prepare Your Data

We'll use the included hotels example. The data is already in `data/datasets/hotels/`:
- `hotel1.txt` through `hotel5.txt`: Hotel descriptions
- `questions.txt`: Sample questions about hotels

### Step 2: Run the Ingestion

```typescript
// ingestion-example.ts
import { LLMClient } from './src/llm/llm-client';
import { SchemaPredictor } from './src/ingestion/schema-predictor';
import { RecordExtractor } from './src/ingestion/record-extractor';
import { DatabaseManager } from './src/database/database-manager';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function ingest() {
  // 1. Load documents
  const hotelsDir = join(process.cwd(), 'data', 'datasets', 'hotels');
  const files = readdirSync(hotelsDir).filter(f => f.startsWith('hotel'));
  const documents = files.map(f => readFileSync(join(hotelsDir, f), 'utf-8'));

  // 2. Load sample questions
  const questionsText = readFileSync(join(hotelsDir, 'questions.txt'), 'utf-8');
  const questions = questionsText.split('\n').filter(q => q.trim()).slice(0, 5);

  // 3. Initialize LLM client
  const llmClient = new LLMClient(process.env.OPENAI_API_KEY);

  // 4. Predict schema
  console.log('Predicting schema...');
  const predictor = new SchemaPredictor(llmClient);
  const schema = await predictor.predictSchema(
    documents.slice(0, 3),  // Use first 3 as samples
    questions
  );
  console.log('Schema generated:', JSON.stringify(schema, null, 2));

  // 5. Extract records
  console.log('Extracting records...');
  const extractor = new RecordExtractor(llmClient);
  const records = await extractor.batchExtract(documents, schema);
  console.log(`Extracted ${records.length} records`);

  // 6. Create database
  console.log('Creating database...');
  const db = new DatabaseManager('data/databases/hotels.db');
  db.createTableFromSchema(schema, 'hotels');
  db.insertRecords(records, 'hotels');
  db.close();

  console.log('✓ Ingestion complete!');
}

ingest();
```

Run it:
```bash
tsx ingestion-example.ts
```

This will:
1. Analyze your documents and questions
2. Generate a schema (takes 2-4 minutes)
3. Extract structured records from all documents
4. Create a SQLite database at `data/databases/hotels.db`

## Your First Query

Now let's query the database with natural language.

### Step 1: Write a Query Script

```typescript
// query-example.ts
import { LLMClient } from './src/llm/llm-client';
import { DatabaseManager } from './src/database/database-manager';
import { StatisticsCalculator } from './src/ingestion/statistics-calculator';
import { TextToSQL } from './src/inference/text-to-sql';
import { QueryExecutor } from './src/inference/query-executor';
import { AnswerGenerator } from './src/inference/answer-generator';
import { JSONSchema } from './src/models/schema';
import dotenv from 'dotenv';

dotenv.config();

async function query() {
  // 1. Load database and schema
  const db = new DatabaseManager('data/databases/hotels.db');
  const schema = JSONSchema.fromJSON(/* your schema JSON */);

  // 2. Calculate statistics
  const statsCalc = new StatisticsCalculator(db);
  const stats = statsCalc.getAllStatistics('hotels');

  // 3. Initialize components
  const llmClient = new LLMClient(process.env.OPENAI_API_KEY);
  const translator = new TextToSQL(llmClient);
  const executor = new QueryExecutor(db);
  const generator = new AnswerGenerator(llmClient);

  // 4. Ask a question
  const question = "What is the average price of a standard room?";

  console.log(`Question: ${question}`);

  // 5. Translate to SQL
  const sql = await translator.translate(question, schema, stats, 'hotels');
  console.log(`SQL: ${sql}`);

  // 6. Execute query
  const results = executor.executeAndFormat(sql);
  console.log(`Results: ${JSON.stringify(results)}`);

  // 7. Generate answer
  const answer = await generator.generateAnswer(question, results, sql);
  console.log(`Answer: ${answer}`);

  db.close();
}

query();
```

Run it:
```bash
tsx query-example.ts
```

Expected output:
```
Question: What is the average price of a standard room?
SQL: SELECT AVG(standard_room_price) as average_price FROM hotels
Results: [{"average_price": 167.8}]
Answer: The average price of a standard room is $167.80.
```

## Running Examples

S-RAG includes three complete examples you can run immediately:

### Hotels Example

```bash
npm run example:hotels
```

This demonstrates:
- Schema generation from hotel descriptions
- Record extraction
- Aggregative queries (averages, counts, filtering)
- Natural language answers

### World Cup Example

```bash
npm run example:worldcup
```

This demonstrates:
- Sports data with complex nested information
- Match statistics and scores
- Multi-match aggregations

### Custom Corpus Example

```bash
npm run example:custom
```

This is a template for your own data. It shows:
- How to structure your documents
- How to create questions
- Configuration options
- Step-by-step workflow

## Using Your Own Data

### Step 1: Organize Your Documents

Create a directory for your corpus:

```bash
mkdir -p data/datasets/my-corpus
```

Add your documents (text, markdown, or HTML):
```
data/datasets/my-corpus/
├── doc1.txt
├── doc2.txt
├── doc3.txt
└── questions.txt
```

### Step 2: Create Questions

In `questions.txt`, add questions (one per line):

```
What is the total revenue across all companies?
How many products cost more than $100?
Which category has the most items?
What is the average rating?
```

Questions should:
- Be answerable from your documents
- Include some aggregative queries (count, average, sum)
- Cover different aspects of your data
- Be specific and clear

### Step 3: Customize the Template

Copy the custom corpus example:

```bash
cp examples/custom-corpus-example.ts examples/my-corpus.ts
```

Edit the CONFIG section:

```typescript
const CONFIG = {
  documentsDir: join(process.cwd(), 'data', 'datasets', 'my-corpus'),
  documentPattern: /\.(txt|md|html)$/,
  questionsFile: join(process.cwd(), 'data', 'datasets', 'my-corpus', 'questions.txt'),
  sampleDocCount: 3,      // Documents to use for schema prediction
  sampleQuestionCount: 5, // Questions to use for schema prediction
  batchSize: 10,          // Documents to process concurrently
  dbPath: join(process.cwd(), 'data', 'databases', 'my-corpus.db'),
  tableName: 'records',
};
```

### Step 4: Run Your Pipeline

```bash
tsx examples/my-corpus.ts
```

This will:
1. Load your documents
2. Generate a schema
3. Extract records
4. Create a database
5. Test queries from your questions file

### Step 5: Iterate and Refine

Review the results:
- Check the generated schema - does it capture your data well?
- Look at extracted records - are values correct?
- Test queries - are answers accurate?

If not satisfied:
- Refine your questions to be more specific
- Add more sample documents
- Adjust batch size for performance
- Increase schema iterations

## Troubleshooting

### API Key Errors

**Error**: `No API key found`

**Solution**:
- Ensure `.env` file exists
- Check that `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
- Verify no extra spaces or quotes around the key

### Schema Generation Takes Too Long

**Problem**: Schema prediction is very slow

**Solutions**:
- Use fewer sample documents (2-3 is usually enough)
- Reduce sample questions (5 is optimal)
- Try a faster model like `gpt-4o-mini` or `claude-3-haiku`
- Reduce `SCHEMA_ITERATIONS` in config (default is 4)

### Record Extraction Errors

**Error**: `Failed to extract record from document`

**Solutions**:
- Check document format - is it readable text?
- Simplify your schema - fewer properties is better
- Increase `LLM_MAX_TOKENS` if documents are long
- Check for special characters or encoding issues

### SQL Generation Errors

**Error**: `Invalid SQL generated`

**Solutions**:
- Verify schema is loaded correctly
- Check that statistics are calculated
- Make question more specific
- Review generated SQL and refine question
- Try a more capable model (gpt-4o vs gpt-4o-mini)

### Empty Query Results

**Problem**: Queries return no results

**Solutions**:
- Check that records were inserted: `SELECT COUNT(*) FROM your_table`
- Review extracted records - do values match schema?
- Simplify query to test: "How many records are there?"
- Check for type mismatches (string vs number)

### Rate Limit Errors

**Error**: `Rate limit exceeded`

**Solutions**:
- Reduce batch size to slow down API calls
- Add delays between batches
- Use a higher tier API key
- Process documents sequentially instead of in parallel

### Out of Memory

**Problem**: Process crashes with memory errors

**Solutions**:
- Reduce batch size
- Process documents in smaller chunks
- Increase Node.js memory: `node --max-old-space-size=4096`
- Use streaming for very large datasets

## Next Steps

Now that you have the basics:

1. **Explore the examples** - See `examples/` for complete workflows
2. **Read the architecture docs** - Understand how S-RAG works (`docs/architecture.md`)
3. **Try evaluation** - Measure accuracy with `docs/evaluation.md`
4. **Build an application** - Use S-RAG in your project
5. **Contribute** - Share your improvements via pull requests

## Getting Help

- **Documentation**: See `docs/` for detailed guides
- **Examples**: Check `examples/` for working code
- **Issues**: Report bugs on GitHub
- **Discussions**: Ask questions in GitHub Discussions

Happy querying!
