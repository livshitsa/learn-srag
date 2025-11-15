# S-RAG API Usage Guide

## Overview

The S-RAG API provides RESTful endpoints for document ingestion, querying, and evaluation. The API is built with Express.js and includes OpenAPI/Swagger documentation.

## Base URL

```
http://localhost:3000
```

## Authentication

Currently, the API does not require authentication. In production, consider adding API keys or OAuth.

## API Documentation

Interactive API documentation is available at:
- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: http://localhost:3000/api-docs.json

## Endpoints

### Health Check

Check if the API server is running.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### 1. Ingest Documents

Ingest documents and create a structured database.

**Endpoint**: `POST /api/ingest`

**Request Body**:
```json
{
  "documents": [
    "Document 1 text...",
    "Document 2 text...",
    "..."
  ],
  "questions": [
    "Question 1?",
    "Question 2?",
    "..."
  ],
  "dbPath": "data/databases/my-database.db",
  "tableName": "records",
  "sampleSize": 12,
  "questionSampleSize": 10,
  "batchSize": 10
}
```

**Parameters**:
- `documents` (required): Array of document texts
- `questions` (required): Array of sample questions for schema generation
- `dbPath` (required): Path to SQLite database file
- `tableName` (required): Name of the table to create
- `sampleSize` (optional): Number of documents to use for schema generation (default: 12)
- `questionSampleSize` (optional): Number of questions to use for schema generation (default: 10)
- `batchSize` (optional): Batch size for record extraction (default: 10)
- `schema` (optional): Pre-defined JSON schema (skip schema generation)

**Response**:
```json
{
  "schema": {
    "title": "Records Schema",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name of the entity"
      },
      "price": {
        "type": "number",
        "description": "Price in USD"
      }
    }
  },
  "tableName": "records",
  "dbPath": "data/databases/my-database.db",
  "recordCount": 100,
  "statistics": {
    "price": {
      "min": 10.0,
      "max": 1000.0,
      "mean": 250.5,
      "count": 100,
      "type": "numeric"
    }
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": ["Product A costs $100", "Product B costs $200"],
    "questions": ["What is the average price?"],
    "dbPath": "data/products.db",
    "tableName": "products"
  }'
```

### 2. Query Database

Query the structured database with natural language.

**Endpoint**: `POST /api/query`

**Request Body**:
```json
{
  "question": "What is the average price?",
  "dbPath": "data/databases/my-database.db",
  "tableName": "records",
  "schemaPath": "data/schemas/records.json"
}
```

**Parameters**:
- `question` (required): Natural language question
- `dbPath` (required): Path to SQLite database file
- `tableName` (required): Name of the table to query
- `schemaPath` (optional): Path to schema file
- `schema` (optional): Schema object (if not using schemaPath)
- `statistics` (optional): Pre-calculated statistics object

**Response**:
```json
{
  "question": "What is the average price?",
  "sql": "SELECT AVG(price) as average_price FROM records",
  "results": [
    {
      "average_price": 250.5
    }
  ],
  "answer": "The average price is $250.50.",
  "metadata": {
    "sqlGenerationTime": 1234,
    "executionTime": 5,
    "answerGenerationTime": 890,
    "totalTime": 2129
  }
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the average price?",
    "dbPath": "data/products.db",
    "tableName": "products",
    "schemaPath": "data/schemas/products.json"
  }'
```

### 3. Get Schema

Retrieve the schema for a table.

**Endpoint**: `GET /api/schema/:tableName`

**Parameters**:
- `tableName` (path): Name of the table

**Response**:
```json
{
  "tableName": "records",
  "schema": {
    "title": "Records Schema",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "Name"
      }
    }
  },
  "createdAt": "2025-11-15T10:30:00.000Z"
}
```

**Example**:
```bash
curl http://localhost:3000/api/schema/products
```

### 4. Get Statistics

Retrieve statistics for a table.

**Endpoint**: `GET /api/stats/:tableName?dbPath=<path>`

**Parameters**:
- `tableName` (path): Name of the table
- `dbPath` (query): Path to database file

**Response**:
```json
{
  "tableName": "records",
  "rowCount": 100,
  "statistics": {
    "price": {
      "min": 10.0,
      "max": 1000.0,
      "mean": 250.5,
      "count": 100,
      "type": "numeric"
    },
    "category": {
      "unique_values": ["A", "B", "C"],
      "count": 3,
      "type": "categorical"
    }
  }
}
```

**Example**:
```bash
curl "http://localhost:3000/api/stats/products?dbPath=data/products.db"
```

### 5. Evaluate Performance

Evaluate system performance on test cases.

**Endpoint**: `POST /api/evaluate`

