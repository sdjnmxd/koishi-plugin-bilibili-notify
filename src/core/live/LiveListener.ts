import { Context, Logger } from 'koishi';
import { SubscriptionItem, UnifiedConfigManager } from '../../config/unified';
import { BilibiliFilterService } from '../../services/filter';
import { ImageService } from '../../services/image/ImageService';
import { DanmuListenerService } from '../../services/live/DanmuListenerService';
import { RiskControlManager } from '../../services/riskControl/RiskControlManager';
import { Service } from '../../types/base';
import { OperationResult } from '../../types/common';
import { LiveStatus } from '../../types/subscription';
import { createLogger } from '../../utils/logger';
import {
  formatLiveEndMessage,
  formatLiveMessage,
  formatLiveStartMessage,
} from '../../utils/messageFormatter';
import { NotificationManager } from '../notification/manager';

interface LiveRoom {
  roomId: string;
  uid: string;
  uname: string;
  title: string;
  isLive: boolean;
  liveTime?: number;
  pushTimer?: () => void;
  isBlocked?: boolean;
  onlineCount?: string;
  useDanmaku?: boolean; // 是否使用弹幕监听
}

export class LiveListener extends Service {
  private logger: Logger;
  private liveRooms = new Map<string, LiveRoom>();
  private checkTimer?: () => void;
  private isRunning = false;
  private riskControlManager = new RiskControlManager(); // 风控管理器
  private danmakuService?: DanmuListenerService;

  constructor(
    ctx: Context,
    private filterService: BilibiliFilterService,
    private notificationManager: NotificationManager,
    private configManager: UnifiedConfigManager,
    private imageService: ImageService,
  ) {
    super(ctx);
    this.logger = createLogger(ctx, 'LIVE');
  }

