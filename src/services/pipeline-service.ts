import { AgentError } from '../agents/base-agent';
import type { BaseAgent } from '../agents/base-agent';

// Pipeline Configuration
export interface PipelineConfig {
  agents: BaseAgent<any>[];
  timeout?: number;
}

// Pipeline Execution Result
export interface PipelineResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
  agentResults: Array<{
    agentName: string;
    success: boolean;
    error?: Error;
    durationMs: number;
  }>;
  totalDurationMs: number;
}

// Pipeline Service
export class PipelineService {
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = {
      timeout: 60000, // 60 seconds default timeout
      ...config,
    };
  }

  // Execute pipeline sequentially
  async executePipeline(initialInput: unknown): Promise<PipelineResult> {
    const startTime = Date.now();
    const agentResults: PipelineResult['agentResults'] = [];
    let currentInput = initialInput;

    try {
      for (const agent of this.config.agents) {
        const agentStartTime = Date.now();

        try {
          this.log(`Executing ${agent.getAgentInfo().name}`);

          // Execute agent with timeout
          const result = await this.executeWithTimeout(
            agent,
            currentInput,
            this.config.timeout || 60000,
          );

          const agentDuration = Date.now() - agentStartTime;
          agentResults.push({
            agentName: agent.getAgentInfo().name,
            success: true,
            durationMs: agentDuration,
          });

          currentInput = result;
        } catch (error) {
          const agentDuration = Date.now() - agentStartTime;

          if (error instanceof AgentError) {
            agentResults.push({
              agentName: agent.getAgentInfo().name,
              success: false,
              error,
              durationMs: agentDuration,
            });

            this.log(`Agent ${agent.getAgentInfo().name} failed: ${error.message}`, 'error');

            return {
              success: false,
              error,
              agentResults,
              totalDurationMs: Date.now() - startTime,
            };
          }

          // Wrap non-AgentError in AgentError
          const agentError = new AgentError(
            error instanceof Error ? error.message : 'Unknown error',
            agent.getAgentInfo().name,
          );

          agentResults.push({
            agentName: agent.getAgentInfo().name,
            success: false,
            error: agentError,
            durationMs: agentDuration,
          });

          return {
            success: false,
            error: agentError,
            agentResults,
            totalDurationMs: Date.now() - startTime,
          };
        }
      }

      const totalDuration = Date.now() - startTime;

      return {
        success: true,
        data: currentInput,
        agentResults,
        totalDurationMs: totalDuration,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error : new Error('Unknown pipeline error'),
        agentResults,
        totalDurationMs: totalDuration,
      };
    }
  }

  // Execute agent with timeout
  private async executeWithTimeout(
    agent: BaseAgent<any>,
    input: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new AgentError(`Execution timed out after ${timeoutMs}ms`, agent.getAgentInfo().name),
        );
      }, timeoutMs);

      agent
        .execute(input)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // Logging utility
  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Pipeline] [${level.toUpperCase()}] ${message}`);
  }

  // Get pipeline information
  getPipelineInfo(): { agentCount: number; timeout: number } {
    return {
      agentCount: this.config.agents.length,
      timeout: this.config.timeout || 60000,
    };
  }
}