**Request Body**:
```json
{
  "testCases": [
    {
      "question": "What is the average price?",
      "gold_answer": "The average price is $250.50.",
      "predicted_answer": "The average price is approximately $250."
    }
  ]
}
```

**Response**:
```json
{
  "answer_comparison": 0.85,
  "answer_recall": 0.92,
  "num_examples": 10,
  "per_example_results": [
    {
      "question": "What is the average price?",
      "is_correct": true,
      "recall": 0.95
    }
  ]
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "testCases": [
      {
        "question": "What is the average?",
        "gold_answer": "The average is 250.",
        "predicted_answer": "The average is 250."
      }
    ]
  }'
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error Type",
  "message": "Error message description",
  "details": {}
}
```

**Common Status Codes**:
- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

**Validation Error Example**:
```json
{
  "error": "Validation Error",
  "message": "Request validation failed",
  "details": [
    {
      "path": ["documents"],
      "message": "At least one document is required"
    }
  ]
}
```

## Starting the API Server

### From Command Line

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Programmatically

```typescript
import { APIServer } from './api.js';

const server = new APIServer(3000);
await server.start();
```

### Custom Port

```bash
# Using environment variable
PORT=8080 npm start

# Or in .env file
PORT=8080
```

## CORS Configuration

The API is configured with CORS enabled for all origins. In production, configure specific origins:

```typescript
import cors from 'cors';

app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true,
}));
```

## Rate Limiting

Consider adding rate limiting in production:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

## Complete Example Workflow

### 1. Ingest Documents

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "documents": [
      "Hotel A has 100 rooms and 4-star rating",
      "Hotel B has 200 rooms and 5-star rating",
      "Hotel C has 50 rooms and 3-star rating"
    ],
    "questions": [
      "What is the average number of rooms?",
      "How many 5-star hotels are there?"
    ],
    "dbPath": "data/hotels.db",
    "tableName": "hotels"
  }'
```

### 2. Query Database

```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the average number of rooms?",
    "dbPath": "data/hotels.db",
    "tableName": "hotels",
    "schemaPath": "data/schemas/hotels.json"
  }'
```

### 3. Get Statistics

```bash
curl "http://localhost:3000/api/stats/hotels?dbPath=data/hotels.db"
```

## Client SDKs

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

// Ingest documents
async function ingest(documents: string[], questions: string[]) {
  const response = await axios.post(`${API_BASE_URL}/api/ingest`, {
    documents,
    questions,
    dbPath: 'data/my.db',
    tableName: 'records'
  });
  return response.data;
}

// Query database
async function query(question: string) {
  const response = await axios.post(`${API_BASE_URL}/api/query`, {
    question,
    dbPath: 'data/my.db',
    tableName: 'records',
    schemaPath: 'data/schemas/records.json'
  });
  return response.data;
}
```

### Python

```python
import requests

API_BASE_URL = 'http://localhost:3000'

# Ingest documents
def ingest(documents, questions):
    response = requests.post(f'{API_BASE_URL}/api/ingest', json={
        'documents': documents,
        'questions': questions,
        'dbPath': 'data/my.db',
        'tableName': 'records'
    })
    return response.json()

# Query database
def query(question):
    response = requests.post(f'{API_BASE_URL}/api/query', json={
        'question': question,
        'dbPath': 'data/my.db',
        'tableName': 'records',
        'schemaPath': 'data/schemas/records.json'
    })
    return response.json()
```

## Troubleshooting

### Database Locked

If you see "database is locked" errors, ensure only one connection is open at a time. The API automatically manages connections.

### Schema Not Found

If schema is not found, check:
1. Schema file exists in `data/schemas/` directory
2. Schema was saved during ingestion
3. Correct table name is used

### Large Payloads

For large document sets, consider:
1. Increasing payload limit in Express config
2. Using file upload instead of JSON
3. Implementing pagination

## Production Considerations

1. **Authentication**: Add API key or JWT authentication
2. **Rate Limiting**: Prevent abuse with rate limits
3. **Logging**: Use structured logging (Winston, Pino)
4. **Monitoring**: Add health checks and metrics
5. **Error Handling**: Implement proper error tracking (Sentry)
6. **Database**: Use PostgreSQL instead of SQLite for concurrency
7. **Caching**: Cache frequently accessed schemas and statistics
8. **Load Balancing**: Deploy multiple instances behind a load balancer

## Resources

- **OpenAPI Spec**: http://localhost:3000/api-docs.json
- **Swagger UI**: http://localhost:3000/api-docs
- **GitHub**: https://github.com/your-repo/learn-srag
- **Documentation**: https://your-docs-site.com
