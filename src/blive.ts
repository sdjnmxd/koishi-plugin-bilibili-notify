import {
  type MessageListener,
  type MsgHandler,
  startListen,
} from "blive-message-listener";
import { type Awaitable, type Context, Service } from "koishi";

declare module "koishi" {
	interface Context {
		bl: BLive;
	}
}

class BLive extends Service {
	// 必要服务
	static inject = ["ba"];
	// 定义类属性
	public listenerRecord: Record<string, MessageListener> = {};

	constructor(ctx: Context) {
		// Extends super
		super(ctx, "bl");
	}

	// 注册插件dispose逻辑
	protected stop(): Awaitable<void> {
		// 清除所有监听器
		for (const key of Object.keys(this.listenerRecord)) {
			this.closeListener(key);
		}
	}

	async startLiveRoomListener(roomId: string, handler: MsgHandler) {
		try {
			// 获取cookieStr
			const cookiesStr = await this.ctx.ba.getCookiesForHeader();
			// 获取自身信息
			const mySelfInfo = await this.ctx.ba.getMyselfInfo();

			let danmuInfo;
			let usedFallback = false;

			try {
				// 首先尝试主接口
				danmuInfo = await this.ctx.ba.getLiveRoomInfoStreamKey(roomId);

				// 检查是否遇到权限错误
				if (danmuInfo && danmuInfo.code === -352) {
					this.logger.warn(`${roomId}直播间主接口遇到权限错误(-352)，尝试使用备用接口`);
					throw new Error("权限错误，切换到备用接口");
				}
			} catch (error) {
				this.logger.warn(`${roomId}直播间主接口失败: ${error.message}，尝试使用备用接口`);

				try {
					// 使用备用接口
					danmuInfo = await this.ctx.ba.getLiveRoomInfoStreamKeyFallback(roomId);
					usedFallback = true;
					this.logger.info(`${roomId}直播间成功使用备用接口获取弹幕信息`);
				} catch (fallbackError) {
					throw new Error(`主接口和备用接口都失败: 主接口(${error.message}) 备用接口(${fallbackError.message})`);
				}
			}

			// 检查是否成功获取到token
			if (!danmuInfo || danmuInfo.code !== 0 || !danmuInfo.data || !danmuInfo.data.token) {
				throw new Error(`获取弹幕token失败: ${danmuInfo?.message || '未知错误'}`);
			}

			const token = danmuInfo.data.token;
			this.logger.info(`${roomId}直播间获取到弹幕token: ${token.substring(0, 20)}...${usedFallback ? ' (使用备用接口)' : ''}`);

			// 创建实例并保存到Record中
			this.listenerRecord[roomId] = startListen(
				Number.parseInt(roomId),
				handler,
				{
					ws: {
						headers: {
							Cookie: cookiesStr,
						},
						uid: mySelfInfo.data.mid,
						key: token,
					},
				},
			);
			// logger
			this.logger.info(`${roomId}直播间监听已启动${usedFallback ? ' (使用备用接口)' : ''}`);

			// 检查连接状态
			setTimeout(() => {
				if (this.listenerRecord[roomId] && !this.listenerRecord[roomId].closed) {
					this.logger.info(`${roomId}直播间监听连接成功${usedFallback ? ' (使用备用接口)' : ''}`);
				} else {
					this.logger.error(`${roomId}直播间监听连接失败`);
				}
			}, 3000);

		} catch (error) {
			this.logger.error(`${roomId}直播间监听启动失败: ${error.message}`);
		}
	}

	closeListener(roomId: string) {
		// 判断直播间监听器是否关闭
		if (
			!this.listenerRecord ||
			!this.listenerRecord[roomId] ||
			!this.listenerRecord[roomId].closed
		) {
			// 输出logger
			this.logger.info(`${roomId}直播间弹幕监听器无需关闭`);
		}
		// 关闭直播间监听器
		this.listenerRecord[roomId].close();
		// 判断是否关闭成功
		if (this.listenerRecord[roomId].closed) {
			// 删除直播间监听器
			delete this.listenerRecord[roomId];
			// 输出logger
			this.logger.info(`${roomId}直播间弹幕监听已关闭`);
			// 直接返回
			return;
		}
		// 未关闭成功
		this.logger.warn(`${roomId}直播间弹幕监听未成功关闭`);
	}
}

export default BLive;
