/**
 * API endpoint tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { APIServer } from '../../src/api.js';
import type { Application } from 'express';

// Mock the orchestration functions
vi.mock('../../src/index.js', () => ({
  runIngestion: vi.fn().mockResolvedValue({
    schema: {
      title: 'Test Schema',
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name' },
      },
      toJSON: () => ({
        title: 'Test Schema',
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name' },
        },
      }),
    },
    tableName: 'test',
    dbPath: 'test.db',
    recordCount: 10,
    statistics: {},
  }),
  runQuery: vi.fn().mockResolvedValue({
    question: 'Test question?',
    sql: 'SELECT * FROM test',
    results: [{ name: 'Test' }],
    answer: 'The answer is Test',
    metadata: {
      sqlGenerationTime: 100,
      executionTime: 10,
      answerGenerationTime: 50,
      totalTime: 160,
    },
  }),
  runEvaluation: vi.fn().mockResolvedValue({
    answer_comparison: 0.85,
    answer_recall: 0.92,
    num_examples: 1,
    per_example_results: [
      {
        question: 'Test?',
        is_correct: true,
        recall: 0.92,
      },
    ],
  }),
}));

describe('API Server', () => {
  let app: Application;
  let server: APIServer;

  beforeAll(async () => {
    server = new APIServer(3001);
    app = server.getApp();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('POST /api/ingest', () => {
    it('should ingest documents successfully', async () => {
      const response = await request(app)
        .post('/api/ingest')
        .send({
          documents: ['Doc 1', 'Doc 2'],
          questions: ['Q1?', 'Q2?'],
          dbPath: 'test.db',
          tableName: 'test',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('schema');
      expect(response.body).toHaveProperty('tableName', 'test');
      expect(response.body).toHaveProperty('recordCount', 10);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/ingest')
        .send({
          documents: ['Doc 1'],
          // Missing questions
          dbPath: 'test.db',
          tableName: 'test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should validate documents array is not empty', async () => {
      const response = await request(app)
        .post('/api/ingest')
        .send({
          documents: [],
          questions: ['Q1?'],
          dbPath: 'test.db',
          tableName: 'test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('POST /api/query', () => {
    it('should query database successfully', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          question: 'Test question?',
          dbPath: 'test.db',
          tableName: 'test',
          schemaPath: 'schema.json',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('question', 'Test question?');
      expect(response.body).toHaveProperty('sql');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('answer');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          question: 'Test?',
          // Missing dbPath
          tableName: 'test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should validate question is not empty', async () => {
      const response = await request(app)
        .post('/api/query')
        .send({
          question: '',
          dbPath: 'test.db',
          tableName: 'test',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('POST /api/evaluate', () => {
    it('should evaluate test cases successfully', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({
          testCases: [
            {
              question: 'Test?',
              gold_answer: 'Gold answer',
              predicted_answer: 'Predicted answer',
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('answer_comparison');
      expect(response.body).toHaveProperty('answer_recall');
      expect(response.body).toHaveProperty('num_examples');
      expect(response.body).toHaveProperty('per_example_results');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({
          testCases: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation Error');
    });
  });

  describe('GET /api-docs.json', () => {
    it('should return OpenAPI spec', async () => {
      const response = await request(app).get('/api-docs.json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('openapi');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('paths');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });
});
