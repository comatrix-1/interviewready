import { PipelineService } from '../services/pipeline-service';
import { BaseAgent } from '../agents/base-agent';

describe('PipelineService', () => {
  // Mock agent for testing
  class MockAgent extends BaseAgent<any> {
    private returnValue: unknown;
    private shouldFail: boolean;

    constructor(name: string, returnValue: unknown = { result: 'success' }, shouldFail = false) {
      super({
        name,
        description: 'Mock agent for testing',
        version: '1.0.0',
        timeout: 30000,
      });
      this.returnValue = returnValue;
      this.shouldFail = shouldFail;
    }

    async execute(_input: unknown): Promise<unknown> {
      if (this.shouldFail) {
        throw new Error('Mock agent failure');
      }
      return this.returnValue;
    }
  }

  describe('pipeline execution', () => {
    it('should execute pipeline with single agent successfully', async () => {
      const mockAgent = new MockAgent('TestAgent');
      const pipeline = new PipelineService({ agents: [mockAgent] });

      const result = await pipeline.executePipeline({ input: 'test' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(result.agentResults.length).toBe(1);
      expect(result.agentResults[0].success).toBe(true);
      expect(result.agentResults[0].agentName).toBe('TestAgent');
    });

    it('should execute pipeline with multiple agents sequentially', async () => {
      const agent1 = new MockAgent('Agent1', { step: 1 });
      const agent2 = new MockAgent('Agent2', { step: 2 });
      const agent3 = new MockAgent('Agent3', { step: 3 });

      const pipeline = new PipelineService({ agents: [agent1, agent2, agent3] });

      const result = await pipeline.executePipeline({ initial: 'data' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ step: 3 }); // Final agent's output
      expect(result.agentResults.length).toBe(3);
      expect(result.agentResults.every((r) => r.success)).toBe(true);
    });

    it('should handle agent failure and stop pipeline', async () => {
      const agent1 = new MockAgent('Agent1', { step: 1 });
      const agent2 = new MockAgent('Agent2', { step: 2 }, true); // This will fail
      const agent3 = new MockAgent('Agent3', { step: 3 }); // Should not execute

      const pipeline = new PipelineService({ agents: [agent1, agent2, agent3] });

      const result = await pipeline.executePipeline({ initial: 'data' });

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.agentResults.length).toBe(2); // Only first two agents executed
      expect(result.agentResults[0].success).toBe(true);
      expect(result.agentResults[1].success).toBe(false);
    });

    it('should handle timeout', async () => {
      // Mock agent that never resolves
      class SlowAgent extends BaseAgent<any> {
        constructor(name: string) {
          super({
            name,
            description: 'Slow mock agent',
            version: '1.0.0',
            timeout: 30000,
          });
        }

        async execute(): Promise<unknown> {
          // Never resolves
          return new Promise(() => {});
        }
      }

      const slowAgent = new SlowAgent('SlowAgent');
      const pipeline = new PipelineService({
        agents: [slowAgent],
        timeout: 100, // Very short timeout
      });

      const startTime = Date.now();
      const result = await pipeline.executePipeline({ test: 'data' });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toContain('timed out');
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThan(200); // Should timeout quickly
    });
  });

  describe('pipeline information', () => {
    it('should return correct pipeline info', () => {
      const agent1 = new MockAgent('Agent1');
      const agent2 = new MockAgent('Agent2');

      const pipeline = new PipelineService({
        agents: [agent1, agent2],
        timeout: 120000,
      });

      const info = pipeline.getPipelineInfo();

      expect(info.agentCount).toBe(2);
      expect(info.timeout).toBe(120000);
    });

    it('should use default timeout when not specified', () => {
      const agent = new MockAgent('TestAgent');
      const pipeline = new PipelineService({ agents: [agent] });

      const info = pipeline.getPipelineInfo();

      expect(info.timeout).toBe(60000); // Default timeout
    });
  });
});
