import { Context } from 'koishi';
import { type MessageListener, startListen } from 'blive-message-listener';
import { createLogger, type EnhancedLogger } from '../../utils/logger';
import { DEFAULT_CONFIG } from '../../constants';

// 弹幕事件接口
export interface DanmuEvents {
  liveStart: (roomId: number, title: string) => void;
  liveEnd: (roomId: number) => void;
  viewerCountChange: (roomId: number, count: number) => void;
  guardBuy: (roomId: number, data: any) => void;
  error: (roomId: number, error: Error) => void;
  connected: (roomId: number) => void;
  disconnected: (roomId: number) => void;
}

// 直播间连接信息
export interface LiveRoomConnection {
  roomId: number;
  listener: MessageListener;
  isConnected: boolean;
  lastHeartbeat: number;
  reconnectCount: number;
}

export class DanmuListenerService {
  private ctx: Context;
  private logger: EnhancedLogger;
  private connections: Map<number, LiveRoomConnection> = new Map();
  private eventHandlers: Partial<DanmuEvents> = {};
  private isRunning = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private maxConnections: number = DEFAULT_CONFIG.MAX_CONNECTIONS;
  private reconnectInterval: number = DEFAULT_CONFIG.RECONNECT_INTERVAL;
  private heartbeatInterval: number = DEFAULT_CONFIG.HEARTBEAT_INTERVAL;
  private enableDanmaku: boolean = DEFAULT_CONFIG.ENABLE_DANMAKU;

  constructor(
    ctx: Context,
    options?: {
      maxConnections?: number;
      reconnectInterval?: number;
      heartbeatInterval?: number;
      enableDanmaku?: boolean;
    },
  ) {
    this.ctx = ctx;
    this.logger = createLogger(ctx, 'DANMU');

    // 应用配置选项
    if (options) {
      this.maxConnections = options.maxConnections ?? this.maxConnections;
      this.reconnectInterval = options.reconnectInterval ?? this.reconnectInterval;
      this.heartbeatInterval = options.heartbeatInterval ?? this.heartbeatInterval;
      this.enableDanmaku = options.enableDanmaku ?? this.enableDanmaku;
    }

    this.logger.info(
      `弹幕监听服务初始化 (启用: ${this.enableDanmaku}, 最大连接: ${this.maxConnections})`,
    );
  }

  // 获取服务状态
  get status() {
    return {
      isRunning: this.isRunning,
      connectionCount: this.connections.size,
      maxConnections: this.maxConnections,
      connectedRooms: Array.from(this.connections.keys()),
    };
  }

  // 启动弹幕监听服务
  async start(): Promise<boolean> {
    if (this.isRunning) {
      this.logger.warn('弹幕监听服务已在运行');
      return true;
    }

    try {
      this.isRunning = true;
      this.startHeartbeat();
      this.logger.info('弹幕监听服务已启动');
      return true;
    } catch (error) {
      this.logger.fail('启动弹幕监听服务失败:', error);
      this.isRunning = false;
      return false;
    }
  }

  // 停止弹幕监听服务
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // 停止心跳检测
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // 断开所有连接
    for (const [roomId] of this.connections) {
      await this.disconnectRoom(roomId);
    }

