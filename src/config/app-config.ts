import { z } from 'zod';

// Application Configuration Schema
export const AppConfigSchema = z.object({
  // Application Settings
  app: z
    .object({
      name: z.string().default('Resume Optimizer Explainability'),
      version: z.string().default('1.0.0'),
      environment: z.enum(['development', 'production', 'test']).default('development'),
      debug: z.boolean().default(false),
    })
    .default({
      name: 'Resume Optimizer Explainability',
      version: '1.0.0',
      environment: 'development',
      debug: false,
    }),

  // Pipeline Configuration
  pipeline: z
    .object({
      timeout: z.number().default(60000),
      maxRetries: z.number().default(3),
      retryDelay: z.number().default(1000),
      parallelExecution: z.boolean().default(false),
    })
    .default({
      timeout: 60000,
      maxRetries: 3,
      retryDelay: 1000,
      parallelExecution: false,
    }),

  // Agent Configuration
  agents: z
    .object({
      extractor: z
        .object({
          timeout: z.number().default(30000),
          maxTextLength: z.number().default(10000),
        })
        .default({
          timeout: 30000,
          maxTextLength: 10000,
        }),

      scorer: z
        .object({
          timeout: z.number().default(45000),
          weights: z.record(z.string(), z.number()).default({
            skills: 0.3,
            experience: 0.25,
            education: 0.15,
            keywords: 0.2,
            format: 0.1,
          }),
        })
        .default({
          timeout: 45000,
          weights: {
            skills: 0.3,
            experience: 0.25,
            education: 0.15,
            keywords: 0.2,
            format: 0.1,
          },
        }),

      explainability: z
        .object({
          timeout: z.number().default(30000),
          maxFeatures: z.number().default(20),
          methodology: z.enum(['shap', 'lime', 'hybrid']).default('hybrid'),
        })
        .default({
          timeout: 30000,
          maxFeatures: 20,
          methodology: 'hybrid',
        }),

      optimizer: z
        .object({
          timeout: z.number().default(60000),
          maxSuggestions: z.number().default(10),
          llmProvider: z.enum(['openai', 'anthropic', 'local']).default('openai'),
        })
        .default({
          timeout: 60000,
          maxSuggestions: 10,
          llmProvider: 'openai',
        }),

      validator: z
        .object({
          timeout: z.number().default(15000),
          strictMode: z.boolean().default(true),
          scoreThreshold: z.number().default(0.7),
        })
        .default({
          timeout: 15000,
          strictMode: true,
          scoreThreshold: 0.7,
        }),
    })
    .default({
      extractor: {
        timeout: 30000,
        maxTextLength: 10000,
      },
      scorer: {
        timeout: 45000,
        weights: {
          skills: 0.3,
          experience: 0.25,
          education: 0.15,
          keywords: 0.2,
          format: 0.1,
        },
      },
      explainability: {
        timeout: 30000,
        maxFeatures: 20,
        methodology: 'hybrid',
      },
      optimizer: {
        timeout: 60000,
        maxSuggestions: 10,
        llmProvider: 'openai',
      },
      validator: {
        timeout: 15000,
        strictMode: true,
        scoreThreshold: 0.7,
      },
    }),

  // Logging Configuration
  logging: z
    .object({
      level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
      format: z.enum(['json', 'text']).default('text'),
      enableConsole: z.boolean().default(true),
      enableFile: z.boolean().default(false),
      filePath: z.string().default('./logs/app.log'),
      maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
      maxFiles: z.number().default(5),
    })
    .default({
      level: 'info',
      format: 'text',
      enableConsole: true,
      enableFile: false,
      filePath: './logs/app.log',
      maxFileSize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),

  // External Service Configuration
  services: z
    .object({
      openai: z
        .object({
          apiKey: z.string().optional(),
          model: z.string().default('gpt-4'),
          maxTokens: z.number().default(2000),
          temperature: z.number().default(0.3),
        })
        .optional(),

      anthropic: z
        .object({
          apiKey: z.string().optional(),
          model: z.string().default('claude-3-opus-20240229'),
          maxTokens: z.number().default(2000),
        })
        .optional(),
    })
    .default({}),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// Configuration Manager Class
export class ConfigManager {
  private static instance: ConfigManager;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(useEnvVars = true): AppConfig {
    // Start with default configuration
    let config: Partial<AppConfig> = {};

    // Load environment-specific overrides
    // TODO: Implement file-based config loading
    try {
      // Config file loading to be implemented
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
    }

    // Override with environment variables
    if (useEnvVars) {
      config = this.overrideWithEnvVars(config);
    }

    // Validate and return configuration
    return AppConfigSchema.parse(config);
  }

  private overrideWithEnvVars(config: Partial<AppConfig>): Partial<AppConfig> {
    const envOverrides: Record<string, any> = {};

    // App configuration
    if (process.env.APP_NAME)
      envOverrides.app = { ...envOverrides.app, name: process.env.APP_NAME };
    if (process.env.APP_VERSION)
      envOverrides.app = { ...envOverrides.app, version: process.env.APP_VERSION };
    if (process.env.NODE_ENV)
      envOverrides.app = { ...envOverrides.app, environment: process.env.NODE_ENV };
    if (process.env.DEBUG)
      envOverrides.app = { ...envOverrides.app, debug: process.env.DEBUG === 'true' };

    // Pipeline configuration
    if (process.env.PIPELINE_TIMEOUT) {
      const timeout = parseInt(process.env.PIPELINE_TIMEOUT);
      if (!isNaN(timeout)) {
        envOverrides.pipeline = {
          ...envOverrides.pipeline,
          timeout,
        };
      }
    }
    if (process.env.PIPELINE_MAX_RETRIES) {
      const maxRetries = parseInt(process.env.PIPELINE_MAX_RETRIES);
      if (!isNaN(maxRetries)) {
        envOverrides.pipeline = {
          ...envOverrides.pipeline,
          maxRetries,
        };
      }
    }

    // Logging configuration
    if (process.env.LOG_LEVEL)
      envOverrides.logging = { ...envOverrides.logging, level: process.env.LOG_LEVEL };
    if (process.env.LOG_FORMAT)
      envOverrides.logging = { ...envOverrides.logging, format: process.env.LOG_FORMAT };
    if (process.env.LOG_FILE_PATH)
      envOverrides.logging = { ...envOverrides.logging, filePath: process.env.LOG_FILE_PATH };

    // External services
    if (process.env.OPENAI_API_KEY)
      envOverrides.services = {
        ...envOverrides.services,
        openai: { ...envOverrides.services?.openai, apiKey: process.env.OPENAI_API_KEY },
      };
    if (process.env.ANTHROPIC_API_KEY)
      envOverrides.services = {
        ...envOverrides.services,
        anthropic: { ...envOverrides.services?.anthropic, apiKey: process.env.ANTHROPIC_API_KEY },
      };

    // Deep merge the overrides with the existing config
    return this.deepMerge(config, envOverrides);
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public getAppConfig() {
    return this.config.app;
  }

  public getPipelineConfig() {
    return this.config.pipeline;
  }

  public getAgentsConfig() {
    return this.config.agents;
  }

  public getLoggingConfig() {
    return this.config.logging;
  }

  public getServicesConfig() {
    return this.config.services;
  }

  public updateConfig(updates: Partial<AppConfig>): void {
    this.config = AppConfigSchema.parse({ ...this.config, ...updates });
  }

  public reset(): void {
    this.config = this.loadConfig(false); // Don't use env vars when resetting
  }

  // Reset the singleton instance (useful for testing)
  public static resetInstance(): void {
    ConfigManager.instance = undefined as any;
  }
}
