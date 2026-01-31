import { BaseAgent, BaseAgentConfigSchema } from '../agents/base-agent';
import { z } from 'zod';

describe('BaseAgent', () => {
  // Test configuration schema
  const TestAgentConfigSchema = BaseAgentConfigSchema.extend({
    testParam: z.string().default('test'),
  });

  type TestAgentConfig = z.infer<typeof TestAgentConfigSchema>;

  // Test agent implementation
  class TestAgent extends BaseAgent<TestAgentConfig> {
    constructor(config: Partial<TestAgentConfig> = {}) {
      const defaultConfig = {
        name: 'TestAgent',
        description: 'Test agent for unit testing',
        version: '1.0.0',
        timeout: 30000,
        testParam: 'test',
        ...config,
      };
      super(TestAgentConfigSchema.parse(defaultConfig));
    }

    async execute(): Promise<unknown> {
      return { result: 'test' };
    }

    // Expose protected method for testing
    public testValidateInput<TSchema extends z.ZodTypeAny>(
      schema: TSchema,
      input: unknown,
    ): z.infer<TSchema> {
      return this.validateInput(schema, input);
    }
  }

  describe('configuration', () => {
    it('should validate configuration with default values', () => {
      const config = {
        name: 'TestAgent',
        description: 'Test agent for unit testing',
        version: '1.0.0',
      };

      const result = BaseAgentConfigSchema.parse(config);

      expect(result).toEqual({
        name: 'TestAgent',
        description: 'Test agent for unit testing',
        version: '1.0.0',
        timeout: 30000, // default value
      });
    });

    it('should throw error for invalid configuration', () => {
      const invalidConfig = {
        name: 123, // invalid - wrong type
        description: 'Test agent',
        version: '1.0.0',
      };

      expect(() => {
        BaseAgentConfigSchema.parse(invalidConfig);
      }).toThrow();
    });
  });

  describe('agent instantiation', () => {
    it('should create agent with default configuration', () => {
      const agent = new TestAgent();

      expect(agent.getAgentInfo()).toEqual({
        name: 'TestAgent',
        description: 'Test agent for unit testing',
        version: '1.0.0',
      });
    });

    it('should create agent with custom configuration', () => {
      const customConfig = {
        name: 'CustomTestAgent',
        description: 'Custom test agent',
        version: '2.0.0',
        timeout: 60000,
        testParam: 'custom',
      };

      const agent = new TestAgent(customConfig);
      const info = agent.getAgentInfo();

      expect(info.name).toBe('CustomTestAgent');
      expect(info.description).toBe('Custom test agent');
      expect(info.version).toBe('2.0.0');
    });
  });

  describe('validation', () => {
    it('should validate input successfully', () => {
      const agent = new TestAgent();
      const testSchema = z.object({ value: z.string() });
      const testInput = { value: 'test' };

      const result = agent.testValidateInput(testSchema, testInput);

      expect(result).toEqual(testInput);
    });

    it('should throw validation error for invalid input', () => {
      const agent = new TestAgent();
      const testSchema = z.object({ value: z.string() });
      const invalidInput = { value: 123 }; // wrong type

      expect(() => {
        agent.testValidateInput(testSchema, invalidInput);
      }).toThrow('Input validation failed');
    });
  });
});