    this.connections.clear();
    this.logger.info('弹幕监听服务已停止');
  }

  // 连接到直播间
  async connectRoom(roomId: number): Promise<boolean> {
    if (!this.enableDanmaku) {
      this.logger.debug(`弹幕监听已禁用，跳过房间 ${roomId}`);
      return false;
    }

    let longRoomId = roomId; // 在外部声明，以便在catch块中使用

    try {
      // 检查连接数限制
      if (this.connections.size >= this.maxConnections) {
        this.logger.warn(`连接数已达上限 (${this.maxConnections})，无法连接房间 ${roomId}`);
        return false;
      }

      // 检查是否已连接
      if (this.connections.has(roomId)) {
        await this.disconnectRoom(roomId);
      }

      this.logger.info(`🔗 开始连接房间 ${roomId} 的弹幕监听...`);

      // 确保使用长房间ID
      const apiService = this.ctx.get('bilibiliApiService');

      if (!apiService) {
        this.logger.error('⚠️ BilibiliApiService未找到，无法获取弹幕连接信息');
        return false;
      }

      const longRoomIdResult = await apiService.getLongRoomId(roomId.toString());
      if (longRoomIdResult.success) {
        longRoomId = parseInt(longRoomIdResult.data);
        if (longRoomId !== roomId) {
          this.logger.info(`房间ID转换: ${roomId} -> ${longRoomId} (短ID转长ID)`);
        }
      } else {
        this.logger.warn(`获取长房间ID失败，使用原始ID: ${roomId}`);
      }

      // 房间ID诊断
      this.logger.info(
        `房间ID诊断: ${longRoomId}, 长度: ${longRoomId.toString().length}, 类型: ${typeof longRoomId}`,
      );

      // 获取用户信息和Cookie
      const cookiesStr = apiService.getCookiesForHeader();
      const myselfInfoResult = await apiService.getMyselfInfo();

      // 验证登录状态
      if (!cookiesStr || !myselfInfoResult.success || !myselfInfoResult.data?.mid) {
        this.logger.error('❌ 用户未登录或登录信息无效，无法连接弹幕服务');
        this.logger.error('  - Cookie存在:', !!cookiesStr);
        this.logger.error('  - 用户信息获取成功:', myselfInfoResult.success);
        this.logger.error('  - 用户UID:', myselfInfoResult.data?.mid || '无');
        return false;
      }

      const uid = myselfInfoResult.data.mid;
      this.logger.info(`✅ 已登录用户UID: ${uid}`);

      // 获取弹幕连接信息（包括token）
      const danmuInfoResult = await apiService.getDanmuInfo(longRoomId.toString());
      if (!danmuInfoResult.success) {
        this.logger.error(`❌ 获取弹幕连接信息失败: ${danmuInfoResult.error}`);
        return false;
      }

      const { token, host_list } = danmuInfoResult.data;
      this.logger.info(`✅ 获取到弹幕token: ${token.substring(0, 20)}...`);
      this.logger.info(`✅ 弹幕服务器数量: ${host_list.length}`);

      // 配置连接参数（使用完整模式）
      const connectionOptions = {
        ws: {
          headers: {
            Cookie: cookiesStr,
          },
          uid: uid,
          key: token, // 使用获取到的token作为key
        },
      };

      this.logger.info('🚀 连接配置 (完整模式):');
      this.logger.info(`  - UID: ${uid}`);
      this.logger.info(`  - Cookie长度: ${cookiesStr.length}`);
      this.logger.info(`  - Token长度: ${token.length}`);
      this.logger.info('  - 模式: 完整连接 (带token)');

      // 创建消息处理器
      const handler = this.createEventHandler(longRoomId);

      // 启动监听
      this.logger.info('🔌 正在启动监听器...');
      const listener = startListen(longRoomId, handler, connectionOptions);

      const connection: LiveRoomConnection = {
        roomId: longRoomId,
        listener,
        isConnected: false,
        lastHeartbeat: Date.now(),
        reconnectCount: 0,
      };

      this.connections.set(longRoomId, connection);
      this.logger.info(`📋 房间 ${longRoomId} 连接记录已创建，等待WebSocket建立...`);

      return true;
    } catch (error) {
      this.logger.error(`❌ 连接房间 ${longRoomId} 失败:`, error);
      // 输出更详细的错误信息
      if (error instanceof Error) {
        this.logger.error(`错误详情: ${error.message}`);
        this.logger.error(`错误堆栈: ${error.stack}`);
      }
      this.eventHandlers.error?.(longRoomId, error as Error);
      return false;
    }
  }

  // 断开直播间连接
  async disconnectRoom(roomId: number): Promise<void> {
    const connection = this.connections.get(roomId);
    if (!connection) return;

    try {
      if (connection.listener && typeof connection.listener.close === 'function') {
        connection.listener.close();
      }
      this.connections.delete(roomId);
      this.logger.info(`❌ 已断开房间 ${roomId} 的弹幕连接`);
      this.eventHandlers.disconnected?.(roomId);
    } catch (error) {
      this.logger.error(`断开房间 ${roomId} 连接失败:`, error);
    }
  }

  // 检查连接状态
  isConnected(roomId: number): boolean {
    const connection = this.connections.get(roomId);
    if (!connection) return false;

    const now = Date.now();
    const timeSinceLastBeat = now - connection.lastHeartbeat;
    const heartbeatValid = timeSinceLastBeat < this.heartbeatInterval * 5;

    return connection.isConnected && !!connection.listener && heartbeatValid;
  }

  // 获取连接统计
  getConnectionStats() {
    return {
      total: this.connections.size,
      connected: Array.from(this.connections.values()).filter(c => c.isConnected).length,
      rooms: Array.from(this.connections.keys()),
    };
  }

  // 设置事件处理器
  on<K extends keyof DanmuEvents>(event: K, handler: DanmuEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  // 移除事件处理器
  off<K extends keyof DanmuEvents>(event: K): void {
    delete this.eventHandlers[event];
  }

  // 设置配置
  setConfig(config: {
    maxConnections?: number;
    reconnectInterval?: number;
    heartbeatInterval?: number;
  }): void {
    this.maxConnections = config.maxConnections ?? this.maxConnections;
    this.reconnectInterval = config.reconnectInterval ?? this.reconnectInterval;
    this.heartbeatInterval = config.heartbeatInterval ?? this.heartbeatInterval;
  }

  // 获取服务状态
  getServiceStatus(): {
    isRunning: boolean;
    enableDanmaku: boolean;
    connectionCount: number;
    maxConnections: number;
    reconnectInterval: number;
    heartbeatInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      enableDanmaku: this.enableDanmaku,
      connectionCount: this.connections.size,
      maxConnections: this.maxConnections,
      reconnectInterval: this.reconnectInterval,
      heartbeatInterval: this.heartbeatInterval,
    };
  }

  // 创建事件处理器
  private createEventHandler(roomId: number) {
    return {
      onOpen: () => {
        this.logger.info(`✅ 房间 ${roomId} WebSocket连接已建立`);
        this.eventHandlers.connected?.(roomId);
        this.updateHeartbeat(roomId);
        const connection = this.connections.get(roomId);
        if (connection) {
          connection.reconnectCount = 0;
          connection.isConnected = true;
        }
      },
      onClose: (code?: number, reason?: string) => {
        this.logger.warn(
          `❌ 房间 ${roomId} WebSocket连接已关闭 - 代码: ${code}, 原因: ${reason || '未知'}`,
        );
        this.eventHandlers.disconnected?.(roomId);
        const connection = this.connections.get(roomId);
        if (connection) {
          connection.isConnected = false;
          if (this.isRunning) {
            this.handleConnectionError(roomId);
          }
        }
      },
      onError: (error: Error) => {
        this.logger.error(`💥 房间 ${roomId} WebSocket连接错误:`, error);
        this.eventHandlers.error?.(roomId, error);
        const connection = this.connections.get(roomId);
        if (connection && this.isRunning) {
          setTimeout(() => {
            this.handleConnectionError(roomId);
          }, 5000);
        }
      },
      onStartListen: () => {
        this.logger.info(`🎧 房间 ${roomId} 开始监听弹幕消息`);
        this.updateHeartbeat(roomId);
      },
      onLiveStart: () => {
        this.logger.info(`🔴 房间 ${roomId} 检测到开播事件`);
        this.eventHandlers.liveStart?.(roomId, '');
        this.updateHeartbeat(roomId);
      },
      onPreparing: () => {
        this.logger.info(`⚫ 房间 ${roomId} 检测到下播事件`);
        this.eventHandlers.liveEnd?.(roomId);
        this.updateHeartbeat(roomId);
      },
      onWatchedChange: (data: any) => {
        if (data?.num !== undefined) {
          this.logger.debug(`👥 房间 ${roomId} 观看人数变化: ${data.num}`);
          this.eventHandlers.viewerCountChange?.(roomId, data.num);
          this.updateHeartbeat(roomId);
        }
      },
      onGuardBuy: (data: any) => {
        this.logger.info(`⚡ 房间 ${roomId} 检测到上舰事件:`, data);
        this.eventHandlers.guardBuy?.(roomId, data);
        this.updateHeartbeat(roomId);
      },
    };
  }

  // 更新心跳时间
  private updateHeartbeat(roomId: number): void {
    const connection = this.connections.get(roomId);
    if (connection) {
      connection.lastHeartbeat = Date.now();
    }
  }

  // 启动心跳检测
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkConnections();
    }, this.heartbeatInterval);
  }

  // 检查连接状态
  private checkConnections(): void {
    const now = Date.now();
    const timeout = this.heartbeatInterval * 5; // 增加到5倍心跳间隔为超时

    for (const [roomId, connection] of this.connections) {
      if (!connection) continue;

      // 检查连接是否真的超时
      const isTimeout = now - connection.lastHeartbeat > timeout;

      if (isTimeout && connection.isConnected) {
        this.logger.warn(`房间 ${roomId} 连接异常 (超时: ${isTimeout})，准备重连`);
        connection.isConnected = false;
        this.handleConnectionError(roomId);
      }
    }
  }

  // 处理连接错误
  private async handleConnectionError(roomId: number): Promise<void> {
    const connection = this.connections.get(roomId);
    if (!connection) return;

    connection.isConnected = false;
    connection.reconnectCount++;

    // 如果重连次数超过3次，停止重连
    if (connection.reconnectCount > 3) {
      this.logger.error(`房间 ${roomId} 重连次数超过限制，停止重连`);
      await this.disconnectRoom(roomId);
      return;
    }

    const delay = this.reconnectInterval;
    this.logger.info(
      `房间 ${roomId} 将在 ${delay / 1000} 秒后重连 (第${connection.reconnectCount}次)`,
    );

    // 延迟重连
    setTimeout(async () => {
      if (this.isRunning && this.connections.has(roomId)) {
        try {
          await this.disconnectRoom(roomId);
          await new Promise(resolve => setTimeout(resolve, 2000));
          const success = await this.connectRoom(roomId);
          if (success) {
            this.logger.info(`房间 ${roomId} 重连成功`);
          } else {
            this.logger.warn(`房间 ${roomId} 重连失败`);
          }
        } catch (error) {
          this.logger.error(`房间 ${roomId} 重连过程中出错:`, error);
        }
      }
    }, delay);
  }
}
