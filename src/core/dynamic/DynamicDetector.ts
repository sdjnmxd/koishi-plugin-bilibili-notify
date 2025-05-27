import { Context, Logger } from 'koishi';
import { SubscriptionItem, UnifiedConfigManager } from '../../config/unified';
import { BilibiliFilterService } from '../../services/filter';
import { ImageService } from '../../services/image/ImageService';
import { RiskControlManager } from '../../services/riskControl/RiskControlManager';
import { Service } from '../../types/base';
import { OperationResult } from '../../types/common';
import { DynamicItem } from '../../types/subscription';
import { createLogger } from '../../utils/logger';
import { NotificationManager } from '../notification/manager';

export class DynamicDetector extends Service {
  private logger: Logger;
  private detectionTimer?: () => void;
  private isRunning = false;
  private lastDynamicIds = new Map<string, string>(); // 存储每个用户的最新动态ID
  private riskControlManager = new RiskControlManager(); // 风控管理器

  constructor(
    ctx: Context,
    private filterService: BilibiliFilterService,
    private notificationManager: NotificationManager,
    private configManager: UnifiedConfigManager,
    private imageService: ImageService,
  ) {
    super(ctx);
    this.logger = createLogger(ctx, 'DYNAMIC');
  }

  /**
   * 服务状态
   */
  get status() {
    const riskStatus = this.riskControlManager.getStatus();
    return {
      isRunning: this.isRunning,
      hasTimer: !!this.detectionTimer,
      riskControl: {
        isBlocked: riskStatus.isBlocked,
        remainingTime: riskStatus.remainingTime,
        consecutiveFailures: riskStatus.consecutiveFailures,
      },
    };
  }

  /**
   * 获取当前订阅列表
   */
  private get subscriptions(): SubscriptionItem[] {
    return this.configManager.get('subscriptions') || [];
  }

  /**
   * 获取动态检测间隔
   */
  private get dynamicInterval(): number {
    return this.configManager.get('dynamicInterval') || 2;
  }

