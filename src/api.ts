/**
 * S-RAG REST API
 * Express-based REST API for S-RAG operations
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import {
  runIngestion,
  runQuery,
  runEvaluation,
  type IngestionOptions,
  type QueryOptions,
  type EvaluationOptions,
} from './index.js';
import { logger } from './utils/logger.js';
import { readJSONFile } from './utils/helpers.js';
import { JSONSchema } from './models/schema.js';

/**
 * Validation schemas
 */
const IngestRequestSchema = z.object({
  documents: z.array(z.string()).min(1, 'At least one document is required'),
  questions: z.array(z.string()).min(1, 'At least one question is required'),
  dbPath: z.string().min(1, 'Database path is required'),
  tableName: z.string().min(1, 'Table name is required'),
  sampleSize: z.number().optional(),
  questionSampleSize: z.number().optional(),
  batchSize: z.number().optional(),
  schema: z.any().optional(),
});

const QueryRequestSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  dbPath: z.string().min(1, 'Database path is required'),
  tableName: z.string().min(1, 'Table name is required'),
  schemaPath: z.string().optional(),
  schema: z.any().optional(),
  statistics: z.any().optional(),
});

const EvaluateRequestSchema = z.object({
  testCases: z
    .array(
      z.object({
        question: z.string(),
        gold_answer: z.string(),
        predicted_answer: z.string(),
      })
    )
    .min(1, 'At least one test case is required'),
});

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}

/**
 * API Server
 */
export class APIServer {
  private app: express.Application;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSwagger();
    this.setupErrorHandling();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(cors());

