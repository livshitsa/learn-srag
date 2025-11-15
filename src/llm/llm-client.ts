/**
 * LLM Client Wrapper
 *
 * Unified client for OpenAI and Anthropic LLM APIs with retry logic,
 * rate limiting, and error handling.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfig } from '../utils/config.js';
import { createLogger } from '../utils/logger.js';
import { retry, sleep } from '../utils/helpers.js';
import {
  LLMModel,
  LLMGenerateOptions,
  LLMResponse,
  LLMError,
  OpenAIModel,
  AnthropicModel,
} from '../models/types.js';

const logger = createLogger({ module: 'llm-client' });

/**
 * Rate limiter for API calls
 */
class RateLimiter {
  private lastRequestTime = 0;
  private minRequestInterval: number;

  constructor(requestsPerSecond = 2) {
    this.minRequestInterval = 1000 / requestsPerSecond;
  }

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * LLM Client for unified access to OpenAI and Anthropic APIs
 *
 * @example
 * ```typescript
 * const client = new LLMClient();
 * const response = await client.generate('What is 2+2?', {
 *   model: 'gpt-4o',
 *   temperature: 0.7,
 *   maxTokens: 1000
 * });
 * console.log(response.content);
 * ```
 */
export class LLMClient {
  private openaiClient?: OpenAI;
  private anthropicClient?: Anthropic;
  private rateLimiter: RateLimiter;
  private maxRetries: number;
  private retryDelay: number;

  /**
   * Create a new LLM client
   *
   * @param openaiApiKey - OpenAI API key (optional, falls back to config)
   * @param anthropicApiKey - Anthropic API key (optional, falls back to config)
   * @param options - Additional options
   * @param options.requestsPerSecond - Rate limit (default: 2)
   * @param options.maxRetries - Maximum retry attempts (default: 3)
   * @param options.retryDelay - Base delay for retries in ms (default: 1000)
   */
  constructor(
    openaiApiKey?: string,
    anthropicApiKey?: string,
    options: {
      requestsPerSecond?: number;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ) {
    const config = getConfig();

    // Initialize OpenAI client
    const openaiKey = openaiApiKey || config.OPENAI_API_KEY;
    if (openaiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiKey });
      logger.debug('OpenAI client initialized');
    }

    // Initialize Anthropic client
    const anthropicKey = anthropicApiKey || config.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
      logger.debug('Anthropic client initialized');
    }

    // Validate at least one client is initialized
    if (!this.openaiClient && !this.anthropicClient) {
      throw new LLMError('At least one LLM API key must be configured');
    }

    // Initialize rate limiter and retry settings
    this.rateLimiter = new RateLimiter(options.requestsPerSecond || 2);
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;

    logger.info('LLM client initialized', {
      hasOpenAI: !!this.openaiClient,
      hasAnthropic: !!this.anthropicClient,
    });
  }

  /**
   * Detect provider from model name
   */
  private detectProvider(model: LLMModel): 'openai' | 'anthropic' {
    if (model.startsWith('gpt-') || model.startsWith('o1-')) {
      return 'openai';
    } else if (model.startsWith('claude-')) {
      return 'anthropic';
    }
    throw new LLMError(`Unknown model: ${model}`);
  }

  /**
   * Generate text using the specified model
   *
   * @param prompt - Input prompt for the model
   * @param options - Generation options (model, temperature, etc.)
   * @returns LLM response with content and usage information
   *
   * @example
   * ```typescript
   * const response = await client.generate('Explain quantum computing', {
   *   model: 'gpt-4o',
   *   temperature: 0.7,
   *   maxTokens: 500
   * });
   * ```
   */
  async generate(prompt: string, options?: Partial<LLMGenerateOptions>): Promise<LLMResponse> {
    const config = getConfig();

    // Merge options with defaults
    const fullOptions: LLMGenerateOptions = {
      model: (options?.model || config.DEFAULT_LLM_MODEL) as LLMModel,
      temperature: options?.temperature ?? config.DEFAULT_LLM_TEMPERATURE,
      maxTokens: options?.maxTokens ?? config.DEFAULT_LLM_MAX_TOKENS,
      topP: options?.topP,
      frequencyPenalty: options?.frequencyPenalty,
      presencePenalty: options?.presencePenalty,
    };

    logger.debug('Generating text', {
      model: fullOptions.model,
      promptLength: prompt.length,
      temperature: fullOptions.temperature,
      maxTokens: fullOptions.maxTokens,
    });

    // Detect provider
    const provider = this.detectProvider(fullOptions.model);

    // Apply rate limiting
    await this.rateLimiter.waitIfNeeded();

    // Generate with retry logic
    try {
      const response = await retry(
        async () => {
          if (provider === 'openai') {
            return await this.generateOpenAI(prompt, fullOptions);
          } else {
            return await this.generateAnthropic(prompt, fullOptions);
          }
        },
        this.maxRetries,
        this.retryDelay
      );

      logger.info('Text generation successful', {
        model: response.model,
        contentLength: response.content.length,
        tokens: response.usage?.totalTokens,
      });

      return response;
    } catch (error) {
      logger.error('Text generation failed', error as Error, {
        model: fullOptions.model,
        promptLength: prompt.length,
      });

      if (error instanceof LLMError) {
        throw error;
      }

      throw new LLMError(
        `Failed to generate text: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate text using OpenAI API
   */
  private async generateOpenAI(
    prompt: string,
    options: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (!this.openaiClient) {
      throw new LLMError('OpenAI client not initialized');
    }

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: options.model as OpenAIModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        throw new LLMError('OpenAI API returned empty response');
      }

      return {
        content: choice.message.content,
        model: response.model,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      // Handle OpenAI-specific errors
      if (error && typeof error === 'object' && 'name' in error && error.name === 'APIError') {
        throw new LLMError(`OpenAI API error: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  /**
   * Generate text using Anthropic API
   */
  private async generateAnthropic(
    prompt: string,
    options: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (!this.anthropicClient) {
      throw new LLMError('Anthropic client not initialized');
    }

    try {
      const response = await this.anthropicClient.messages.create({
        model: options.model as AnthropicModel,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature,
        top_p: options.topP,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new LLMError('Anthropic API returned non-text response');
      }

      return {
        content: content.text,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error) {
      // Handle Anthropic-specific errors
      if (error && typeof error === 'object' && 'name' in error && error.name === 'APIError') {
        throw new LLMError(`Anthropic API error: ${(error as Error).message}`);
      }
      throw error;
    }
  }

  /**
   * Check if a specific provider is available
   */
  hasProvider(provider: 'openai' | 'anthropic'): boolean {
    return provider === 'openai' ? !!this.openaiClient : !!this.anthropicClient;
  }

  /**
   * Get list of available models
   */
  getAvailableModels(): LLMModel[] {
    const models: LLMModel[] = [];

    if (this.openaiClient) {
      models.push(
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'o1-preview',
        'o1-mini'
      );
    }

    if (this.anthropicClient) {
      models.push(
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      );
    }

    return models;
  }
}

/**
 * Create a default LLM client instance using configuration
 *
 * @returns LLM client configured from environment variables
 *
 * @example
 * ```typescript
 * const client = createLLMClient();
 * const response = await client.generate('Hello!');
 * ```
 */
export function createLLMClient(): LLMClient {
  return new LLMClient();
}
