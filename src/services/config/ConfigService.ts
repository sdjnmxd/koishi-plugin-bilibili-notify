import { Context, Logger } from 'koishi';
import { Service } from '../../types/base';
import { SubscriptionItem } from '../../config/unified';
import { createLogger } from '../../utils/logger';

export class ConfigService extends Service {
  private logger: Logger;

  constructor(ctx: Context) {
    super(ctx, {});
    this.logger = createLogger(ctx, 'CONFIG');
  }

  /**
   * 验证订阅配置
   */
  validateSubscription(subscription: SubscriptionItem): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查UID
    if (!subscription.uid) {
      errors.push('缺少用户UID');
    } else if (!/^\d+$/.test(subscription.uid)) {
      errors.push('用户UID格式不正确，应为纯数字');
    }

    // 检查订阅类型
    if (!subscription.dynamic && !subscription.live) {
      errors.push('至少需要订阅动态或直播中的一种');
    }

    // 检查推送目标
    if (!subscription.targets || subscription.targets.length === 0) {
      errors.push('至少需要配置一个推送目标');
    } else {
      subscription.targets.forEach((target, index) => {
        if (!target.platform) {
          errors.push(`推送目标 ${index + 1}: 缺少平台信息`);
        }
        if (!target.channelId) {
          errors.push(`推送目标 ${index + 1}: 缺少频道ID`);
        }
        if (!target.dynamic && !target.live) {
          errors.push(`推送目标 ${index + 1}: 至少需要启用动态或直播推送`);
        }
      });
    }

    // 检查卡片配置
    if (subscription.card?.enable) {
      if (!subscription.card.cardColorStart) {
        errors.push('启用自定义卡片时需要设置起始颜色');
      }
      if (!subscription.card.cardColorEnd) {
        errors.push('启用自定义卡片时需要设置结束颜色');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 批量验证订阅配置
   */
  validateSubscriptions(subscriptions: SubscriptionItem[]): {
    valid: boolean;
    validCount: number;
    invalidCount: number;
    errors: Array<{ index: number; uid: string; errors: string[] }>;
  } {
    const errors: Array<{ index: number; uid: string; errors: string[] }> = [];
    let validCount = 0;
    let invalidCount = 0;

    subscriptions.forEach((subscription, index) => {
      const validation = this.validateSubscription(subscription);
      if (validation.valid) {
        validCount++;
      } else {
        invalidCount++;
        errors.push({
          index: index + 1,
          uid: subscription.uid || '未知',
          errors: validation.errors,
        });
      }
    });

    return {
      valid: invalidCount === 0,
      validCount,
      invalidCount,
      errors,
    };
  }

  /**
   * 获取配置统计信息
   */
  getConfigStats(subscriptions: SubscriptionItem[]): {
    totalSubscriptions: number;
    dynamicSubscriptions: number;
    liveSubscriptions: number;
    totalTargets: number;
    platformStats: Record<string, number>;
  } {
    const stats = {
      totalSubscriptions: subscriptions.length,
      dynamicSubscriptions: 0,
      liveSubscriptions: 0,
      totalTargets: 0,
      platformStats: {} as Record<string, number>,
    };

    subscriptions.forEach(subscription => {
      if (subscription.dynamic) stats.dynamicSubscriptions++;
      if (subscription.live) stats.liveSubscriptions++;

      subscription.targets?.forEach(target => {
        stats.totalTargets++;
        stats.platformStats[target.platform] = (stats.platformStats[target.platform] || 0) + 1;
      });
    });

    return stats;
  }
}
