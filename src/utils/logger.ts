import { z } from 'zod';

// Logger Configuration Schema
export const LoggerConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['json', 'text']).default('text'),
  enableConsole: z.boolean().default(true),
  enableFile: z.boolean().default(false),
  filePath: z.string().optional(),
  maxFileSize: z.number().default(10 * 1024 * 1024), // 10MB
  maxFiles: z.number().default(5),
});

export type LoggerConfig = z.infer<typeof LoggerConfigSchema>;

// Log Entry Schema
export const LogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  agent: z.string(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

// Logger Class
export class Logger {
  private config: LoggerConfig;
  private agentName: string;

  constructor(agentName: string, config: Partial<LoggerConfig> = {}) {
    this.agentName = agentName;
    this.config = LoggerConfigSchema.parse(config);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata, error);
  }

  private log(
    level: LogEntry['level'],
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error,
  ): void {
    // Skip if level is below configured threshold
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      agent: this.agentName,
      message,
      metadata,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };

    // Validate log entry
    LogEntrySchema.parse(logEntry);

    // Output based on configuration
    if (this.config.enableConsole) {
      this.outputToConsole(logEntry);
    }

    if (this.config.enableFile && this.config.filePath) {
      this.outputToFile(logEntry);
    }
  }

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= configLevelIndex;
  }

  private outputToConsole(logEntry: LogEntry): void {
    if (this.config.format === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      const timestamp = logEntry.timestamp;
      const level = logEntry.level.toUpperCase().padEnd(5);
      const agent = logEntry.agent.padEnd(15);
      const message = logEntry.message;

      console.log(`[${timestamp}] [${level}] [${agent}] ${message}`);

      if (logEntry.metadata) {
        console.log('  Metadata:', JSON.stringify(logEntry.metadata, null, 2));
      }

      if (logEntry.error) {
        console.log(`  Error: ${logEntry.error.name}: ${logEntry.error.message}`);
        if (logEntry.error.stack) {
          console.log(`  Stack: ${logEntry.error.stack}`);
        }
      }
    }
  }

  private outputToFile(logEntry: LogEntry): void {
    // TODO: Implement file logging with rotation
    // This would require fs module and file management
    // For now, we'll just log to console
    this.outputToConsole(logEntry);
  }

  // Create child logger with additional context
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.agentName, this.config);
    // TODO: Implement child logger with context inheritance
    void context; // Suppress unused variable warning
    return childLogger;
  }

  // Get logger configuration
  getConfig(): LoggerConfig {
    return { ...this.config };
  }
}
