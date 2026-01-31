import { z } from 'zod';

// Base Agent Schema for configuration
export const BaseAgentConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  timeout: z.number().default(30000),
});

export type BaseAgentConfig = z.infer<typeof BaseAgentConfigSchema>;

// Base Agent Error class
export class AgentError extends Error {
  constructor(
    message: string,
    public agentName: string,
  ) {
    super(`[${agentName}] ${message}`);
    this.name = 'AgentError';
  }
}

// Base Agent Validation Error
export class AgentValidationError extends AgentError {
  constructor(
    message: string,
    agentName: string,
    public validationErrors: z.ZodError,
  ) {
    super(message, agentName);
    this.name = 'AgentValidationError';
  }
}

// Abstract Base Agent Class
export abstract class BaseAgent<TConfig extends BaseAgentConfig> {
  protected config: TConfig;

  constructor(config: TConfig) {
    const baseConfig = BaseAgentConfigSchema.parse(config);
    this.config = { ...baseConfig, ...config } as TConfig;
  }

  // Abstract method that all agents must implement
  abstract execute(input: unknown): Promise<unknown>;

  // Common validation method
  protected validateInput<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    input: unknown,
  ): z.infer<TSchema> {
    try {
      return schema.parse(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AgentValidationError('Input validation failed', this.config.name, error);
      }
      throw new AgentError(
        `Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.config.name,
      );
    }
  }

  // Common logging method
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.config.name}] [${level.toUpperCase()}] ${message}`);
  }

  // Get agent info
  getAgentInfo(): { name: string; description: string; version: string } {
    return {
      name: this.config.name,
      description: this.config.description,
      version: this.config.version,
    };
  }
}