    // Body parser
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));

    // Request logging
    this.app.use((req, _res, next) => {
      logger.info('API Request', {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
      });
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });

    // Ingest endpoint
    /**
     * @openapi
     * /api/ingest:
     *   post:
     *     summary: Ingest documents and create structured database
     *     tags: [Ingestion]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - documents
     *               - questions
     *               - dbPath
     *               - tableName
     *             properties:
     *               documents:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of document texts
     *               questions:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: Array of sample questions
     *               dbPath:
     *                 type: string
     *                 description: Path to database file
     *               tableName:
     *                 type: string
     *                 description: Name of the table
     *               sampleSize:
     *                 type: number
     *                 description: Number of sample documents for schema generation
     *                 default: 12
     *               questionSampleSize:
     *                 type: number
     *                 description: Number of sample questions for schema generation
     *                 default: 10
     *               batchSize:
     *                 type: number
     *                 description: Batch size for record extraction
     *                 default: 10
     *               schema:
     *                 type: object
     *                 description: Optional pre-defined schema
     *     responses:
     *       200:
     *         description: Ingestion completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 schema:
     *                   type: object
     *                 tableName:
     *                   type: string
     *                 dbPath:
     *                   type: string
     *                 recordCount:
     *                   type: number
     *                 statistics:
     *                   type: object
     *       400:
     *         description: Invalid request
     *       500:
     *         description: Server error
     */
    this.app.post('/api/ingest', async (req, res, next) => {
      try {
        // Validate request
        const validatedData = IngestRequestSchema.parse(req.body);

        // Convert schema if provided
        let schema: JSONSchema | undefined;
        if (validatedData.schema) {
          schema = new JSONSchema(validatedData.schema);
        }

        // Run ingestion
        const options: IngestionOptions = {
          documents: validatedData.documents,
          questions: validatedData.questions,
          dbPath: resolve(validatedData.dbPath),
          tableName: validatedData.tableName,
          sampleSize: validatedData.sampleSize,
          questionSampleSize: validatedData.questionSampleSize,
          batchSize: validatedData.batchSize,
          schema,
        };

        const result = await runIngestion(options);

        res.json({
          schema: result.schema.toJSON(),
          tableName: result.tableName,
          dbPath: result.dbPath,
          recordCount: result.recordCount,
          statistics: result.statistics,
        });
      } catch (error) {
        next(error);
      }
    });

    // Query endpoint
    /**
     * @openapi
     * /api/query:
     *   post:
     *     summary: Query the structured database with natural language
     *     tags: [Query]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - question
     *               - dbPath
     *               - tableName
     *             properties:
     *               question:
     *                 type: string
     *                 description: Natural language question
     *               dbPath:
     *                 type: string
     *                 description: Path to database file
     *               tableName:
     *                 type: string
     *                 description: Name of the table
     *               schemaPath:
     *                 type: string
     *                 description: Optional path to schema file
     *               schema:
     *                 type: object
     *                 description: Optional schema object
     *               statistics:
     *                 type: object
     *                 description: Optional statistics object
     *     responses:
     *       200:
     *         description: Query completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 question:
     *                   type: string
     *                 sql:
     *                   type: string
     *                 results:
     *                   type: array
     *                 answer:
     *                   type: string
     *                 metadata:
     *                   type: object
     *       400:
     *         description: Invalid request
     *       500:
     *         description: Server error
     */
    this.app.post('/api/query', async (req, res, next) => {
      try {
        // Validate request
        const validatedData = QueryRequestSchema.parse(req.body);

        // Convert schema if provided
        let schema: JSONSchema | undefined;
        if (validatedData.schema) {
          schema = new JSONSchema(validatedData.schema);
        }

        // Run query
        const options: QueryOptions = {
          question: validatedData.question,
          dbPath: resolve(validatedData.dbPath),
          tableName: validatedData.tableName,
          schemaPath: validatedData.schemaPath
            ? resolve(validatedData.schemaPath)
            : undefined,
          schema,
          statistics: validatedData.statistics,
        };

        const result = await runQuery(options);

        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // Get schema endpoint
    /**
     * @openapi
     * /api/schema/{tableName}:
     *   get:
     *     summary: Get schema for a table
     *     tags: [Schema]
     *     parameters:
     *       - in: path
     *         name: tableName
     *         required: true
     *         schema:
     *           type: string
     *         description: Name of the table
     *     responses:
     *       200:
     *         description: Schema retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *       404:
     *         description: Schema not found
     *       500:
     *         description: Server error
     */
    this.app.get('/api/schema/:tableName', async (req, res, next) => {
      try {
        const { tableName } = req.params;

        // Try to find schema file
        const schemaPath = join(
          process.cwd(),
          'data',
          'schemas',
          `${tableName}.json`
        );

        if (!existsSync(schemaPath)) {
          res.status(404).json({
            error: 'Not Found',
            message: `Schema not found for table: ${tableName}`,
          });
          return;
        }

        const result = await readJSONFile(schemaPath);
        if (!result.success) {
          throw result.error;
        }
        const schema = result.data;

        res.json({
          tableName,
          schema,
          createdAt: (schema as { createdAt?: string }).createdAt || null,
        });
      } catch (error) {
        next(error);
      }
    });

    // Get statistics endpoint
    /**
     * @openapi
     * /api/stats/{tableName}:
     *   get:
     *     summary: Get statistics for a table
     *     tags: [Statistics]
     *     parameters:
     *       - in: path
     *         name: tableName
     *         required: true
     *         schema:
     *           type: string
     *         description: Name of the table
     *       - in: query
     *         name: dbPath
     *         required: true
     *         schema:
     *           type: string
     *         description: Path to database file
     *     responses:
     *       200:
     *         description: Statistics retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *       400:
     *         description: Invalid request
     *       500:
     *         description: Server error
     */
    this.app.get('/api/stats/:tableName', async (req, res, next) => {
      try {
        const { tableName } = req.params;
        const { dbPath } = req.query;

        if (!dbPath || typeof dbPath !== 'string') {
          res.status(400).json({
            error: 'Bad Request',
            message: 'dbPath query parameter is required',
          });
          return;
        }

        // Import DatabaseManager dynamically to avoid issues
        const { DatabaseManager } = await import('./database/database-manager.js');
        const db = new DatabaseManager(resolve(dbPath));

        // Get row count
        const rowCount = db.getRowCount(tableName);

        // Get statistics
        const statistics = db.getColumnStatistics(tableName);

        db.close();

        res.json({
          tableName,
          rowCount,
          statistics,
        });
      } catch (error) {
        next(error);
      }
    });

    // Evaluate endpoint
    /**
     * @openapi
     * /api/evaluate:
     *   post:
     *     summary: Evaluate system performance
     *     tags: [Evaluation]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - testCases
     *             properties:
     *               testCases:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     question:
     *                       type: string
     *                     gold_answer:
     *                       type: string
     *                     predicted_answer:
     *                       type: string
     *     responses:
     *       200:
     *         description: Evaluation completed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 answer_comparison:
     *                   type: number
     *                 answer_recall:
     *                   type: number
     *                 num_examples:
     *                   type: number
     *                 per_example_results:
     *                   type: array
     *       400:
     *         description: Invalid request
     *       500:
     *         description: Server error
     */
    this.app.post('/api/evaluate', async (req, res, next) => {
      try {
        // Validate request
        const validatedData = EvaluateRequestSchema.parse(req.body);

        // Run evaluation
        const options: EvaluationOptions = {
          testCases: validatedData.testCases,
        };

        const result = await runEvaluation(options);

        res.json(result);
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * Setup Swagger/OpenAPI documentation
   */
  private setupSwagger(): void {
    const swaggerOptions = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'S-RAG API',
          version: '1.0.0',
          description: 'REST API for S-RAG (Structured RAG for Answering Aggregative Questions)',
          contact: {
            name: 'API Support',
          },
        },
        servers: [
          {
            url: `http://localhost:${this.port}`,
            description: 'Development server',
          },
        ],
        tags: [
          {
            name: 'Ingestion',
            description: 'Document ingestion endpoints',
          },
          {
            name: 'Query',
            description: 'Query endpoints',
          },
          {
            name: 'Schema',
            description: 'Schema management endpoints',
          },
          {
            name: 'Statistics',
            description: 'Statistics endpoints',
          },
          {
            name: 'Evaluation',
            description: 'Evaluation endpoints',
          },
        ],
      },
      apis: ['./src/api.ts', './dist/api.js'],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

    // Serve swagger docs
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // Serve OpenAPI spec as JSON
    this.app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found',
      });
    });

    // Global error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      logger.error('API Error', { error: err.message, stack: err.stack });

      // Zod validation error
      if (err instanceof z.ZodError) {
        const errorResponse: ErrorResponse = {
          error: 'Validation Error',
          message: 'Request validation failed',
          details: err.errors,
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Generic error
      const errorResponse: ErrorResponse = {
        error: err.name || 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
      };

      res.status(500).json(errorResponse);
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`S-RAG API server started on port ${this.port}`);
        console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  S-RAG API Server                                        ║
║  Version: 1.0.0                                          ║
║                                                          ║
║  Server running at: http://localhost:${this.port.toString().padEnd(4)}                   ║
║  API Documentation: http://localhost:${this.port}/api-docs         ║
║  Health Check:      http://localhost:${this.port}/health           ║
║                                                          ║
║  API Endpoints:                                          ║
║    POST   /api/ingest      - Ingest documents           ║
║    POST   /api/query       - Query database             ║
║    POST   /api/evaluate    - Evaluate performance       ║
║    GET    /api/schema/:id  - Get schema                 ║
║    GET    /api/stats/:id   - Get statistics             ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
        `);
        resolve();
      });
    });
  }

  /**
   * Get Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}

/**
 * Start API server (if run directly)
 */
async function startServer(): Promise<void> {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const server = new APIServer(port);
  await server.start();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { startServer };