  /**
   * 服务状态
   */
  get status() {
    const riskStatus = this.riskControlManager.getStatus();
    const danmakuStatus = this.danmakuService?.status;
    const rooms = Array.from(this.liveRooms.values());
    const danmakuRooms = rooms.filter(room => room.useDanmaku).length;

    return {
      isRunning: this.isRunning,
      roomCount: this.liveRooms.size,
      danmakuRooms: danmakuRooms,
      pollingRooms: this.liveRooms.size - danmakuRooms,
      hasTimer: !!this.checkTimer,
      danmaku: danmakuStatus,
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
   * 获取直播检测间隔
   */
  private get liveInterval(): number {
    return this.configManager.get('liveInterval') || 30;
  }

  /**
   * 获取推送间隔
   */
  private get pushTime(): number {
    return this.configManager.get('pushSettings')?.pushTime || 1;
  }

  /**
   * 获取自定义消息配置
   */
  private get customMessages() {
    return (
      this.configManager.get('customMessages') || {
        liveStart: '',
        live: '',
        liveEnd: '',
      }
    );
  }

  /**
   * 开始直播监听
   */
  async startListening(): Promise<OperationResult<void>> {
    try {
      if (this.isRunning) {
        return { success: true, data: undefined };
      }

      this.isRunning = true;
      this.logger.info('开始直播监听服务');

      // 初始化弹幕监听服务
      this.danmakuService = this.ctx.get('danmakuListenerService');
      if (!this.danmakuService) {
        this.logger.warn('弹幕监听服务未找到，将使用纯轮询模式');
      } else {
        const startResult = await this.danmakuService.start();
        if (startResult) {
          this.logger.info('弹幕监听服务已启动，将使用混合监听模式');
        } else {
          this.logger.warn('弹幕监听服务启动失败，将使用纯轮询模式');
          this.danmakuService = undefined;
        }
      }

      // 初始化直播间
      await this.initializeLiveRooms();

      // 立即检查一次直播状态
      await this.checkAllLiveStatus();

      // 设置定时检查 - 如果有弹幕监听，可以降低轮询频率
      const baseInterval = this.liveInterval; // 秒
      const intervalSeconds = this.danmakuService ? Math.max(baseInterval * 2, 60) : baseInterval; // 有弹幕监听时降低轮询频率

      this.checkTimer = this.ctx.setInterval(
        () => this.checkAllLiveStatus(),
        intervalSeconds * 1000, // 转换为毫秒
      );

      this.logger.info(
        `直播检测间隔设置为 ${intervalSeconds} 秒 (${
          this.danmakuService ? '混合模式' : '纯轮询模式'
        })`,
      );

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('启动直播监听失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 停止直播监听
   */
  async stopListening(): Promise<OperationResult<void>> {
    try {
      if (!this.isRunning) {
        return { success: true, data: undefined };
      }

      this.isRunning = false;
      this.logger.info('停止直播监听服务');

      // 停止弹幕监听服务
      if (this.danmakuService) {
        await this.danmakuService.stop();
      }

      // 清理所有定时器
      if (this.checkTimer) {
        this.checkTimer();
        this.checkTimer = undefined;
      }

      // 清理推送定时器
      const rooms = Array.from(this.liveRooms.values());
      for (const room of rooms) {
        if (room.pushTimer) {
          room.pushTimer();
          room.pushTimer = undefined;
        }
      }

      this.liveRooms.clear();

      return { success: true, data: undefined };
    } catch (error) {
      this.logger.error('停止直播监听失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取直播间状态
   */
  getLiveRoomStatus(roomId: string): LiveRoom | undefined {
    return this.liveRooms.get(roomId);
  }

  /**
   * 获取所有直播间状态
   */
  getAllLiveRoomStatus(): LiveRoom[] {
    return Array.from(this.liveRooms.values());
  }

  /**
   * 重置风控状态
   */
  resetRiskControl(): void {
    this.riskControlManager.reset();
    this.logger.info('直播监听风控状态已重置');
  }

  /**
   * 初始化直播间
   */
  private async initializeLiveRooms(): Promise<void> {
    const liveSubscriptions = this.subscriptions.filter(sub => sub.live);

    if (liveSubscriptions.length === 0) {
      this.logger.info('没有配置直播订阅');
      return;
    }

    this.logger.info(`开始初始化 ${liveSubscriptions.length} 个直播间监听...`);

    for (let i = 0; i < liveSubscriptions.length; i++) {
      const sub = liveSubscriptions[i];

      try {
        // 添加随机延迟避免API请求过于频繁
        if (i > 0) {
          // 为多个直播间添加2-5秒的随机间隔
          const delay = 2000 + Math.random() * 3000; // 2-5秒随机延迟
          this.logger.debug(`等待 ${Math.round(delay / 1000)} 秒后初始化下一个直播间...`);
          await this.sleep(delay);
        }

        // 获取用户信息以获取直播间ID
        const userInfo = await this.getUserInfo(sub.uid);
        if (!userInfo || !userInfo.roomId) {
          this.logger.warn(`用户 ${sub.uid} (${sub.name || '未知'}) 没有直播间信息，跳过`);
          continue;
        }

        const room: LiveRoom = {
          roomId: userInfo.roomId,
          uid: sub.uid,
          uname: sub.name || userInfo.name || `用户${sub.uid}`,
          title: '',
          isLive: false,
          useDanmaku: false,
        };

        this.liveRooms.set(userInfo.roomId, room);
        this.logger.debug(`已添加直播间: ${room.uname} (${userInfo.roomId})`);

        // 尝试连接弹幕监听
        if (this.danmakuService) {
          await this.connectDanmaku(room);
        }
      } catch (error) {
        this.logger.error(`初始化用户 ${sub.uid} (${sub.name || '未知'}) 的直播间失败:`, error);
        // 继续处理下一个用户，不中断整个初始化过程

      }
    }

    const danmakuCount = Array.from(this.liveRooms.values()).filter(room => room.useDanmaku).length;
    this.logger.info(
      `初始化了 ${this.liveRooms.size} 个直播间监听 (弹幕: ${danmakuCount}, 轮询: ${
        this.liveRooms.size - danmakuCount
      })`,
    );

    if (this.liveRooms.size === 0) {
      this.logger.warn('没有成功初始化任何直播间，请检查用户配置或网络连接');
    }
  }

  /**
   * 连接弹幕监听
   */
  private async connectDanmaku(room: LiveRoom): Promise<void> {
    if (!this.danmakuService) return;

    // 设置事件处理器
    this.danmakuService.on('liveStart', (roomId: number) => {
      if (roomId.toString() === room.roomId) {
        this.handleDanmakuLiveStart(room);
      }
    });

    this.danmakuService.on('liveEnd', (roomId: number) => {
      if (roomId.toString() === room.roomId) {
        this.handleDanmakuLiveEnd(room);
      }
    });

    this.danmakuService.on('viewerCountChange', (roomId: number, count: number) => {
      if (roomId.toString() === room.roomId) {
        this.handleWatchedChange(room, count.toString());
      }
    });

    this.danmakuService.on('guardBuy', (roomId: number, data: any) => {
      if (roomId.toString() === room.roomId) {
        this.handleGuardBuy(room, data);
      }
    });

    // 添加错误事件监听器来捕获详细错误信息
    this.danmakuService.on('error', (roomId: number, error: Error) => {
      if (roomId.toString() === room.roomId) {
        this.logger.error(
          `直播间 ${room.roomId} (${room.uname}) 弹幕监听错误: ${error.message}`,
          error,
        );
      }
    });

    try {
      const result = await this.danmakuService.connectRoom(parseInt(room.roomId));
      if (result) {
        room.useDanmaku = true;
        this.logger.info(`直播间 ${room.roomId} (${room.uname}) 弹幕监听已连接`);
      } else {
        this.logger.warn(
          `直播间 ${room.roomId} (${room.uname}) 弹幕监听连接失败 - 请查看上方的详细错误信息`,
        );
      }
    } catch (error) {
      this.logger.error(`直播间 ${room.roomId} (${room.uname}) 弹幕监听连接异常:`, error);
    }
  }

  /**
   * 处理弹幕检测到的开播事件
   */
  private async handleDanmakuLiveStart(room: LiveRoom): Promise<void> {
    try {
      if (room.isLive) {
        this.logger.debug(`直播间 ${room.roomId} 已经是开播状态，忽略弹幕开播事件`);
        return;
      }

      // 通过API获取最新的直播信息
      const result = await this.fetchLiveStatus(room.roomId);
      if (result.success && result.data && result.data.live_status === 1) {
        this.logger.info(`🎯 弹幕实时检测到开播: ${room.uname}`);
        await this.handleLiveStart(room, result.data);
        room.isLive = true;
      }
    } catch (error) {
      this.logger.error(`处理弹幕开播事件失败 [${room.roomId}]:`, error);
    }
  }

  /**
   * 处理弹幕检测到的下播事件
   */
  private async handleDanmakuLiveEnd(room: LiveRoom): Promise<void> {
    try {
      if (!room.isLive) {
        this.logger.debug(`直播间 ${room.roomId} 已经是下播状态，忽略弹幕下播事件`);
        return;
      }

      this.logger.info(`🎯 弹幕实时检测到下播: ${room.uname}`);
      await this.handleLiveEnd(room);
      room.isLive = false;
    } catch (error) {
      this.logger.error(`处理弹幕下播事件失败 [${room.roomId}]:`, error);
    }
  }

  /**
   * 处理观看人数变化
   */
  private handleWatchedChange(room: LiveRoom, count: string): void {
    room.onlineCount = count;
    this.logger.debug(`直播间 ${room.roomId} 观看人数: ${count}`);
  }

  /**
   * 处理上舰消息
   */
  private async handleGuardBuy(
    room: LiveRoom,
    data: { username: string; giftName: string },
  ): Promise<void> {
    try {
      // 获取订阅信息
      const sub = this.findSubscriptionByUid(room.uid);
      if (!sub) return;

      // 检查是否有目标需要推送上舰消息
      const guardTargets = sub.targets.filter(target => target.liveGuardBuy);
      if (guardTargets.length === 0) return;

      const content = `[${room.uname}的直播间]「${data.username}」加入了大航海（${data.giftName}）`;

      // 发送上舰通知
      for (const target of guardTargets) {
        const notificationResult = await this.notificationManager.sendNotification({
          type: 'guard',
          user: room.uname,
          content: content,
          target: {
            platform: target.platform,
            channelId: target.channelId,
          },
        });

        if (notificationResult.success) {
          this.logger.info(
            `上舰通知发送成功: ${room.uname} -> ${target.platform}:${target.channelId}`,
          );
        } else {
          this.logger.error(`上舰通知发送失败: ${notificationResult.error}`);
        }
      }
    } catch (error) {
      this.logger.error(`处理上舰消息失败 [${room.roomId}]:`, error);
    }
  }

  /**
   * 获取用户信息
   */
  private async getUserInfo(uid: string): Promise<{ name: string; roomId: string } | null> {
    try {
      const apiService = this.ctx.get('bilibiliApiService');
      if (!apiService) {
        this.logger.error('B站API服务未初始化');
        return null;
      }

      const result = await apiService.getUserInfo(uid);
      if (!result.success || !result.data) {
        this.logger.warn(`获取用户 ${uid} 信息失败: ${result.error}`);
        return null;
      }

      const userInfo = result.data;
      const roomResult = await apiService.getRoomIdByUid(uid);

      // 添加房间ID获取的详细日志
      if (roomResult.success) {
        this.logger.info(
          `用户 ${uid} (${userInfo.name}) 的房间ID: ${roomResult.data}，长度: ${roomResult.data.length}`,
        );
      } else {
        this.logger.warn(`获取用户 ${uid} 房间ID失败: ${roomResult.error}`);
      }

      return {
        name: userInfo.name,
        roomId: roomResult.success ? roomResult.data : '',
      };
    } catch (error) {
      this.logger.error(`获取用户 ${uid} 信息失败:`, error);
      return null;
    }
  }

  /**
   * 检查所有直播状态
   */
  private async checkAllLiveStatus(): Promise<void> {
    try {
      // 检查是否被风控暂停
      if (this.riskControlManager.isCurrentlyBlocked()) {
        // 只在需要时输出日志，避免重复
        if (this.riskControlManager.shouldLogWarning()) {
          const blockInfo = this.riskControlManager.getDetailedBlockInfo();
          this.logger.warn(
            `🚫 直播检测被风控暂停 ${blockInfo.remainingMinutes} 分钟 | 类型: ${blockInfo.errorType} | 等级: ${blockInfo.blockLevel} | 失败次数: ${blockInfo.consecutiveFailures}`,
          );
        }
        return;
      }

      const rooms = Array.from(this.liveRooms.values());
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];

        // 对于有弹幕监听的房间，降低轮询检查频率
        if (room.useDanmaku && this.danmakuService?.isConnected(parseInt(room.roomId))) {
          // 弹幕连接正常时，只做基础状态同步
          await this.syncRoomStatus(room);
        } else {
          // 弹幕未连接或连接异常时，使用完整轮询检查
          await this.checkLiveStatus(room);
        }

        // 为多个房间添加随机延迟避免请求过于频繁
        if (i < rooms.length - 1) {
          // 不是最后一个房间
          const delay = 1000 + Math.random() * 2000; // 1-3秒随机延迟
          await this.sleep(delay);
        }
      }
    } catch (error) {
      this.logger.error('检查直播状态失败:', error);
    }
  }

  /**
   * 同步房间状态（轻量级检查）
   */
  private async syncRoomStatus(room: LiveRoom): Promise<void> {
    try {
      const result = await this.fetchLiveStatus(room.roomId);
      if (result.success && result.data) {
        // 记录成功到风控管理器
        this.riskControlManager.recordSuccess();

        const liveStatus = result.data;

        // 只更新基础信息，不处理开播/下播逻辑（由弹幕处理）
        room.title = liveStatus.title;

        // 检查标题变更
        if (room.isLive && room.title !== liveStatus.title) {
          await this.handleTitleChange(room, liveStatus);
        }
      } else {
        // 记录失败但不做过多处理，因为弹幕监听是主要检测方式
        this.riskControlManager.recordFailure(result.error || '未知错误', {
          uid: room.uid,
          name: room.uname,
          api: 'getLiveRoomInfo',
        });
      }
    } catch (error) {
      this.logger.debug(`同步房间状态失败 [${room.roomId}]:`, error);
    }
  }

  /**
   * 检查单个直播间状态（完整检查）
   */
  private async checkLiveStatus(room: LiveRoom): Promise<void> {
    try {
      const result = await this.fetchLiveStatus(room.roomId);
      if (!result.success || !result.data) {
        // 记录失败到风控管理器，包含上下文信息
        this.riskControlManager.recordFailure(result.error || '未知错误', {
          uid: room.uid,
          name: room.uname,
          api: 'getLiveRoomInfo',
        });

        // 检查是否是风控相关错误
        if (result.error?.includes('-352') || result.error?.includes('风控')) {
          // 检查是否需要激活暂停机制
          const status = this.riskControlManager.getStatus();
          if (status.isBlocked) {
            const blockInfo = this.riskControlManager.getDetailedBlockInfo();
            this.logger.warn(
              `🚫 直播间 ${room.roomId} (${room.uname}) 触发风控 | 类型: ${blockInfo.errorType} | 暂停 ${blockInfo.remainingMinutes} 分钟`,
            );
          } else {
            this.logger.warn(
              `⚠️ 直播间 ${room.roomId} (${room.uname}) 状态获取异常: ${result.error}`,
            );
          }
          return;
        }

        this.logger.warn(`⚠️ 获取直播间 ${room.roomId} (${room.uname}) 状态失败: ${result.error}`);
        return;
      }

      // 记录成功到风控管理器
      this.riskControlManager.recordSuccess();

      const liveStatus = result.data;
      const wasLive = room.isLive;
      const isNowLive = liveStatus.live_status === 1;

      // 更新房间信息
      room.title = liveStatus.title;

      if (!wasLive && isNowLive) {
        // 开播
        this.logger.info(`📡 轮询检测到开播: ${room.uname}`);
        await this.handleLiveStart(room, liveStatus);
      } else if (wasLive && !isNowLive) {
        // 下播
        this.logger.info(`📡 轮询检测到下播: ${room.uname}`);
        await this.handleLiveEnd(room);
      } else if (isNowLive && room.title !== liveStatus.title) {
        // 直播中标题变更
        await this.handleTitleChange(room, liveStatus);
      }

      room.isLive = isNowLive;
    } catch (error) {
      this.logger.error(`❌ 检查直播间 ${room.roomId} (${room.uname}) 状态失败:`, error);
      // 记录异常到风控管理器
      this.riskControlManager.recordFailure(error instanceof Error ? error.message : '未知错误', {
        uid: room.uid,
        name: room.uname,
        api: 'getLiveRoomInfo',
      });
    }
  }

  /**
   * 处理开播
   */
  private async handleLiveStart(room: LiveRoom, liveStatus: LiveStatus): Promise<void> {
    try {
      // 检查直播过滤
      const isBlocked = this.filterService.checkLiveFilter(liveStatus.title, {
        enable: true,
        keywords: [],
      });
      room.isBlocked = isBlocked;

      if (isBlocked) {
        this.logger.info(`直播被过滤: ${room.uname} - ${liveStatus.title}`);
        return;
      }

      room.liveTime = Date.now();
      this.logger.info(`${room.uname} 开始直播: ${liveStatus.title}`);

      // 获取订阅信息
      const sub = this.findSubscriptionByUid(room.uid);
      if (!sub) {
        this.logger.warn(`找不到用户 ${room.uid} 的订阅信息`);
        return;
      }

      // 立即发送开播通知
      await this.sendLiveNotification(room, sub, 'start');

      // 设置定时推送 - 使用默认间隔
      const pushInterval = this.pushTime; // 默认1小时
      if (pushInterval > 0) {
        room.pushTimer = this.ctx.setInterval(
          () => this.sendTimedNotification(room.roomId),
          pushInterval * 1000 * 60 * 60, // 转换为毫秒：小时 * 1000 * 60 * 60
        );
      }
    } catch (error) {
      this.logger.error('处理开播失败:', error);
    }
  }

  /**
   * 处理下播
   */
  private async handleLiveEnd(room: LiveRoom): Promise<void> {
    try {
      this.logger.info(`${room.uname} 结束直播`);

      // 如果直播被屏蔽，不发送结束通知
      if (room.isBlocked) {
        room.isBlocked = false;
        return;
      }

      // 清理推送定时器
      if (room.pushTimer) {
        room.pushTimer();
        room.pushTimer = undefined;
      }

      // 获取订阅信息
      const sub = this.findSubscriptionByUid(room.uid);
      if (!sub) {
        this.logger.warn(`找不到用户 ${room.uid} 的订阅信息`);
        return;
      }

      // 发送下播通知
      await this.sendLiveNotification(room, sub, 'end');

      room.liveTime = undefined;
      room.onlineCount = undefined;
    } catch (error) {
      this.logger.error('处理下播失败:', error);
    }
  }

  /**
   * 处理标题变更
   */
  private async handleTitleChange(room: LiveRoom, liveStatus: LiveStatus): Promise<void> {
    try {
      const oldTitle = room.title;
      const newTitle = liveStatus.title;

      this.logger.info(`${room.uname} 直播标题变更: ${oldTitle} -> ${newTitle}`);

      // 重新检查过滤
      const isBlocked = this.filterService.checkLiveFilter(newTitle, {
        enable: true,
        keywords: [],
      });
      const wasBlocked = room.isBlocked;

      if (!wasBlocked && isBlocked) {
        // 新标题被屏蔽，停止推送
        this.logger.info(`直播标题变更后被过滤: ${room.uname} - ${newTitle}`);
        if (room.pushTimer) {
          room.pushTimer();
          room.pushTimer = undefined;
        }
        room.isBlocked = true;
      } else if (wasBlocked && !isBlocked) {
        // 新标题不被屏蔽，恢复推送
        this.logger.info(`直播标题变更后恢复推送: ${room.uname} - ${newTitle}`);
        const sub = this.findSubscriptionByUid(room.uid);
        const pushInterval = this.pushTime; // 默认1小时
        if (sub && pushInterval > 0) {
          room.pushTimer = this.ctx.setInterval(
            () => this.sendTimedNotification(room.roomId),
            pushInterval * 1000 * 60 * 60, // 转换为毫秒：小时 * 1000 * 60 * 60
          );
        }
        room.isBlocked = false;
      }
    } catch (error) {
      this.logger.error('处理标题变更失败:', error);
    }
  }

  /**
   * 发送直播通知
   */
  private async sendLiveNotification(
    room: LiveRoom,
    sub: SubscriptionItem,
    type: 'start' | 'end' | 'push',
  ): Promise<void> {
    try {
      // 生成直播图片
      const imageResult = await this.imageService.generateLiveImage({
        uname: room.uname,
        title: room.title,
        roomId: room.roomId,
        liveTime: room.liveTime,
      });

      if (!imageResult.success) {
        this.logger.error(`生成直播图片失败: ${imageResult.error}`);
        return;
      }

      // 获取配置中的自定义消息模板
      const customMessages = this.customMessages;

      // 构建直播链接
      const liveUrl = `https://live.bilibili.com/${room.roomId}`;

      // 根据类型格式化消息
      let customMessage = '';
      if (type === 'start' && customMessages.liveStart) {
        customMessage = formatLiveStartMessage(customMessages.liveStart, {
          name: room.uname,
          title: room.title,
          url: liveUrl,
        });
      } else if (type === 'push' && customMessages.live) {
        // 对于定时推送，优先使用弹幕获取的观看人数
        const onlineCount = room.onlineCount || (await this.getOnlineCount(room.roomId));
        const liveTime = this.formatLiveTime(room.liveTime);
        customMessage = formatLiveMessage(customMessages.live, {
          name: room.uname,
          title: room.title,
          url: liveUrl,
          online: onlineCount,
          time: liveTime,
        });
      } else if (type === 'end' && customMessages.liveEnd) {
        const liveTime = this.formatLiveTime(room.liveTime);
        customMessage = formatLiveEndMessage(customMessages.liveEnd, {
          name: room.uname,
          time: liveTime,
        });
      }

      // 构建完整的消息内容
      let content = room.title;
      if (customMessage) {
        content = customMessage;
      }

      // 发送通知到所有目标
      for (const target of sub.targets) {
        if (!target.live) continue;

        const notificationResult = await this.notificationManager.sendNotification({
          type: 'live',
          subType: type,
          user: room.uname,
          content: content,
          image: imageResult.data,
          url: liveUrl,
          target: {
            platform: target.platform,
            channelId: target.channelId,
          },
        });

        if (notificationResult.success) {
          this.logger.info(
            `直播通知发送成功: ${room.uname} (${type}) -> ${target.platform}:${target.channelId}`,
          );
        } else {
          this.logger.error(`直播通知发送失败: ${notificationResult.error}`);
        }
      }
    } catch (error) {
      this.logger.error('发送直播通知失败:', error);
    }
  }

  /**
   * 获取在线观看人数
   */
  private async getOnlineCount(roomId: string): Promise<string> {
    try {
      const apiService = this.ctx.get('bilibiliApiService');
      if (!apiService) {
        return '未知';
      }

      const result = await apiService.getLiveRoomInfo(roomId);
      if (result.success && result.data) {
        return result.data.online?.toString() || '未知';
      }
      return '未知';
    } catch (error) {
      this.logger.warn('获取在线人数失败:', error);
      return '未知';
    }
  }

  /**
   * 格式化直播时长
   */
  private formatLiveTime(liveTime?: number): string {
    if (!liveTime) {
      return '未知';
    }

    const now = Math.floor(Date.now() / 1000);
    const duration = now - liveTime;

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;

    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * 根据UID查找订阅
   */
  private findSubscriptionByUid(uid: string): SubscriptionItem | undefined {
    return this.subscriptions.find(sub => sub.uid === uid);
  }

  /**
   * 获取直播状态
   */
  private async fetchLiveStatus(roomId: string): Promise<OperationResult<LiveStatus>> {
    try {
      // 调用B站API服务获取直播状态
      const apiService = this.ctx.get('bilibiliApiService');
      if (!apiService) {
        return {
          success: false,
          error: 'B站API服务未初始化',
        };
      }

      const result = await apiService.getLiveRoomInfo(roomId);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取直播状态失败',
      };
    }
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 发送定时直播通知
   */
  private async sendTimedNotification(roomId: string): Promise<void> {
    try {
      const room = this.liveRooms.get(roomId);
      if (!room || !room.isLive) {
        return;
      }

      const sub = this.findSubscriptionByUid(room.uid);
      if (!sub) {
        return;
      }

      await this.sendLiveNotification(room, sub, 'push');
    } catch (error) {
      this.logger.error(`发送定时直播通知失败 (房间 ${roomId}):`, error);
    }
  }

  // 启动弹幕监听服务
  private async startDanmakuService(): Promise<void> {
    if (!this.danmakuService) {
      return;
    }

    try {
      const startResult = await this.danmakuService.start();
      if (startResult) {
        this.logger.info('弹幕监听服务启动成功');
      } else {
        this.logger.warn('弹幕监听服务启动失败，将使用纯轮询模式');
      }
    } catch (error) {
      this.logger.error('弹幕监听服务启动异常:', error);
    }
  }
}
