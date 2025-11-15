/**
 * Orchestration module exports
 *
 * High-level orchestration functions for end-to-end workflows.
 */

export {
  ingestDocuments,
  answerQuestion,
  runFullPipeline,
  type IngestionOptions,
  type IngestionResult,
  type InferenceOptions,
  type InferenceResult,
} from './pipeline.js';
