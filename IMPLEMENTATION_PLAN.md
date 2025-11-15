# S-RAG Implementation Plan - MVP Level

**Based on:** "Structured RAG for Answering Aggregative Questions" (arXiv:2511.08505v1)
**Date:** 2025-11-15
**Target:** MVP implementation in 8 weeks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Concepts](#core-concepts)
3. [System Architecture](#system-architecture)
4. [MVP Implementation Phases](#mvp-implementation-phases)
5. [Technical Specification](#technical-specification)
6. [Project Structure](#project-structure)
7. [Technology Stack](#technology-stack)
8. [Success Criteria](#success-criteria)
9. [Next Steps](#next-steps)

---

## Executive Summary

### Problem Statement

Traditional RAG systems struggle with **aggregative queries** - questions requiring:
- Information from dozens or hundreds of documents
- Complex filtering (e.g., "before 2020", "greater than 200kg")
- Aggregation operations (average, count, max, etc.)
- Reasoning across multiple attributes

**Example Query:** *"What is the average ARR for South American companies with more than 1,000 employees?"*

### Solution: S-RAG

**Key Innovation:** Transform unstructured documents into structured database at ingestion time, then translate natural language queries to SQL at inference time.

**Performance Gains:**
- 50-60% improvement over traditional RAG on novel datasets
- 10-20% improvement on familiar datasets
- Handles completeness (retrieves all needed documents)
- Overcomes context window limitations

---

## Core Concepts

### 1. Aggregative Questions

Queries requiring:
- Large-scale retrieval across many documents
- Numerical aggregation (sum, avg, count, min, max)
- Complex filtering and constraints
- Multi-attribute reasoning

### 2. Schema-Based Approach

**Assumption:** Documents in corpus share recurring attributes (schema)

**Example:**
- Corpus: CVs of job candidates
- Schema: name, years_of_education, email, years_of_experience, location

### 3. Two-Phase Architecture

**Ingestion (Offline):**
1. Predict schema from sample docs + questions
2. Extract structured records from all documents
3. Store in SQL database with statistics

**Inference (Online):**
1. Translate natural language query to SQL
2. Execute query on database
3. Generate natural language answer

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      INGESTION PHASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Sample Docs (12) + Questions (10)                           │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────┐                                     │
│  │ Schema Prediction   │  (LLM - 4 iterations)               │
│  │  - Generate schema  │                                     │
│  │  - Refine schema    │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  JSON Schema (attributes, types, descriptions, examples)     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │ Record Extraction   │  (LLM)                              │
│  │  - Extract values   │                                     │
│  │  - Validate types   │                                     │
│  │  - Standardize      │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  SQL Database       │                                     │
│  │  - All records      │                                     │
│  │  - Column stats     │                                     │
│  └─────────────────────┘                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      INFERENCE PHASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Natural Language Query                                      │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────────┐                                     │
│  │  Text-to-SQL        │  (LLM + Schema + Statistics)        │
│  │  - Parse query      │                                     │
│  │  - Generate SQL     │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  Query Executor     │                                     │
│  │  - Run SQL          │                                     │
│  │  - Get results      │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  ┌─────────────────────┐                                     │
│  │  Answer Generator   │  (LLM)                              │
│  │  - Format results   │                                     │
│  │  - Generate answer  │                                     │
│  └─────────┬───────────┘                                     │
│            │                                                  │
│            ▼                                                  │
│  Natural Language Answer                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## MVP Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up core infrastructure and dependencies

**Tasks:**
- [ ] Project setup (repo, dependencies, configuration)
- [ ] LLM client wrapper (OpenAI, Anthropic APIs)
- [ ] Database manager (SQLite)
- [ ] Configuration management
- [ ] Logging and error handling

**Deliverables:**
- `llm_client.py` - Unified LLM API wrapper
- `database_manager.py` - SQL database operations
- `config.py` - Configuration management
- `requirements.txt` - Dependencies
- Basic project structure

**Estimated Effort:** 40 hours

---

### Phase 2: Ingestion Pipeline (Weeks 3-4)

**Goal:** Implement schema prediction and record extraction

#### 2.1 Schema Prediction (Week 3)

**Tasks:**
- [ ] Implement iterative schema generation
- [ ] Create prompt templates (first iteration, refinement)
- [ ] Schema validation and JSON Schema compliance
- [ ] Schema storage and versioning

**Components:**
- `schema_predictor.py`
- `prompts/schema_generation.txt`
- `prompts/schema_refinement.txt`

**Key Features:**
- 4 iterations of refinement
- Support for primitive types (string, number, integer, boolean)
- Attribute descriptions and examples
- Schema versioning

#### 2.2 Record Extraction (Week 4)

**Tasks:**
- [ ] Document-to-record extraction using LLM
- [ ] Type validation and coercion
- [ ] Value standardization (e.g., "1M" → 1000000)
- [ ] Batch processing for multiple documents
- [ ] Statistics calculation (min, max, mean, unique values)

**Components:**
- `record_extractor.py`
- `statistics_calculator.py`
- `prompts/record_extraction.txt`

**Key Features:**
- Batch processing with configurable batch size
- Type validation against schema
- Standardization rules
- Null/missing value handling
- Column statistics for inference

**Estimated Effort:** 60 hours

---

### Phase 3: Inference Pipeline (Weeks 5-6)

**Goal:** Implement query translation and answer generation

#### 3.1 Text-to-SQL (Week 5)

**Tasks:**
- [ ] Natural language to SQL translation
- [ ] Prompt engineering with schema and statistics
- [ ] SQL validation and sanitization
- [ ] Error handling and retry logic

**Components:**
- `text_to_sql.py`
- `prompts/text_to_sql.txt`

**Key Features:**
- Include column statistics in prompt
- Support WHERE, GROUP BY, HAVING, ORDER BY
- SQL injection prevention
- Query validation before execution

#### 3.2 Query Execution & Answer Generation (Week 6)

**Tasks:**
- [ ] Safe SQL execution
- [ ] Result formatting
- [ ] Answer generation from SQL results
- [ ] Context preparation for LLM

**Components:**
- `query_executor.py`
- `answer_generator.py`
- `prompts/answer_generation.txt`

**Key Features:**
- Parameterized queries
- Result pagination
- Natural language answer generation
- Citation of SQL query in response

**Estimated Effort:** 60 hours

---

### Phase 4: Evaluation & Testing (Week 7)

**Goal:** Implement evaluation metrics and testing framework

**Tasks:**
- [ ] LLM-as-judge for answer comparison
- [ ] Answer recall metric
- [ ] Test dataset support (HOTELS, WORLD CUP format)
- [ ] Benchmark scripts
- [ ] Unit tests for all modules
- [ ] Integration tests

**Components:**
- `evaluator.py`
- `metrics.py`
- `tests/` directory with comprehensive tests

**Metrics:**
1. **Answer Comparison:** Binary judgment (correct/incorrect)
2. **Answer Recall:** % of claims covered

**Estimated Effort:** 30 hours

---

### Phase 5: API & Interface (Week 8)

**Goal:** Provide user-friendly interfaces

**Tasks:**
- [ ] REST API (FastAPI)
- [ ] CLI interface (Click)
- [ ] API documentation
- [ ] Usage examples
- [ ] README and quickstart guide

**Components:**
- `api.py` - REST API endpoints
- `cli.py` - Command-line interface
- `docs/` - Documentation

**API Endpoints:**
- `POST /ingest` - Ingest documents with schema
- `POST /query` - Query the system
- `GET /schema/{id}` - Get schema
- `GET /stats/{id}` - Get database statistics

**CLI Commands:**
- `srag ingest --docs <path> --schema <path>`
- `srag query --text "your question"`
- `srag evaluate --dataset <path>`

**Estimated Effort:** 30 hours

---

## Technical Specification

### 1. Schema Prediction

**Class: SchemaPredictor**

```python
class SchemaPredictor:
    """
    Generates JSON schema from sample documents and questions
    using iterative refinement with LLM.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client
        self.num_iterations = 4

    def predict_schema(
        self,
        sample_documents: List[str],
        sample_questions: List[str],
        num_docs: int = 12,
        num_questions: int = 10
    ) -> JSONSchema:
        """
        Iteratively generate and refine schema.

        Args:
            sample_documents: Sample documents from corpus
            sample_questions: Sample questions to answer
            num_docs: Number of docs to use (default: 12)
            num_questions: Number of questions to use (default: 10)

        Returns:
            JSONSchema object with schema definition

        Process:
            1. First iteration: Generate initial schema from docs
            2. Iterations 2-4: Refine based on docs + questions
            3. Validate JSON Schema compliance
            4. Return final schema
        """
        # Select sample subset
        docs = sample_documents[:num_docs]
        questions = sample_questions[:num_questions]

        # First iteration: docs only
        schema = self._generate_initial_schema(docs)

        # Refinement iterations
        for i in range(self.num_iterations - 1):
            schema = self._refine_schema(schema, docs, questions)

        # Validate
        self._validate_schema(schema)

        return JSONSchema(schema)

    def _generate_initial_schema(self, documents: List[str]) -> dict:
        """Generate initial schema from documents only"""
        prompt = self._build_first_iteration_prompt(documents)
        response = self.llm.generate(prompt, model="gpt-4o")
        schema = self._parse_json_response(response)
        return schema

    def _refine_schema(
        self,
        current_schema: dict,
        documents: List[str],
        questions: List[str]
    ) -> dict:
        """Refine schema based on questions and documents"""
        prompt = self._build_refinement_prompt(
            current_schema, documents, questions
        )
        response = self.llm.generate(prompt, model="gpt-4o")
        refined_schema = self._parse_json_response(response)
        return refined_schema

    def _validate_schema(self, schema: dict) -> None:
        """Validate JSON Schema compliance"""
        # Check required fields
        assert "title" in schema
        assert "type" in schema and schema["type"] == "object"
        assert "properties" in schema

        # Validate properties
        for prop_name, prop_def in schema["properties"].items():
            assert "type" in prop_def
            assert "description" in prop_def
            assert "examples" in prop_def

            # MVP: Only primitive types
            assert prop_def["type"] in ["string", "number", "integer", "boolean"]
```

**Prompts:**

See Appendix B in paper for full prompts. Key elements:
- First iteration: Focus on recurring concepts across documents
- Refinement: Consider questions that need to be answered
- Constraints: No nested objects, no lengthy strings, include examples

---

### 2. Record Extraction

**Class: RecordExtractor**

```python
class RecordExtractor:
    """
    Extracts structured records from documents based on schema.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    def extract_record(
        self,
        document: str,
        schema: JSONSchema
    ) -> Record:
        """
        Extract record from single document.

        Args:
            document: Raw document text (HTML, markdown, or plain text)
            schema: JSON Schema defining expected structure

        Returns:
            Record object with values for each schema attribute

        Process:
            1. Build prompt with schema details
            2. Call LLM to extract values
            3. Validate types
            4. Standardize values
            5. Return record
        """
        prompt = self._build_extraction_prompt(document, schema)
        response = self.llm.generate(prompt, model="gpt-4o")
        record = self._parse_record_response(response, schema)
        record = self._validate_and_standardize(record, schema)
        return Record(record, schema)

    def batch_extract(
        self,
        documents: List[str],
        schema: JSONSchema,
        batch_size: int = 10
    ) -> List[Record]:
        """
        Extract records from multiple documents in batches.

        Uses async processing for efficiency.
        """
        records = []
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i+batch_size]
            batch_records = await self._extract_batch(batch, schema)
            records.extend(batch_records)
        return records

    def _validate_and_standardize(
        self,
        record: dict,
        schema: JSONSchema
    ) -> dict:
        """
        Validate and standardize record values.

        Standardization examples:
        - "1M" → 1000000
        - "1B" → 1000000000
        - "Yes" → True
        - Dates to ISO format
        - Currency symbols removed
        """
        validated = {}

        for attr_name, attr_def in schema.properties.items():
            value = record.get(attr_name)
            attr_type = attr_def["type"]

            if value is None:
                validated[attr_name] = None
                continue

            # Type-specific validation and standardization
            if attr_type == "integer":
                validated[attr_name] = self._standardize_integer(value)
            elif attr_type == "number":
                validated[attr_name] = self._standardize_number(value)
            elif attr_type == "boolean":
                validated[attr_name] = self._standardize_boolean(value)
            elif attr_type == "string":
                validated[attr_name] = str(value)

        return validated

    def _standardize_integer(self, value: Any) -> Optional[int]:
        """Standardize integer values (handle 1M, 1B, etc.)"""
        if isinstance(value, int):
            return value

        if isinstance(value, str):
            value = value.strip().upper()

            # Handle suffixes
            multipliers = {"K": 1000, "M": 1000000, "B": 1000000000}
            for suffix, mult in multipliers.items():
                if value.endswith(suffix):
                    num = value[:-1].replace(",", "")
                    return int(float(num) * mult)

            # Handle regular numbers
            return int(value.replace(",", ""))

        return None

    def _standardize_number(self, value: Any) -> Optional[float]:
        """Standardize float values"""
        # Similar to _standardize_integer but returns float
        pass

    def _standardize_boolean(self, value: Any) -> Optional[bool]:
        """Standardize boolean values"""
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            value = value.strip().lower()
            if value in ["yes", "true", "1", "y"]:
                return True
            if value in ["no", "false", "0", "n"]:
                return False

        return None
```

---

### 3. Database Manager

**Class: DatabaseManager**

```python
class DatabaseManager:
    """
    Manages SQL database for structured records.
    Supports SQLite (MVP) with easy migration to PostgreSQL.
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}")
        self.metadata = MetaData()

    def create_table_from_schema(
        self,
        schema: JSONSchema,
        table_name: str
    ) -> None:
        """
        Create SQL table from JSON schema.

        Type mapping:
        - string → TEXT
        - number → REAL
        - integer → INTEGER
        - boolean → BOOLEAN
        """
        columns = []

        # Add ID column
        columns.append(Column("id", Integer, primary_key=True))

        # Add columns from schema
        for attr_name, attr_def in schema.properties.items():
            sql_type = self._json_type_to_sql(attr_def["type"])
            columns.append(Column(attr_name, sql_type, nullable=True))

        # Create table
        table = Table(table_name, self.metadata, *columns)
        self.metadata.create_all(self.engine)

    def insert_records(
        self,
        records: List[Record],
        table_name: str
    ) -> None:
        """Batch insert records"""
        with self.engine.connect() as conn:
            for record in records:
                conn.execute(
                    f"INSERT INTO {table_name} ({', '.join(record.keys())}) "
                    f"VALUES ({', '.join(['?' for _ in record.values()])})",
                    list(record.values())
                )
            conn.commit()

    def execute_query(self, sql: str) -> List[dict]:
        """Execute SQL query and return results as dicts"""
        with self.engine.connect() as conn:
            result = conn.execute(text(sql))
            return [dict(row) for row in result]

    def get_column_statistics(self, table_name: str) -> dict:
        """
        Calculate statistics for all columns.

        For numeric columns:
        - min, max, mean, count

        For string/boolean columns:
        - unique values, count

        For all columns:
        - non-null count
        """
        stats = {}

        # Get table info
        inspector = inspect(self.engine)
        columns = inspector.get_columns(table_name)

        for col in columns:
            col_name = col["name"]
            col_type = col["type"]

            if isinstance(col_type, (Integer, Float)):
                # Numeric statistics
                with self.engine.connect() as conn:
                    result = conn.execute(text(f"""
                        SELECT
                            MIN({col_name}) as min_val,
                            MAX({col_name}) as max_val,
                            AVG({col_name}) as mean_val,
                            COUNT({col_name}) as count_val
                        FROM {table_name}
                    """))
                    row = result.fetchone()
                    stats[col_name] = {
                        "min": row[0],
                        "max": row[1],
                        "mean": row[2],
                        "count": row[3],
                        "type": "numeric"
                    }
            else:
                # Categorical statistics
                with self.engine.connect() as conn:
                    result = conn.execute(text(f"""
                        SELECT DISTINCT {col_name}
                        FROM {table_name}
                        WHERE {col_name} IS NOT NULL
                    """))
                    unique_vals = [row[0] for row in result]
                    stats[col_name] = {
                        "unique_values": unique_vals,
                        "count": len(unique_vals),
                        "type": "categorical"
                    }

        return stats
```

---

### 4. Text-to-SQL Translation

**Class: TextToSQL**

```python
class TextToSQL:
    """
    Translates natural language queries to SQL.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    def translate(
        self,
        question: str,
        schema: JSONSchema,
        statistics: dict,
        table_name: str
    ) -> str:
        """
        Convert natural language to SQL.

        Args:
            question: Natural language query
            schema: Database schema
            statistics: Column statistics for disambiguation
            table_name: Name of the table to query

        Returns:
            SQL query string

        Process:
            1. Build prompt with schema and statistics
            2. Call LLM (GPT-4o)
            3. Extract SQL from response
            4. Validate SQL
            5. Return SQL
        """
        prompt = self._build_prompt(question, schema, statistics, table_name)
        response = self.llm.generate(prompt, model="gpt-4o")
        sql = self._extract_sql(response)

        # Validate
        if not self._validate_sql(sql, table_name):
            raise ValueError(f"Invalid SQL generated: {sql}")

        return sql

    def _build_prompt(
        self,
        question: str,
        schema: JSONSchema,
        statistics: dict,
        table_name: str
    ) -> str:
        """
        Build prompt with schema and statistics.

        Includes:
        - Table name
        - Column names and types
        - Column descriptions
        - Column statistics (unique values, min/max)
        - Question to answer
        """
        prompt = f"""You are a SQL expert. Convert the following natural language query to SQL.

Table: {table_name}

Schema:
"""
        for attr_name, attr_def in schema.properties.items():
            prompt += f"- {attr_name} ({attr_def['type']}): {attr_def['description']}\n"

        prompt += "\nColumn Statistics:\n"
        for col_name, col_stats in statistics.items():
            if col_stats["type"] == "numeric":
                prompt += f"- {col_name}: min={col_stats['min']}, max={col_stats['max']}, mean={col_stats['mean']}\n"
            else:
                unique_vals = col_stats['unique_values'][:10]  # Limit to 10
                prompt += f"- {col_name}: unique values={unique_vals}\n"

        prompt += f"\nQuestion: {question}\n\n"
        prompt += "Generate a SQL query to answer this question. Return ONLY the SQL query, no explanation."

        return prompt

    def _validate_sql(self, sql: str, table_name: str) -> bool:
        """
        Validate SQL syntax and safety.

        Checks:
        - No DROP, DELETE, INSERT, UPDATE statements
        - Only SELECT allowed
        - No SQL injection patterns
        - Valid SQL syntax
        """
        sql_upper = sql.strip().upper()

        # Only allow SELECT
        if not sql_upper.startswith("SELECT"):
            return False

        # Disallow dangerous operations
        dangerous = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE"]
        for keyword in dangerous:
            if keyword in sql_upper:
                return False

        # Check table name is referenced
        if table_name not in sql:
            return False

        # Try to parse (basic validation)
        try:
            # Use sqlparse or similar for validation
            import sqlparse
            parsed = sqlparse.parse(sql)
            return len(parsed) > 0
        except:
            return False
```

---

### 5. Answer Generator

**Class: AnswerGenerator**

```python
class AnswerGenerator:
    """
    Generates natural language answers from SQL results.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    def generate_answer(
        self,
        question: str,
        sql_results: List[dict],
        sql_query: str
    ) -> str:
        """
        Generate natural language answer.

        Args:
            question: Original question
            sql_results: Results from SQL query
            sql_query: The SQL query that was executed

        Returns:
            Natural language answer
        """
        # Format results for context
        context = self._format_results(sql_results)

        # Build prompt
        prompt = f"""Answer the following question based on the SQL query results.

Question: {question}

SQL Query: {sql_query}

Results:
{context}

Generate a clear, concise answer in natural language. If the results are numerical, include the exact values. If there are multiple results, summarize appropriately.

Answer:"""

        response = self.llm.generate(prompt, model="gpt-4o")
        return response.strip()

    def _format_results(self, results: List[dict]) -> str:
        """Format SQL results as readable text"""
        if not results:
            return "No results found."

        if len(results) == 1:
            # Single result
            return json.dumps(results[0], indent=2)

        # Multiple results - format as table
        output = ""
        for i, row in enumerate(results[:100]):  # Limit to 100 rows
            output += f"Row {i+1}: {json.dumps(row)}\n"

        if len(results) > 100:
            output += f"\n... and {len(results) - 100} more rows"

        return output
```

---

### 6. Evaluation

**Class: Evaluator**

```python
class Evaluator:
    """
    Evaluates system performance using LLM-as-judge.
    """

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    def answer_comparison(
        self,
        question: str,
        gold_answer: str,
        predicted_answer: str
    ) -> bool:
        """
        Binary judgment: is predicted answer correct?

        Uses LLM as judge (GPT-4o).
        """
        prompt = f"""You are given a query, a gold answer, and a judged answer.
Decide if the judged answer is a correct answer for the query, based on the gold answer.
Do not use any external or prior knowledge. Only use the gold answer.

Answer Yes if the judged answer is a correct answer for the query, and No otherwise.

<query>
{question}
</query>

<gold_answer>
{gold_answer}
</gold_answer>

<judged_answer>
{predicted_answer}
</judged_answer>

Answer (Yes or No):"""

        response = self.llm.generate(prompt, model="gpt-4o").strip().lower()
        return "yes" in response

    def answer_recall(
        self,
        gold_answer: str,
        predicted_answer: str
    ) -> float:
        """
        Percentage of gold answer claims covered.

        Process:
        1. Decompose gold answer into individual claims
        2. Check which claims are covered in predicted answer
        3. Return percentage
        """
        # Decompose gold answer into claims
        claims_prompt = f"""Break down the following answer into individual factual claims.
Return a numbered list of claims.

Answer: {gold_answer}

Claims:"""

        claims_response = self.llm.generate(claims_prompt, model="gpt-4o")
        claims = self._parse_claims(claims_response)

        # Check coverage
        covered_count = 0
        for claim in claims:
            if self._is_claim_covered(claim, predicted_answer):
                covered_count += 1

        return covered_count / len(claims) if claims else 0.0

    def _is_claim_covered(self, claim: str, answer: str) -> bool:
        """Check if claim is covered in answer"""
        prompt = f"""Is the following claim covered in the answer?

Claim: {claim}

Answer: {answer}

Respond with Yes or No:"""

        response = self.llm.generate(prompt, model="gpt-4o").strip().lower()
        return "yes" in response

    def evaluate_dataset(
        self,
        test_cases: List[dict]
    ) -> dict:
        """
        Evaluate on full dataset.

        Args:
            test_cases: List of dicts with 'question', 'gold_answer', 'predicted_answer'

        Returns:
            Dict with metrics:
            - answer_comparison: float (accuracy)
            - answer_recall: float (average recall)
            - per_example_results: List of individual results
        """
        comparison_results = []
        recall_results = []

        for tc in test_cases:
            # Answer comparison
            is_correct = self.answer_comparison(
                tc["question"],
                tc["gold_answer"],
                tc["predicted_answer"]
            )
            comparison_results.append(is_correct)

            # Answer recall
            recall = self.answer_recall(
                tc["gold_answer"],
                tc["predicted_answer"]
            )
            recall_results.append(recall)

        return {
            "answer_comparison": sum(comparison_results) / len(comparison_results),
            "answer_recall": sum(recall_results) / len(recall_results),
            "num_examples": len(test_cases),
            "per_example_results": [
                {
                    "question": tc["question"],
                    "is_correct": comp,
                    "recall": rec
                }
                for tc, comp, rec in zip(test_cases, comparison_results, recall_results)
            ]
        }
```

---

## Project Structure

```
learn-srag/
├── src/
│   ├── srag/
│   │   ├── __init__.py
│   │   │
│   │   ├── ingestion/
│   │   │   ├── __init__.py
│   │   │   ├── schema_predictor.py      # Schema generation
│   │   │   ├── record_extractor.py      # Record extraction
│   │   │   └── statistics_calculator.py  # Column statistics
│   │   │
│   │   ├── inference/
│   │   │   ├── __init__.py
│   │   │   ├── text_to_sql.py           # NL to SQL translation
│   │   │   ├── query_executor.py        # SQL execution
│   │   │   └── answer_generator.py      # Answer generation
│   │   │
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   └── database_manager.py      # DB operations
│   │   │
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   └── llm_client.py            # LLM API wrapper
│   │   │
│   │   ├── evaluation/
│   │   │   ├── __init__.py
│   │   │   ├── evaluator.py             # Evaluation logic
│   │   │   └── metrics.py               # Metrics implementation
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schema.py                # Schema models
│   │   │   └── record.py                # Record models
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── config.py                # Configuration
│   │       ├── prompts.py               # Prompt templates
│   │       └── helpers.py               # Utility functions
│   │
│   ├── api.py                            # REST API (FastAPI)
│   └── cli.py                            # CLI (Click)
│
├── tests/
│   ├── __init__.py
│   ├── test_ingestion/
│   │   ├── test_schema_predictor.py
│   │   ├── test_record_extractor.py
│   │   └── test_statistics.py
│   ├── test_inference/
│   │   ├── test_text_to_sql.py
│   │   ├── test_query_executor.py
│   │   └── test_answer_generator.py
│   ├── test_database/
│   │   └── test_database_manager.py
│   └── test_evaluation/
│       ├── test_evaluator.py
│       └── test_metrics.py
│
├── data/
│   ├── schemas/                         # Saved schemas
│   ├── databases/                       # SQLite databases
│   └── datasets/                        # Test datasets
│       ├── hotels/
│       └── worldcup/
│
├── prompts/
│   ├── schema_generation_first.txt      # First iteration prompt
│   ├── schema_generation_refine.txt     # Refinement prompt
│   ├── record_extraction.txt            # Record extraction prompt
│   ├── text_to_sql.txt                  # Text-to-SQL prompt
│   └── answer_generation.txt            # Answer generation prompt
│
├── examples/
│   ├── hotels_example.py                # HOTELS dataset example
│   ├── worldcup_example.py              # WORLD CUP dataset example
│   └── custom_corpus_example.py         # Custom corpus example
│
├── docs/
│   ├── architecture.md                  # Architecture overview
│   ├── api_reference.md                 # API documentation
│   ├── quickstart.md                    # Quickstart guide
│   └── evaluation.md                    # Evaluation guide
│
├── scripts/
│   ├── download_datasets.py             # Download test datasets
│   └── benchmark.py                     # Run benchmarks
│
├── requirements.txt                     # Python dependencies
├── setup.py                             # Package setup
├── pyproject.toml                       # Project metadata
├── .env.example                         # Environment variables template
├── .gitignore
├── README.md
└── IMPLEMENTATION_PLAN.md               # This file
```

---

## Technology Stack

### Core Dependencies

```txt
# requirements.txt

# Core
python>=3.10

# LLM APIs
openai>=1.0.0
anthropic>=0.18.0
litellm>=1.0.0               # Unified LLM API

# Database
sqlalchemy>=2.0.0
alembic>=1.13.0              # Database migrations
sqlite3                       # Built-in

# Data Validation
pydantic>=2.0.0
jsonschema>=4.0.0

# API
fastapi>=0.100.0
uvicorn>=0.23.0
python-multipart>=0.0.6

# CLI
click>=8.1.0
rich>=13.0.0                 # Beautiful CLI output

# Utilities
python-dotenv>=1.0.0
pyyaml>=6.0.0
requests>=2.31.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0
pytest-mock>=3.11.0

# SQL
sqlparse>=0.4.0              # SQL parsing and validation

# Development
black>=23.0.0                # Code formatting
flake8>=6.0.0                # Linting
mypy>=1.5.0                  # Type checking
pre-commit>=3.3.0
```

### Optional Dependencies

```txt
# Optional: Advanced features

# PostgreSQL support
psycopg2-binary>=2.9.0

# Async processing
celery>=5.3.0
redis>=5.0.0

# Web UI
streamlit>=1.28.0

# Monitoring
prometheus-client>=0.18.0
```

---

## Success Criteria

### MVP Success Criteria

#### 1. Functional Requirements

- [ ] **Schema Prediction**
  - Successfully generate schema from 12 documents + 10 questions
  - Schema includes appropriate attributes with types and descriptions
  - Schema validation passes

- [ ] **Record Extraction**
  - Extract records from 50+ documents
  - Type validation accuracy > 95%
  - Standardization works for common formats (1M, 1B, etc.)

- [ ] **Query Execution**
  - Text-to-SQL translation success rate > 80%
  - SQL execution without errors
  - Results returned in < 10 seconds

- [ ] **Answer Generation**
  - Natural language answers generated for all queries
  - Answers include relevant information from SQL results

#### 2. Performance Requirements

- [ ] **Ingestion Performance**
  - Schema generation: < 5 minutes (4 iterations)
  - Record extraction: < 2 seconds per document
  - Batch processing: 10 documents per batch

- [ ] **Inference Performance**
  - Query answering: < 10 seconds end-to-end
  - Text-to-SQL: < 3 seconds
  - Answer generation: < 5 seconds

#### 3. Quality Requirements

- [ ] **Accuracy Metrics**
  - Answer Comparison: > 0.70 on test dataset
  - Answer Recall: > 0.65 on test dataset
  - SQL generation success rate: > 80%

- [ ] **Robustness**
  - Handle missing/null values gracefully
  - Error recovery for failed LLM calls
  - SQL injection prevention

#### 4. Usability Requirements

- [ ] **API**
  - REST API with clear endpoints
  - API documentation
  - Example requests/responses

- [ ] **CLI**
  - Intuitive commands
  - Help text for all commands
  - Progress indicators

- [ ] **Documentation**
  - README with quickstart
  - Architecture documentation
  - API reference
  - Examples for common use cases

---

## Next Steps

### Immediate Actions

1. **Set up development environment**
   - Create virtual environment
   - Install dependencies
   - Configure LLM API keys

2. **Create project structure**
   - Initialize Git repository
   - Set up directory structure
   - Create initial files

3. **Implement Phase 1 (Foundation)**
   - LLM client wrapper
   - Database manager
   - Configuration management

### Phase-by-Phase Checklist

Use this checklist to track progress:

#### Phase 1: Foundation ✓
- [ ] Project structure created
- [ ] Dependencies installed
- [ ] LLM client implemented
- [ ] Database manager implemented
- [ ] Configuration system set up
- [ ] Basic tests passing

#### Phase 2: Ingestion ✓
- [ ] Schema predictor implemented
- [ ] Prompt templates created
- [ ] Record extractor implemented
- [ ] Statistics calculator implemented
- [ ] Integration tests passing
- [ ] Example ingestion working

#### Phase 3: Inference ✓
- [ ] Text-to-SQL implemented
- [ ] Query executor implemented
- [ ] Answer generator implemented
- [ ] SQL validation working
- [ ] End-to-end inference working
- [ ] Example queries working

#### Phase 4: Evaluation ✓
- [ ] Evaluator implemented
- [ ] Answer comparison metric working
- [ ] Answer recall metric working
- [ ] Test datasets loaded
- [ ] Benchmark scripts working
- [ ] Evaluation report generated

#### Phase 5: API & Interface ✓
- [ ] REST API implemented
- [ ] CLI implemented
- [ ] API documentation written
- [ ] Examples created
- [ ] README completed
- [ ] Quickstart guide written

---

## Advanced Features (Post-MVP)

After MVP is complete, consider these enhancements:

### 1. Hybrid S-RAG Mode

Combine S-RAG with traditional RAG:
- Use S-RAG to narrow corpus to relevant documents
- Apply vector-based RAG on filtered subset
- Useful when schema doesn't capture all attributes

### 2. Multi-Schema Support

Support corpora with multiple entity types:
- Detect document type
- Apply appropriate schema
- Join across schemas

### 3. Complex Attributes

Support nested objects and lists:
- Nested schemas
- Multiple tables with foreign keys
- Array/JSON column types

### 4. Incremental Ingestion

Add documents without re-processing entire corpus:
- Incremental record extraction
- Statistics updates
- Schema evolution

### 5. Query Optimization

Improve query performance:
- Indexing strategy
- Query caching
- Materialized views

### 6. Schema Learning

Improve schema prediction:
- Active learning for schema refinement
- User feedback incorporation
- Schema versioning and migration

### 7. Production Features

- [ ] PostgreSQL support
- [ ] Async ingestion with Celery
- [ ] Caching with Redis
- [ ] Monitoring and logging
- [ ] Docker deployment
- [ ] Kubernetes manifests

---

## References

1. **Original Paper:** Koshorek et al., "Structured RAG for Answering Aggregative Questions" (arXiv:2511.08505v1)
2. **Datasets:** https://huggingface.co/datasets/ai21labs/aggregative_questions
3. **Related Work:**
   - RAG: Lewis et al., 2020
   - FinanceBench: Islam et al., 2023
   - Text-to-SQL: Various benchmarks (Spider, WikiSQL)

---

## Appendix: Example Workflows

### Example 1: HOTELS Dataset

```python
# 1. Load sample documents and questions
from srag import SchemaPredictor, RecordExtractor, DatabaseManager

sample_docs = load_hotels_documents(num=12)
sample_questions = load_hotels_questions(num=10)

# 2. Generate schema
predictor = SchemaPredictor(llm_client)
schema = predictor.predict_schema(sample_docs, sample_questions)

# 3. Create database
db = DatabaseManager("hotels.db")
db.create_table_from_schema(schema, "hotels")

# 4. Extract records from all documents
extractor = RecordExtractor(llm_client)
all_docs = load_hotels_documents()  # All 350 documents
records = extractor.batch_extract(all_docs, schema)

# 5. Insert into database
db.insert_records(records, "hotels")

# 6. Calculate statistics
stats = db.get_column_statistics("hotels")

# 7. Query the system
from srag import TextToSQL, QueryExecutor, AnswerGenerator

question = "What is the average guest rating for hotels in Sydney?"

translator = TextToSQL(llm_client)
sql = translator.translate(question, schema, stats, "hotels")

executor = QueryExecutor(db)
results = executor.execute(sql)

generator = AnswerGenerator(llm_client)
answer = generator.generate_answer(question, results, sql)

print(f"Question: {question}")
print(f"Answer: {answer}")
```

### Example 2: Custom Corpus

```python
# 1. Prepare your corpus
my_documents = [
    "Document 1 content...",
    "Document 2 content...",
    # ... more documents
]

# 2. Prepare sample questions
my_questions = [
    "What is the average X for Y?",
    "How many documents have Z?",
    # ... more questions
]

# 3. Follow same workflow as above
# ... (same steps as Example 1)
```

---

**End of Implementation Plan**

This plan provides a comprehensive roadmap for implementing S-RAG at MVP level. Follow the phases sequentially, and adjust as needed based on your specific requirements and constraints.
