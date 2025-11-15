/**
 * Tests for type definitions and error classes
 */

import { describe, it, expect } from 'vitest';
import {
  SRAGError,
  ValidationError,
  DatabaseError,
  LLMError,
  SQLError,
} from '../../src/models/types.js';

describe('Error Classes', () => {
  describe('SRAGError', () => {
    it('should create error with message and code', () => {
      const error = new SRAGError('Test error', 'TEST_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('SRAGError');
    });

    it('should accept custom status code', () => {
      const error = new SRAGError('Test error', 'TEST_ERROR', 404);
      expect(error.statusCode).toBe(404);
    });

    it('should be instance of Error', () => {
      const error = new SRAGError('Test error', 'TEST_ERROR');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should be instance of SRAGError', () => {
      const error = new ValidationError('Invalid input');
      expect(error).toBeInstanceOf(SRAGError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('DatabaseError', () => {
    it('should create database error', () => {
      const error = new DatabaseError('Database connection failed');
      expect(error.message).toBe('Database connection failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('DatabaseError');
    });

    it('should be instance of SRAGError', () => {
      const error = new DatabaseError('Database connection failed');
      expect(error).toBeInstanceOf(SRAGError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('LLMError', () => {
    it('should create LLM error', () => {
      const error = new LLMError('API request failed');
      expect(error.message).toBe('API request failed');
      expect(error.code).toBe('LLM_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('LLMError');
    });

    it('should be instance of SRAGError', () => {
      const error = new LLMError('API request failed');
      expect(error).toBeInstanceOf(SRAGError);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('SQLError', () => {
    it('should create SQL error', () => {
      const error = new SQLError('Invalid SQL query');
      expect(error.message).toBe('Invalid SQL query');
      expect(error.code).toBe('SQL_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('SQLError');
    });

    it('should be instance of SRAGError', () => {
      const error = new SQLError('Invalid SQL query');
      expect(error).toBeInstanceOf(SRAGError);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
