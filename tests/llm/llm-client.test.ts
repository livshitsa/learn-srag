/**
 * Tests for LLM Client
 *
 * Tests LLM client with mocked API calls (no real API requests).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMClient, createLLMClient } from '../../src/llm/llm-client.js';
import { LLMError } from '../../src/models/types.js';

// Mock the OpenAI module
vi.mock('openai');
vi.mock('@anthropic-ai/sdk');

// Import mocked modules
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Mock implementation
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};

const mockAnthropic = {
  messages: {
    create: vi.fn(),
  },
};

vi.mocked(OpenAI).mockImplementation(() => mockOpenAI as any);
vi.mocked(Anthropic).mockImplementation(() => mockAnthropic as any);

// Define mock error classes
class MockAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'APIError';
  }
}

(OpenAI as any).APIError = MockAPIError;
(Anthropic as any).APIError = MockAPIError;

describe('LLMClient', () => {
  const mockOpenAICreate = mockOpenAI.chat.completions.create;
  const mockAnthropicCreate = mockAnthropic.messages.create;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with OpenAI API key', () => {
      const client = new LLMClient('test-openai-key');
      expect(client.hasProvider('openai')).toBe(true);
    });

    it('should initialize with Anthropic API key', () => {
      const client = new LLMClient(undefined, 'test-anthropic-key');
      expect(client.hasProvider('anthropic')).toBe(true);
    });

    it('should initialize with both API keys', () => {
      const client = new LLMClient('test-openai-key', 'test-anthropic-key');
      expect(client.hasProvider('openai')).toBe(true);
      expect(client.hasProvider('anthropic')).toBe(true);
    });

    it('should throw error if no API keys provided', () => {
      expect(() => new LLMClient()).toThrow(LLMError);
      expect(() => new LLMClient()).toThrow('At least one LLM API key must be configured');
    });

    it('should accept custom options', () => {
      const client = new LLMClient('test-key', undefined, {
        requestsPerSecond: 5,
        maxRetries: 5,
        retryDelay: 500,
      });
      expect(client).toBeDefined();
    });
  });

  describe('generate - OpenAI', () => {
    it('should generate text using OpenAI', async () => {
      const client = new LLMClient('test-openai-key');

      // Mock successful OpenAI response
      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'This is a test response',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const response = await client.generate('Test prompt', {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response.content).toBe('This is a test response');
      expect(response.model).toBe('gpt-4o');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });

      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test prompt' }],
        temperature: 0.7,
        max_tokens: 100,
        top_p: undefined,
        frequency_penalty: undefined,
        presence_penalty: undefined,
      });
    });

    it('should use default options for OpenAI', async () => {
      const client = new LLMClient('test-openai-key');

      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response',
            },
            finish_reason: 'stop',
          },
        ],
      });

      await client.generate('Test');

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o', // Default from config
          temperature: 0.7, // Default from config
          max_tokens: 4096, // Default from config
        })
      );
    });

    it('should handle OpenAI API errors', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        maxRetries: 1,
        retryDelay: 10,
      });

      const error = new Error('API error');
      error.name = 'APIError';
      mockOpenAICreate.mockRejectedValue(error);

      await expect(
        client.generate('Test', { model: 'gpt-4o' })
      ).rejects.toThrow(LLMError);
    });

    it('should handle empty OpenAI response', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        maxRetries: 1,
        retryDelay: 10,
      });

      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [],
      });

      await expect(
        client.generate('Test', { model: 'gpt-4o' })
      ).rejects.toThrow(LLMError);
    });

    it('should support all OpenAI models', async () => {
      const client = new LLMClient('test-openai-key');

      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'];

      for (const model of models) {
        mockOpenAICreate.mockResolvedValue({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            },
          ],
        });

        const response = await client.generate('Test', { model: model as any });
        expect(response.content).toBe('Response');
      }
    });
  });

  describe('generate - Anthropic', () => {
    it('should generate text using Anthropic', async () => {
      const client = new LLMClient(undefined, 'test-anthropic-key');

      // Mock successful Anthropic response
      mockAnthropicCreate.mockResolvedValue({
        id: 'test-id',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-5-sonnet-20241022',
        content: [
          {
            type: 'text',
            text: 'This is a test response',
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      const response = await client.generate('Test prompt', {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response.content).toBe('This is a test response');
      expect(response.model).toBe('claude-3-5-sonnet-20241022');
      expect(response.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });

      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        temperature: 0.7,
        top_p: undefined,
        messages: [{ role: 'user', content: 'Test prompt' }],
      });
    });

    it('should handle Anthropic API errors', async () => {
      const client = new LLMClient(undefined, 'test-anthropic-key', {
        maxRetries: 1,
        retryDelay: 10,
      });

      const error = new Error('API error');
      error.name = 'APIError';
      mockAnthropicCreate.mockRejectedValue(error);

      await expect(
        client.generate('Test', { model: 'claude-3-opus-20240229' })
      ).rejects.toThrow(LLMError);
    });

    it('should handle non-text Anthropic response', async () => {
      const client = new LLMClient(undefined, 'test-anthropic-key', {
        maxRetries: 1,
        retryDelay: 10,
      });

      mockAnthropicCreate.mockResolvedValue({
        id: 'test-id',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [
          {
            type: 'image',
            source: {},
          } as any,
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      });

      await expect(
        client.generate('Test', { model: 'claude-3-opus-20240229' })
      ).rejects.toThrow(LLMError);
    });

    it('should support all Anthropic models', async () => {
      const client = new LLMClient(undefined, 'test-anthropic-key');

      const models = [
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];

      for (const model of models) {
        mockAnthropicCreate.mockResolvedValue({
          id: 'test-id',
          type: 'message',
          role: 'assistant',
          model,
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        });

        const response = await client.generate('Test', { model: model as any });
        expect(response.content).toBe('Response');
      }
    });
  });

  describe('provider detection', () => {
    it('should detect OpenAI provider for gpt- models', async () => {
      const client = new LLMClient('test-openai-key');

      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      });

      await client.generate('Test', { model: 'gpt-4o' });
      expect(mockOpenAICreate).toHaveBeenCalled();
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('should detect OpenAI provider for o1- models', async () => {
      const client = new LLMClient('test-openai-key');

      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'o1-preview',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      });

      await client.generate('Test', { model: 'o1-preview' });
      expect(mockOpenAICreate).toHaveBeenCalled();
      expect(mockAnthropicCreate).not.toHaveBeenCalled();
    });

    it('should detect Anthropic provider for claude- models', async () => {
      const client = new LLMClient(undefined, 'test-anthropic-key');

      mockAnthropicCreate.mockResolvedValue({
        id: 'test-id',
        type: 'message',
        role: 'assistant',
        model: 'claude-3-opus-20240229',
        content: [{ type: 'text', text: 'Response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      await client.generate('Test', { model: 'claude-3-opus-20240229' });
      expect(mockAnthropicCreate).toHaveBeenCalled();
      expect(mockOpenAICreate).not.toHaveBeenCalled();
    });

    it('should throw error for unknown model', async () => {
      const client = new LLMClient('test-openai-key');

      await expect(
        client.generate('Test', { model: 'unknown-model' as any })
      ).rejects.toThrow(LLMError);
      await expect(
        client.generate('Test', { model: 'unknown-model' as any })
      ).rejects.toThrow('Unknown model');
    });

    it('should throw error if provider not initialized', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        maxRetries: 1,
        retryDelay: 10,
      });

      await expect(
        client.generate('Test', { model: 'claude-3-opus-20240229' })
      ).rejects.toThrow(LLMError);
    });
  });

  describe('retry logic', () => {
    it('should retry on failure', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        maxRetries: 3,
        retryDelay: 10, // Short delay for testing
      });

      // Fail twice, then succeed
      mockOpenAICreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          id: 'test-id',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Success' },
              finish_reason: 'stop',
            },
          ],
        });

      const response = await client.generate('Test', { model: 'gpt-4o' });
      expect(response.content).toBe('Success');
      expect(mockOpenAICreate).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        maxRetries: 2,
        retryDelay: 10,
      });

      mockOpenAICreate.mockRejectedValue(new Error('Persistent error'));

      await expect(
        client.generate('Test', { model: 'gpt-4o' })
      ).rejects.toThrow();

      expect(mockOpenAICreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAvailableModels', () => {
    it('should return OpenAI models when OpenAI client initialized', () => {
      const client = new LLMClient('test-openai-key');
      const models = client.getAvailableModels();

      expect(models).toContain('gpt-4o');
      expect(models).toContain('gpt-4o-mini');
      expect(models).toContain('gpt-4-turbo');
      expect(models).toContain('gpt-3.5-turbo');
      expect(models).toContain('o1-preview');
      expect(models).toContain('o1-mini');
    });

    it('should return Anthropic models when Anthropic client initialized', () => {
      const client = new LLMClient(undefined, 'test-anthropic-key');
      const models = client.getAvailableModels();

      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
    });

    it('should return all models when both clients initialized', () => {
      const client = new LLMClient('test-openai-key', 'test-anthropic-key');
      const models = client.getAvailableModels();

      expect(models.length).toBeGreaterThan(6);
      expect(models).toContain('gpt-4o');
      expect(models).toContain('claude-3-opus-20240229');
    });
  });

  describe('createLLMClient', () => {
    it('should create client using config', () => {
      // This will use config from environment variables
      // which should fail if no keys are set
      expect(() => createLLMClient()).toThrow(LLMError);
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limit', async () => {
      const client = new LLMClient('test-openai-key', undefined, {
        requestsPerSecond: 10, // 100ms between requests
      });

      mockOpenAICreate.mockResolvedValue({
        id: 'test-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop',
          },
        ],
      });

      const start = Date.now();

      // Make 3 requests
      await client.generate('Test 1', { model: 'gpt-4o' });
      await client.generate('Test 2', { model: 'gpt-4o' });
      await client.generate('Test 3', { model: 'gpt-4o' });

      const elapsed = Date.now() - start;

      // Should take at least 200ms (2 intervals between 3 requests)
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });
  });

  describe('hasProvider', () => {
    it('should return true for initialized providers', () => {
      const client1 = new LLMClient('test-openai-key');
      expect(client1.hasProvider('openai')).toBe(true);
      expect(client1.hasProvider('anthropic')).toBe(false);

      const client2 = new LLMClient(undefined, 'test-anthropic-key');
      expect(client2.hasProvider('openai')).toBe(false);
      expect(client2.hasProvider('anthropic')).toBe(true);

      const client3 = new LLMClient('test-openai-key', 'test-anthropic-key');
      expect(client3.hasProvider('openai')).toBe(true);
      expect(client3.hasProvider('anthropic')).toBe(true);
    });
  });
});
