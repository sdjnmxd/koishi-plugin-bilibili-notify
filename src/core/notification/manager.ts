import { Bot, Context, h, Logger } from 'koishi';
import { SubscriptionTarget } from '../../config/unified';
import { Service } from '../../types/base';
import { PushType, Target } from '../../types/common';
import { withRetry } from '../../utils';
import { createLogger } from '../../utils/logger';

export interface NotificationData {
  type: string;
  subType?: string;
  user: string;
  content: string;
  image?: Buffer;
  url?: string;
  target?: {
    platform: string;
    channelId: string;
  };
}

export class NotificationManager extends Service {
  private logger: Logger;

  constructor(ctx: Context) {
    super(ctx);
    this.logger = createLogger(ctx, 'NOTIFICATION');
  }

  /**
   * 向目标推送消息
   */
  async broadcastToTargets(
    targets: Target,
    content: any,
    type?: PushType,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info(`开始推送消息，推送类型：${type}，目标数量：${targets.length}`);
      this.logger.info(`推送内容：${typeof content === 'string' ? content : '非文本内容'}`);

      // 如果有多个目标或多个频道，使用广播
      if (targets.length !== 1 || targets[0].channelArr.length !== 1) {
        await this.broadcastToMultipleTargets(targets, content, type);
        return { success: true };
      }

      // 单个目标的情况
      await this.sendToSingleTarget(targets[0], content, type);
      return { success: true };
    } catch (error) {
      this.logger.error('推送消息失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 向配置格式的目标推送消息
   */
  async broadcastToConfigTargets(
    targets: SubscriptionTarget[],
    content: any,
    type: 'dynamic' | 'live',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info(`开始推送消息到配置目标，推送类型：${type}，目标数量：${targets.length}`);

      for (const target of targets) {
        // 检查是否应该推送到这个目标
        const shouldPush =
          (type === 'dynamic' && target.dynamic) || (type === 'live' && target.live);

        if (!shouldPush) continue;

        const bot = this.getBot(target.platform);
        if (!bot) {
          this.logger.error(`找不到平台 ${target.platform} 的机器人实例`);
          continue;
        }

        await this.sendMessageWithRetry(bot, target.channelId, content);

        // 如果是直播开始且需要@全体
        if (type === 'live' && target.atAll) {
          await this.sendMessageWithRetry(bot, target.channelId, '<at type="all" />');
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error('推送消息到配置目标失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送通知（新接口）
   */
  async sendNotification(data: NotificationData): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.info(`发送通知: ${data.type} - ${data.user}`);

      if (data.target) {
        // 发送到指定目标
        const bot = this.getBot(data.target.platform);
        if (!bot) {
          return { success: false, error: `找不到平台 ${data.target.platform} 的机器人实例` };
        }

        // 构建消息内容
        let content: any = data.content;

        // 如果有图片，先发送图片
        if (data.image) {
          content = [h.image(data.image, 'image/png')];

          // 如果有文本内容，添加到消息中
          if (data.content) {
            content.push(data.content);
          }

          // 如果有链接，添加到消息中
          if (data.url) {
            content.push(data.url);
          }
        } else {
          // 没有图片时，组合文本和链接
          const parts = [];
          if (data.content) {
            parts.push(data.content);
          }
          if (data.url) {
            parts.push(data.url);
          }
          content = parts.join('\n');
        }

        await this.sendMessageWithRetry(bot, data.target.channelId, content);
        this.logger.info(
          `通知发送成功: ${data.user} -> ${data.target.platform}:${data.target.channelId}`,
        );
      } else {
        // 暂时使用日志记录
        this.logger.info(`通知内容: ${data.content}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('发送通知失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 通知主人
   */
  async notifyMaster(message: string): Promise<void> {
    try {
      // 这里需要从配置中获取主人信息
      // 暂时记录日志，让主服务处理
      this.logger.warn(`需要通知主人: ${message}`);
    } catch (error) {
      this.logger.error(`通知主人失败: ${error.message}`);
    }
  }

  /**
   * 广播到多个目标
   */
  private async broadcastToMultipleTargets(
    targets: Target,
    content: any,
    type?: PushType,
  ): Promise<void> {
    const pushChannels = this.getTargetChannels(targets, type);

    this.logger.info(
      `推送消息到 ${pushChannels.length} 个目标频道，目标频道为：${pushChannels.join(', ')}`,
    );

    await withRetry(async () => {
      await this.ctx.broadcast(pushChannels, content);
    }, 1);
  }

  /**
   * 发送到单个目标
   */
  private async sendToSingleTarget(
    target: Target[0],
    content: any,
    type?: PushType,
  ): Promise<void> {
    const targetChannel = target.channelArr[0];
    const bot = this.getBot(target.platform);

    if (!bot) {
      this.logger.error(`找不到平台 ${target.platform} 的机器人实例`);
      return;
    }

    if (!type) {
      await this.sendMessageWithRetry(bot, targetChannel.channelId, content);
      return;
    }

    switch (type) {
      case PushType.Live:
        if (targetChannel.live) {
          await this.sendMessageWithRetry(bot, targetChannel.channelId, content);
        }
        break;

      case PushType.Dynamic:
        if (targetChannel.dynamic) {
          await this.sendMessageWithRetry(bot, targetChannel.channelId, content);
        }
        break;

      case PushType.LiveStart:
        if (targetChannel.live) {
          await this.sendMessageWithRetry(bot, targetChannel.channelId, content);
        }
        if (targetChannel.atAll) {
          await this.sendMessageWithRetry(bot, targetChannel.channelId, '<at type="all" />');
        }
        break;

      case PushType.LiveGuardBuy:
        if (targetChannel.liveGuardBuy) {
          await this.sendMessageWithRetry(bot, targetChannel.channelId, content);
        }
        break;
    }
  }

  /**
   * 获取符合条件的目标频道
   */
  private getTargetChannels(targets: Target, type?: PushType): string[] {
    const channels: string[] = [];

    for (const target of targets) {
      for (const channel of target.channelArr) {
        const shouldPush = this.shouldPushToChannel(channel, type);
        if (shouldPush) {
          channels.push(`${target.platform}:${channel.channelId}`);
        }
      }
    }

    return channels;
  }

  /**
   * 判断是否应该向频道推送
   */
  private shouldPushToChannel(channel: any, type?: PushType): boolean {
    if (!type) return true;

    switch (type) {
      case PushType.Live:
      case PushType.LiveStart:
        return channel.live;
      case PushType.Dynamic:
        return channel.dynamic;
      case PushType.LiveGuardBuy:
        return channel.liveGuardBuy;
      default:
        return false;
    }
  }

  /**
   * 获取机器人实例
   */
  private getBot(platform: string): Bot<Context> | undefined {
    return this.ctx.bots.find(bot => bot.platform === platform);
  }

  /**
   * 带重试的消息发送
   */
  private async sendMessageWithRetry(
    bot: Bot<Context>,
    channelId: string,
    content: any,
  ): Promise<void> {
    try {
      await withRetry(async () => {
        await bot.sendMessage(channelId, content);
      }, 1);
    } catch (error) {
      if (error.message === 'this._request is not a function') {
        // 2秒后重试
        this.ctx.setTimeout(async () => {
          await this.sendMessageWithRetry(bot, channelId, content);
        }, 2000);
        return;
      }

      this.logger.error(`发送群组ID:${channelId}消息失败！原因: ${error.message}`);

      // 通知主人
      await this.notifyMaster(`发送群组ID:${channelId}消息失败，请查看日志`);

      // 重新抛出错误，让上层调用者知道发送失败
      throw error;
    }
  }
}

declare module 'koishi' {
  interface Context {
    notificationManager: NotificationManager;
  }
}
