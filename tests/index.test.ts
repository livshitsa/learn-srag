import { describe, it, expect } from 'vitest';

describe('S-RAG Project Setup', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true);
  });

  it('should have correct project name', () => {
    const projectName = 'learn-srag';
    expect(projectName).toBe('learn-srag');
  });
});
