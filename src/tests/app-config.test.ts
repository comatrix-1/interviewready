import { ConfigManager } from '../config/app-config';
import { z } from 'zod';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    ConfigManager.resetInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('default configuration', () => {
    it('should load with default values', () => {
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      expect(config).toHaveProperty('app');
      expect(config).toHaveProperty('pipeline');
      expect(config).toHaveProperty('agents');
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('services');

      // Test some default values
      expect(config.app.name).toBe('Resume Optimizer Explainability');
      expect(config.app.environment).toBe('test');
      expect(config.pipeline.timeout).toBe(60000);
      expect(config.agents.extractor.timeout).toBe(30000);
      expect(config.logging.level).toBe('info');
    });
  });

  describe('environment variable overrides', () => {
    it('should override app configuration with env vars', () => {
      process.env.APP_NAME = 'Test App';
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'true';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getAppConfig();

      expect(config.name).toBe('Test App');
      expect(config.environment).toBe('production');
      expect(config.debug).toBe(true);
    });

    it('should override pipeline configuration with env vars', () => {
      process.env.PIPELINE_TIMEOUT = '120000';
      process.env.PIPELINE_MAX_RETRIES = '5';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getPipelineConfig();

      expect(config.timeout).toBe(120000);
      expect(config.maxRetries).toBe(5);
    });

    it('should override logging configuration with env vars', () => {
      process.env.LOG_LEVEL = 'error';
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_FILE_PATH = '/tmp/test.log';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getLoggingConfig();

      expect(config.level).toBe('error');
      expect(config.format).toBe('json');
      expect(config.filePath).toBe('/tmp/test.log');
    });

    it('should override service configuration with env vars', () => {
      process.env.OPENAI_API_KEY = 'test-key-123';
      process.env.ANTHROPIC_API_KEY = 'test-key-456';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getServicesConfig();

      expect(config.openai?.apiKey).toBe('test-key-123');
      expect(config.anthropic?.apiKey).toBe('test-key-456');
    });

    it('should handle invalid environment variable values gracefully', () => {
      process.env.PIPELINE_TIMEOUT = 'invalid-number';
      process.env.DEBUG = 'not-a-boolean';

      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      // Should fall back to defaults for invalid values
      expect(config.pipeline.timeout).toBe(60000);
      expect(config.app.debug).toBe(false);
    });
  });

  describe('configuration methods', () => {
    let configManager: ConfigManager;

    beforeEach(() => {
      configManager = ConfigManager.getInstance();
    });

    it('should get full configuration', () => {
      const config = configManager.getConfig();

      expect(config).toHaveProperty('app');
      expect(config).toHaveProperty('pipeline');
      expect(config).toHaveProperty('agents');
      expect(config).toHaveProperty('logging');
      expect(config).toHaveProperty('services');
    });

    it('should get app configuration section', () => {
      const appConfig = configManager.getAppConfig();

      expect(appConfig).toHaveProperty('name');
      expect(appConfig).toHaveProperty('version');
      expect(appConfig).toHaveProperty('environment');
      expect(appConfig).toHaveProperty('debug');
    });

    it('should get pipeline configuration section', () => {
      const pipelineConfig = configManager.getPipelineConfig();

      expect(pipelineConfig).toHaveProperty('timeout');
      expect(pipelineConfig).toHaveProperty('maxRetries');
      expect(pipelineConfig).toHaveProperty('retryDelay');
      expect(pipelineConfig).toHaveProperty('parallelExecution');
    });

    it('should get agents configuration section', () => {
      const agentsConfig = configManager.getAgentsConfig();

      expect(agentsConfig).toHaveProperty('extractor');
      expect(agentsConfig).toHaveProperty('scorer');
      expect(agentsConfig).toHaveProperty('explainability');
      expect(agentsConfig).toHaveProperty('optimizer');
      expect(agentsConfig).toHaveProperty('validator');

      // Test nested structure
      expect(agentsConfig.extractor).toHaveProperty('timeout');
      expect(agentsConfig.scorer).toHaveProperty('weights');
    });

    it('should get logging configuration section', () => {
      const loggingConfig = configManager.getLoggingConfig();

      expect(loggingConfig).toHaveProperty('level');
      expect(loggingConfig).toHaveProperty('format');
      expect(loggingConfig).toHaveProperty('enableConsole');
      expect(loggingConfig).toHaveProperty('enableFile');
      expect(loggingConfig).toHaveProperty('filePath');
    });

    it('should get services configuration section', () => {
      const configManager = ConfigManager.getInstance();
      const servicesConfig = configManager.getServicesConfig();

      // Services config is optional and may be empty by default
      expect(typeof servicesConfig).toBe('object');
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const configManager = ConfigManager.getInstance();

      const initialConfig = configManager.getConfig();
      const updates = {
        app: {
          name: 'Updated App Name',
          version: '1.0.0',
          environment: 'development' as const,
          debug: false,
        },
      };

      configManager.updateConfig(updates);
      const updatedConfig = configManager.getConfig();

      expect(updatedConfig.app.name).toBe('Updated App Name');
      expect(updatedConfig.app.version).toBe(initialConfig.app.version); // Other properties unchanged
    });

    it('should validate configuration updates', () => {
      const configManager = ConfigManager.getInstance();

      const invalidUpdates = {
        app: {
          name: 123, // invalid type
          version: '1.0.0',
          environment: 'development' as const,
          debug: false,
        },
      } as any;

      expect(() => {
        configManager.updateConfig(invalidUpdates);
      }).toThrow();
    });
  });

  describe('configuration reset', () => {
    it('should reset to defaults', () => {
      process.env.APP_NAME = 'Temporary Override';

      const configManager = ConfigManager.getInstance();
      const modifiedConfig = configManager.getConfig();
      expect(modifiedConfig.app.name).toBe('Temporary Override');

      configManager.reset();
      const resetConfig = configManager.getConfig();
      expect(resetConfig.app.name).toBe('Resume Optimizer Explainability'); // Back to default
    });
  });

  describe('configuration validation', () => {
    it('should validate configuration schema', () => {
      const configManager = ConfigManager.getInstance();
      const config = configManager.getConfig();

      // Test that the configuration conforms to the schema
      expect(() => {
        z.object({
          app: z.object({
            name: z.string(),
            version: z.string(),
            environment: z.enum(['development', 'production', 'test']),
            debug: z.boolean(),
          }),
          pipeline: z.object({
            timeout: z.number(),
            maxRetries: z.number(),
            retryDelay: z.number(),
            parallelExecution: z.boolean(),
          }),
          agents: z.object({
            extractor: z.object({
              timeout: z.number(),
              maxTextLength: z.number(),
            }),
            scorer: z.object({
              timeout: z.number(),
              weights: z.record(z.string(), z.number()),
            }),
            explainability: z.object({
              timeout: z.number(),
              maxFeatures: z.number(),
              methodology: z.enum(['shap', 'lime', 'hybrid']),
            }),
            optimizer: z.object({
              timeout: z.number(),
              maxSuggestions: z.number(),
              llmProvider: z.enum(['openai', 'anthropic', 'local']),
            }),
            validator: z.object({
              timeout: z.number(),
              strictMode: z.boolean(),
              scoreThreshold: z.number(),
            }),
          }),
          logging: z.object({
            level: z.enum(['debug', 'info', 'warn', 'error']),
            format: z.enum(['json', 'text']),
            enableConsole: z.boolean(),
            enableFile: z.boolean(),
            filePath: z.string(),
            maxFileSize: z.number(),
            maxFiles: z.number(),
          }),
          services: z
            .object({
              openai: z
                .object({
                  apiKey: z.string().optional(),
                  model: z.string(),
                  maxTokens: z.number(),
                  temperature: z.number(),
                })
                .optional(),
              anthropic: z
                .object({
                  apiKey: z.string().optional(),
                  model: z.string(),
                  maxTokens: z.number(),
                })
                .optional(),
            })
            .optional(),
        }).parse(config);
      }).not.toThrow();
    });
  });
});
