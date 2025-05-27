import { Context } from 'koishi';
import { registerCommands } from './commands';
import { UnifiedConfig, UnifiedConfigManager } from './config/unified';
import { DynamicDetector } from './core/dynamic/DynamicDetector';
import { LiveListener } from './core/live/LiveListener';
import { NotificationManager } from './core/notification/manager';
import { initializeDatabase } from './database/models';
import { LoginService } from './services/auth/LoginService';
import { BilibiliApiService } from './services/bilibili/BilibiliApiService';
import { ConfigService } from './services/config/ConfigService';
import { BilibiliFilterService } from './services/filter';
import { AdvancedFilterService } from './services/filter/AdvancedFilterService';
import { ImageGeneratorService } from './services/image/ImageGeneratorService';
import { ImageService } from './services/image/ImageService';
import { DanmuListenerService } from './services/live/DanmuListenerService';
import { createLogger } from './utils/logger';

export const name = 'bilibili-notify-modern';
export const inject = ['database', 'http', 'puppeteer'];

// 导出配置类型和Schema
export { UnifiedConfig as Config, UnifiedConfigSchema } from './config/unified';

export function apply(ctx: Context, config: UnifiedConfig) {
  const logger = createLogger(ctx, 'MAIN');

  // 创建统一配置管理器
  const configManager = new UnifiedConfigManager(ctx, config);

  // 初始化数据库
  initializeDatabase(ctx);

  // 创建所有服务实例
  const loginService = new LoginService(ctx);
  const imageGeneratorService = new ImageGeneratorService(ctx);
  const advancedFilterService = new AdvancedFilterService(ctx);
  const bilibiliApiService = new BilibiliApiService(ctx, config);
  const filterService = new BilibiliFilterService(ctx);
  const imageService = new ImageService(ctx);
  const notificationManager = new NotificationManager(ctx);
  const configService = new ConfigService(ctx);
  const danmakuListenerService = new DanmuListenerService(ctx, {
    maxConnections: config.danmakuConfig?.maxConnections || 3,
    reconnectInterval: (config.danmakuConfig?.reconnectInterval || 60) * 1000, // 转换为毫秒
    heartbeatInterval: (config.danmakuConfig?.heartbeatInterval || 30) * 1000, // 转换为毫秒
    enableDanmaku: config.enableLive && config.danmakuConfig?.enable !== false,
  });

  // 将所有服务添加到上下文中
  ctx.provide('loginService', loginService);
  ctx.provide('imageGeneratorService', imageGeneratorService);
  ctx.provide('advancedFilterService', advancedFilterService);
  ctx.provide('bilibiliApiService', bilibiliApiService);
  ctx.provide('filterService', filterService);
  ctx.provide('imageService', imageService);
  ctx.provide('notificationManager', notificationManager);
  ctx.provide('configService', configService);
  ctx.provide('configManager', configManager);
  ctx.provide('danmakuListenerService', danmakuListenerService);

  // 注册命令系统
  registerCommands(ctx);

  // 等待服务注册完成后再创建核心功能实例
  ctx.on('ready', async () => {
    try {
      // 首先确保Cookie已经设置到API服务
      const registeredLoginService = ctx.get('loginService');
      const registeredApiService = ctx.get('bilibiliApiService');

      if (registeredLoginService && registeredApiService) {
        // 先获取存储的登录信息并设置到API服务
        const loginInfo = await registeredLoginService.getStoredLoginInfo();
        if (loginInfo?.bili_cookies) {
          registeredApiService.setCookies(loginInfo.bili_cookies);
          logger.success('从数据库中恢复登录态');
        }

        // 然后检查登录状态
        const status = await registeredLoginService.getLoginStatus();

        if (status.isLoggedIn) {
          const userInfo = status.userInfo;
          logger.info(`👤 已登录用户: ${userInfo?.name} (UID: ${userInfo?.uid})`);
          if (userInfo?.level) {
            logger.info(`📊 用户等级: Lv.${userInfo.level}`);
          }
        } else {
          logger.warn('未登录，部分功能可能受限');
        }
      } else {
        logger.error('登录服务或API服务未找到，无法检查登录状态');
      }

      // 创建核心功能实例，使用配置管理器
      const dynamicDetector = new DynamicDetector(
        ctx,
        filterService,
        notificationManager,
        configManager,
        imageService,
      );
      const liveListener = new LiveListener(
        ctx,
        filterService,
        notificationManager,
        configManager,
        imageService,
      );

      ctx.set('dynamicDetector', dynamicDetector);
      ctx.set('liveListener', liveListener);

      // 初始化图片生成服务
      if (config.enableImageGeneration && imageGeneratorService) {
        const initResult = await imageGeneratorService.initialize();
        if (!initResult) {
          logger.warn('图片生成服务初始化失败');
        }
      }

      // 显示订阅统计信息
      const subscriptions = config.subscriptions || [];
      const dynamicSubs = subscriptions.filter(sub => sub.dynamic);
      const liveSubs = subscriptions.filter(sub => sub.live);

      logger.info(
        `📊 运行时订阅统计: 总计 ${subscriptions.length} 个，动态 ${dynamicSubs.length} 个，直播 ${liveSubs.length} 个`,
      );

      // 如果启用了主人功能，显示主人信息
      if (config.master?.enable) {
        logger.info(`👑 主人功能已启用: ${config.master.platform}:${config.master.account}`);
        if (config.master.guildId) {
          logger.info(`   服务器/群组: ${config.master.guildId}`);
        }
      }

      // 显示推送设置信息
      if (config.pushSettings) {
        logger.info('⚙️ 推送设置:');
        logger.info(`   检测间隔: ${config.pushSettings.pushTime} 小时`);
        logger.info(`   推送图片: ${config.pushSettings.pushImgsInDynamic ? '是' : '否'}`);
        logger.info(`   推送链接: ${config.pushSettings.dynamicUrl ? '是' : '否'}`);
        logger.info(`   重启推送: ${config.pushSettings.restartPush ? '是' : '否'}`);
      }

      // 显示检测间隔设置
      logger.info('⏱️ 检测间隔设置:');
      logger.info(`   动态检测: ${config.dynamicInterval || 2} 分钟`);
      logger.info(`   直播检测: ${config.liveInterval || 30} 秒`);

      // 分阶段启动监听服务，避免API请求过于频繁
      let startupDelay = 0;

      // 启动动态监听
      if (config.enableDynamic && dynamicSubs.length > 0) {
        setTimeout(async () => {
          try {
            await dynamicDetector.startDetection();
            logger.info('动态监听已启动');
          } catch (error) {
            logger.error('动态监听启动失败:', error);
          }
        }, startupDelay);
        startupDelay += 2000; // 延迟2秒
      }

      // 启动直播监听
      if (config.enableLive && liveSubs.length > 0) {
        setTimeout(async () => {
          try {
            await liveListener.startListening();
            logger.info('直播监听已启动');

            // 显示弹幕监听状态
            const liveStatus = liveListener.status;
            if (liveStatus.danmaku?.isRunning) {
              logger.info(
                `🎯 弹幕监听: 已启用 (${liveStatus.danmakuRooms}/${liveStatus.roomCount} 个房间)`,
              );
            } else {
              logger.info('📡 弹幕监听: 未启用，使用纯轮询模式');
            }
          } catch (error) {
            logger.error('直播监听启动失败:', error);
          }
        }, startupDelay);
        startupDelay += 2000; // 再延迟2秒
      }

      // 如果没有启用任何监听服务，显示提示
      if (!config.enableDynamic && !config.enableLive) {
        logger.warn('⚠️ 未启用任何监听服务，请检查配置');
      } else if (dynamicSubs.length === 0 && liveSubs.length === 0) {
        logger.warn('⚠️ 没有配置任何订阅，请添加订阅后重启');
      }
    } catch (error) {
      logger.error('初始化失败:', error);
    }
  });

  // 监听配置变更
  configManager.onConfigChange(newConfig => {
    try {
      logger.info('🔄 检测到配置变更，正在更新服务...');

      // 重新加载User-Agent配置
      if (bilibiliApiService) {
        bilibiliApiService.reloadUserAgents();
        const uaInfo = bilibiliApiService.getCurrentUserAgentInfo();
        logger.info(`User-Agent已重新加载: ${uaInfo.index}/${uaInfo.total}`);
      }

      // 更新弹幕监听服务配置
      if (danmakuListenerService) {
        danmakuListenerService.setConfig({
          maxConnections: newConfig.danmakuConfig.maxConnections,
          reconnectInterval: newConfig.danmakuConfig.reconnectInterval * 1000,
          heartbeatInterval: newConfig.danmakuConfig.heartbeatInterval * 1000,
        });
        logger.info('弹幕监听服务配置已更新');
      }

      // 通知核心服务配置已变更（它们会自动从配置管理器获取最新配置）
      const dynamicDetector = ctx.get('dynamicDetector');
      const liveListener = ctx.get('liveListener');

      if (dynamicDetector) {
        logger.info('动态检测服务将使用新配置');
      }

      if (liveListener) {
        logger.info('直播监听服务将使用新配置');
      }

      // 验证新配置
      const validation = configManager.validateConfig();
      if (!validation.valid) {
        logger.warn('配置验证失败:', validation.errors.join(', '));
      }

      // 显示配置统计
      const stats = configManager.getStats();
      logger.info(
        `配置统计: 订阅 ${stats.totalSubscriptions} 个，推送目标 ${stats.totalTargets} 个`,
      );

      logger.success('配置更新完成');
    } catch (error) {
      logger.error('配置更新失败:', error);
    }
  });

  // 插件启动日志
  logger.info('Bilibili 现代化通知插件已启动');

  // 定期清理过期数据（如果需要的话，可以在其他地方实现）
  // ctx.setInterval(async () => {
  //   // 清理逻辑可以移到其他服务中
  // }, 24 * 60 * 60 * 1000);

  // 插件停止时清理资源
  ctx.on('dispose', async () => {
    const dynamicDetector = ctx.get('dynamicDetector');
    const liveListener = ctx.get('liveListener');

    if (dynamicDetector) await dynamicDetector.stopDetection();
    if (liveListener) await liveListener.stopListening();

    logger.info('Bilibili 现代化通知插件已停止');
  });
}