  /**
   * 开始动态检测
   */
  async startDetection(): Promise<OperationResult<void>> {
    try {
      if (this.isRunning) {
        return { success: true, data: undefined };
      }

      this.isRunning = true;
      this.logger.info('开始动态检测服务');

      // 检查是否有动态订阅
      const dynamicSubscriptions = this.subscriptions.filter(sub => sub.dynamic);
      if (dynamicSubscriptions.length === 0) {
        this.logger.info('没有配置动态订阅');
        return { success: true, data: undefined };
      }

      // 设置定时检测 - 从配置读取间隔，默认2分钟
      const intervalMinutes = this.dynamicInterval; // 分钟

      // 延迟首次检测，避免启动时API请求过于频繁
      setTimeout(async () => {
        if (this.isRunning) {
          await this.checkForUpdates();
        }
      }, 5000); // 延迟5秒后进行首次检测

      this.detectionTimer = this.ctx.setInterval(
        () => this.checkForUpdates(),
        intervalMinutes * 60 * 1000, // 转换为毫秒：分钟 * 60 * 1000
      );

      this.logger.info(`动态检测间隔设置为 ${intervalMinutes} 分钟`);

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('启动动态检测失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 停止动态检测
   */
  async stopDetection(): Promise<OperationResult<void>> {
    try {
      if (!this.isRunning) {
        return { success: true, data: undefined };
      }

      this.isRunning = false;
      this.logger.info('停止动态检测服务');

      if (this.detectionTimer) {
        this.detectionTimer();
        this.detectionTimer = undefined;
      }

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('停止动态检测失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 检查动态更新
   */
  async checkForUpdates(): Promise<void> {
    try {
      // 检查是否被风控暂停
      if (this.riskControlManager.isCurrentlyBlocked()) {
        // 只在需要时输出日志，避免重复
        if (this.riskControlManager.shouldLogWarning()) {
          const blockInfo = this.riskControlManager.getDetailedBlockInfo();
          this.logger.warn(
            `🚫 动态检测被风控暂停 ${blockInfo.remainingMinutes} 分钟 | 类型: ${blockInfo.errorType} | 等级: ${blockInfo.blockLevel} | 失败次数: ${blockInfo.consecutiveFailures}`,
          );
        }
        return;
      }

      const dynamicSubscriptions = this.subscriptions.filter(sub => sub.dynamic);

      for (const sub of dynamicSubscriptions) {
        await this.checkUserDynamics(sub);

        // 添加延迟避免请求过于频繁
        await this.sleep(1000);
      }
    } catch (error) {
      this.logger.error('检查动态更新失败:', error);
    }
  }

  /**
   * 重置风控状态
   */
  resetRiskControl(): void {
    this.riskControlManager.reset();
    this.logger.info('风控状态已重置');
  }

  /**
   * 检查单个用户的动态
   */
  private async checkUserDynamics(sub: SubscriptionItem): Promise<void> {
    try {
      const result = await this.fetchUserDynamics(sub.uid);
      if (!result.success || !result.data) {
        // 记录失败到风控管理器，包含上下文信息
        this.riskControlManager.recordFailure(result.error || '未知错误', {
          uid: sub.uid,
          name: sub.name || '未知',
          api: 'getUserDynamics',
        });

        // 根据错误类型决定处理策略
        if (result.error?.includes('-352') || result.error?.includes('风控')) {
          // 检查是否需要激活暂停机制
          const status = this.riskControlManager.getStatus();
          if (status.isBlocked) {
            const blockInfo = this.riskControlManager.getDetailedBlockInfo();
            this.logger.warn(
              `🚫 用户 ${sub.uid} (${sub.name || '未知'}) 触发风控 | 类型: ${
                blockInfo.errorType
              } | 暂停 ${blockInfo.remainingMinutes} 分钟`,
            );
          } else {
            this.logger.warn(
              `⚠️ 用户 ${sub.uid} (${sub.name || '未知'}) 动态获取异常: ${result.error}`,
            );
          }
          return;
        } else if (result.error?.includes('-626')) {
          this.logger.error(`❌ 用户 ${sub.uid} 不存在，建议检查配置`);
          return;
        } else if (result.error?.includes('频繁')) {
          this.riskControlManager.recordFailure(result.error, {
            uid: sub.uid,
            name: sub.name || '未知',
            api: 'getUserDynamics',
          });
          this.logger.warn(`⚠️ 用户 ${sub.uid} (${sub.name || '未知'}) 请求过于频繁，跳过本次检测`);
          return;
        }

        this.logger.warn(
          `⚠️ 获取用户 ${sub.uid} (${sub.name || '未知'}) 动态失败: ${result.error}`,
        );
        return;
      }

      // 记录成功到风控管理器
      this.riskControlManager.recordSuccess();

      const dynamics = result.data;
      const lastDynamicId = this.lastDynamicIds.get(sub.uid);
      const newDynamics = this.filterNewDynamics(dynamics, lastDynamicId);

      if (newDynamics.length > 0) {
        this.logger.info(`📢 用户 ${sub.name || sub.uid} 有 ${newDynamics.length} 条新动态`);
      }

      for (const dynamic of newDynamics) {
        await this.processDynamic(dynamic, sub);
      }

      // 更新最新动态ID
      if (dynamics.length > 0) {
        this.lastDynamicIds.set(sub.uid, dynamics[0].id_str);
      }
    } catch (error) {
      this.logger.error(`❌ 检查用户 ${sub.uid} (${sub.name || '未知'}) 动态失败:`, error);
      // 记录异常到风控管理器
      this.riskControlManager.recordFailure(error instanceof Error ? error.message : '未知错误', {
        uid: sub.uid,
        name: sub.name || '未知',
        api: 'getUserDynamics',
      });
    }
  }

  /**
   * 处理单条动态
   */
  private async processDynamic(dynamic: DynamicItem, sub: SubscriptionItem): Promise<void> {
    try {
      // 检查动态过滤
      const filterResult = this.filterService.checkDynamicFilter(
        dynamic as any, // 临时类型转换
        { enable: true, keywords: [], forward: false, article: false },
      );
      if (filterResult) {
        this.logger.info(`动态被过滤: ${sub.name || sub.uid} - ${filterResult}`);
        return;
      }

      // 生成动态图片
      const imageResult = await this.imageService.generateDynamicImage(dynamic);
      if (!imageResult.success) {
        this.logger.error(`生成动态图片失败: ${imageResult.error}`);
        return;
      }

      // 发送通知到所有目标
      for (const target of sub.targets) {
        if (!target.dynamic) continue;

        const notificationResult = await this.notificationManager.sendNotification({
          type: 'dynamic',
          user: sub.name || sub.uid,
          content: this.extractDynamicContent(dynamic),
          image: imageResult.data,
          url: `https://t.bilibili.com/${dynamic.id_str}`,
          target: {
            platform: target.platform,
            channelId: target.channelId,
          },
        });

        if (notificationResult.success) {
          this.logger.info(
            `动态通知发送成功: ${sub.name || sub.uid} -> ${target.platform}:${target.channelId}`,
          );
        } else {
          this.logger.error(`动态通知发送失败: ${notificationResult.error}`);
        }
      }
    } catch (error) {
      this.logger.error('处理动态失败:', error);
    }
  }

  /**
   * 获取用户动态
   */
  private async fetchUserDynamics(uid: string): Promise<OperationResult<DynamicItem[]>> {
    try {
      // 调用B站API服务获取动态
      const apiService = this.ctx.get('bilibiliApiService');
      if (!apiService) {
        return {
          success: false,
          error: 'B站API服务未初始化',
        };
      }

      const result = await apiService.getUserDynamics(uid);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取动态失败',
      };
    }
  }

  /**
   * 过滤新动态
   */
  private filterNewDynamics(dynamics: DynamicItem[], lastDynamicId?: string): DynamicItem[] {
    if (!lastDynamicId) {
      // 如果没有记录的最新动态ID，只返回最新的一条
      return dynamics.slice(0, 1);
    }

    const lastIndex = dynamics.findIndex(d => d.id_str === lastDynamicId);
    if (lastIndex === -1) {
      // 如果找不到上次的动态，可能是太久了，只返回最新的一条
      return dynamics.slice(0, 1);
    }

    // 返回比上次记录更新的动态
    return dynamics.slice(0, lastIndex);
  }

  /**
   * 提取动态内容摘要
   */
  private extractDynamicContent(dynamic: DynamicItem): string {
    // 根据动态类型提取内容
    switch (dynamic.type) {
      case 'DYNAMIC_TYPE_WORD':
        return dynamic.modules?.module_dynamic?.desc?.text || '文字动态';
      case 'DYNAMIC_TYPE_DRAW':
        return dynamic.modules?.module_dynamic?.desc?.text || '图片动态';
      case 'DYNAMIC_TYPE_AV':
        return dynamic.modules?.module_dynamic?.major?.archive?.title || '视频动态';
      case 'DYNAMIC_TYPE_FORWARD':
        return '转发了动态';
      case 'DYNAMIC_TYPE_ARTICLE':
        return dynamic.modules?.module_dynamic?.major?.article?.title || '专栏动态';
      default:
        return '动态更新';
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
