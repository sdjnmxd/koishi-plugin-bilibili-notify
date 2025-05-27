import { Context, Logger } from 'koishi';
import { PLUGIN_NAME } from '../constants';

// Logger 名称常量
export const LOGGER_NAMES = {
  MAIN: PLUGIN_NAME,
  API: `${PLUGIN_NAME}:api`,
  AUTH: `${PLUGIN_NAME}:auth`,
  IMAGE: `${PLUGIN_NAME}:image`,
  IMAGE_GENERATOR: `${PLUGIN_NAME}:image-generator`,
  SUBSCRIPTION: `${PLUGIN_NAME}:subscription`,
  FILTER: `${PLUGIN_NAME}:filter`,
  DYNAMIC: `${PLUGIN_NAME}:dynamic`,
  LIVE: `${PLUGIN_NAME}:live`,
  DANMU: `${PLUGIN_NAME}:danmu`,
  NOTIFICATION: `${PLUGIN_NAME}:notification`,
  CONFIG: `${PLUGIN_NAME}:config`,
  DATABASE: `${PLUGIN_NAME}:database`,
  COMMAND: `${PLUGIN_NAME}:command`,
  WBI: `${PLUGIN_NAME}:wbi`,
  HTTP: `${PLUGIN_NAME}:http`,
} as const;

type ModuleName = keyof typeof LOGGER_NAMES;

export interface EnhancedLogger extends Logger {
  success(message: string, ...args: any[]): void;

  fail(message: string, ...args: any[]): void;
}

export function createLogger(ctx: Context, module: ModuleName): EnhancedLogger {
  const baseLogger = ctx.logger(LOGGER_NAMES[module]);

  const enhancedLogger = Object.create(baseLogger) as EnhancedLogger;

  enhancedLogger.success = (message: string, ...args: any[]) => {
    baseLogger.info(`✅ ${message}`, ...args);
  };

  enhancedLogger.fail = (message: string, ...args: any[]) => {
    baseLogger.error(`❌ ${message}`, ...args);
  };

  enhancedLogger.warn = (message: string, ...args: any[]) => {
    baseLogger.warn(`⚠️ ${message}`, ...args);
  };

  enhancedLogger.info = (message: string, ...args: any[]) => {
    baseLogger.info(`${message}`, ...args);
  };

  return enhancedLogger;
}
