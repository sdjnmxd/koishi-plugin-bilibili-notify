import { Context, Logger } from 'koishi';
import { Service } from '../../types/base';
import { OperationResult } from '../../types/common';
import { SubItem, SubscriptionItem, UserInfo } from '../../types/subscription';
import { createLogger } from '../../utils/logger';

export abstract class SubscriptionManager extends Service {
  protected logger: Logger;
  private subscriptions: SubItem[] = [];
  private loginDBData: any;

  constructor(ctx: Context) {
    super(ctx, {});
    this.logger = createLogger(ctx, 'SUBSCRIPTION');
  }

  /**
   * 服务状态
   */
  get status() {
    return {
      subscriptionCount: this.subscriptions.length,
      dynamicCount: this.getDynamicSubscriptions().length,
      liveCount: this.getLiveSubscriptions().length,
    };
  }

  /**
   * 初始化订阅管理器
   */
  async initialize(): Promise<OperationResult<void>> {
    try {
      // 暂时跳过数据库初始化，使用内存存储
      this.logger.info('订阅管理器初始化完成（内存模式）');
      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('初始化订阅管理器失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '初始化失败',
      };
    }
  }

  /**
   * 添加订阅
   */
  async addSubscription(subscription: SubscriptionItem): Promise<OperationResult<SubItem>> {
    try {
      // 暂时使用模拟的用户信息
      const userInfo: UserInfo = {
        uid: subscription.uid,
        name: subscription.name || `用户${subscription.uid}`,
        face: '',
        roomId: '',
      };

      const subItem = this.convertToSubItem(subscription, userInfo);

      // 检查是否已存在
      const existingIndex = this.subscriptions.findIndex(sub => sub.uid === subscription.uid);
      if (existingIndex >= 0) {
        this.subscriptions[existingIndex] = subItem;
        this.logger.info(`更新订阅: ${userInfo.name}`);
      } else {
        this.subscriptions.push(subItem);
        this.logger.info(`添加订阅: ${userInfo.name}`);
      }

      return { success: true, data: subItem };
    } catch (error) {
      this.logger.error('添加订阅失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加订阅失败',
      };
    }
  }

  /**
   * 移除订阅
   */
  async removeSubscription(uid: string): Promise<OperationResult<void>> {
    try {
      const index = this.subscriptions.findIndex(sub => sub.uid === uid);
      if (index >= 0) {
        const removed = this.subscriptions.splice(index, 1)[0];
        this.logger.info(`移除订阅: ${removed.uname}`);
        return { success: true, data: undefined };
      } else {
        return {
          success: false,
          error: '订阅不存在',
        };
      }
    } catch (error) {
      this.logger.error('移除订阅失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '移除订阅失败',
      };
    }
  }

  /**
   * 获取所有订阅
   */
  getSubscriptions(): SubItem[] {
    return [...this.subscriptions];
  }

  /**
   * 获取动态订阅
   */
  getDynamicSubscriptions(): SubItem[] {
    return this.subscriptions.filter(sub => sub.dynamic);
  }

  /**
   * 获取直播订阅
   */
  getLiveSubscriptions(): SubItem[] {
    return this.subscriptions.filter(sub => sub.live);
  }

  /**
   * 根据UID查找订阅
   */
  findSubscriptionByUid(uid: string): SubItem | undefined {
    return this.subscriptions.find(sub => sub.uid === uid);
  }

  /**
   * 转换为内部订阅项格式
   */
  private convertToSubItem(subscription: SubscriptionItem, userInfo: UserInfo): SubItem {
    // 转换目标格式
    const targets = subscription.targets.map(target => ({
      platform: target.platform,
      channelArr: [
        {
          channelId: target.channelId,
          dynamic: target.dynamic,
          live: target.live,
          liveGuardBuy: target.liveGuardBuy,
          atAll: target.atAll,
        },
      ],
    }));

    return {
      id: parseInt(subscription.uid),
      uid: subscription.uid,
      uname: userInfo.name,
      roomId: userInfo.roomId || '',
      target: targets,
      platform: '',
      live: subscription.live,
      dynamic: subscription.dynamic,
      card: subscription.card || {
        enable: false,
        cardColorStart: '',
        cardColorEnd: '',
        cardBasePlateColor: '',
        cardBasePlateBorder: '',
      },
    };
  }
}

declare module 'koishi' {
  interface Context {
    subscriptionManager: SubscriptionManager;
  }
}
