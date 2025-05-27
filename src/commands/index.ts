import { Context } from 'koishi';
import { createLogger } from '../utils/logger';
import { registerAuthCommands } from './auth';
import { registerServiceCommands } from './service';

export function registerCommands(ctx: Context) {
  const logger = createLogger(ctx, 'COMMAND');

  // 主命令组
  const bili = ctx.command('bili', 'Bilibili通知插件');

  // 注册各模块命令
  try {
    registerAuthCommands(ctx, bili);
    registerServiceCommands(ctx, bili);

    logger.success('所有命令注册完成');
  } catch (error) {
    logger.fail('命令注册失败:', error);
  }
}

// 导出命令注册函数
export { registerAuthCommands } from './auth';
export { registerServiceCommands } from './service';
export * from './types';
