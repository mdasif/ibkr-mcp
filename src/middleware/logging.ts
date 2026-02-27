/**
 * Structured logging with correlation/request IDs.
 * JSON format for machine parsing.
 */
import { getConfig, type LogLevel } from '../config';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: number;

  constructor() {
    this.level = LOG_LEVELS[getConfig().logLevel];
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    const out = level === 'error' ? process.stderr : process.stderr; // all logs to stderr so stdout is clean for MCP
    out.write(JSON.stringify(entry) + '\n');
  }

  debug(msg: string, ctx?: Record<string, unknown>): void { this.write('debug', msg, ctx); }
  info(msg: string, ctx?: Record<string, unknown>): void { this.write('info', msg, ctx); }
  warn(msg: string, ctx?: Record<string, unknown>): void { this.write('warn', msg, ctx); }
  error(msg: string, ctx?: Record<string, unknown>): void { this.write('error', msg, ctx); }

  child(baseCtx: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, baseCtx);
  }

  updateLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }
}

class ChildLogger {
  constructor(private parent: Logger, private baseCtx: Record<string, unknown>) {}
  debug(msg: string, ctx?: Record<string, unknown>): void { this.parent.debug(msg, { ...this.baseCtx, ...ctx }); }
  info(msg: string, ctx?: Record<string, unknown>): void { this.parent.info(msg, { ...this.baseCtx, ...ctx }); }
  warn(msg: string, ctx?: Record<string, unknown>): void { this.parent.warn(msg, { ...this.baseCtx, ...ctx }); }
  error(msg: string, ctx?: Record<string, unknown>): void { this.parent.error(msg, { ...this.baseCtx, ...ctx }); }
}

export const logger = new Logger();
export type { Logger, ChildLogger };
