import { Context, Logger } from 'koishi';

import { createLogger } from '../../utils/logger';
import { Service } from '../../types/base';
import {
  API_ENDPOINTS,
  API_RESPONSE_CODES,
  BILIBILI_DOMAINS,
  BILIBILI_ERROR_CODES,
  SEARCH_CONFIG,
} from '../../constants';

import { OperationResult } from '../../types/common';
import { DynamicItem, LiveStatus, UserInfo } from '../../types/subscription';
import { BilibiliWbi } from './BilibiliWbi';
import { BilibiliHttpService } from './BilibiliHttpService';

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

interface LoginInfo {
  isLogin: boolean;
  uid?: string;
  uname?: string;
  face?: string;
  level?: number;
}

export class BilibiliApiService extends Service {
  private logger: Logger;

  // 服务实例
  private wbiService: BilibiliWbi;
  private httpService: BilibiliHttpService;

  constructor(ctx: Context, config?: any) {
    super(ctx);
    this.logger = createLogger(ctx, 'API');
    this.httpService = new BilibiliHttpService(ctx, config);
    this.wbiService = new BilibiliWbi(ctx, this.httpService);
  }

  /**
   * 获取服务状态
   */
  get status() {
    return this.httpService.getStatus();
  }

  /**
   * 重新加载User-Agent配置
   */
  reloadUserAgents(): void {
    this.httpService.reloadUserAgents();
  }

  /**
   * 获取当前User-Agent信息
   */
  getCurrentUserAgentInfo(): { index: number; total: number; current: string } {
    return this.httpService.getCurrentUserAgentInfo();
  }

  /**
   * 设置登录Cookie
   */
  setCookies(cookies: string): void {
    this.httpService.setCookies(cookies);
  }

  /**
   * 获取用于请求头的Cookie字符串
   */
  getCookiesForHeader(): string {
    return this.httpService.getCookiesForHeader();
  }

  /**
   * 获取登录状态
   */
  async getLoginStatus(): Promise<OperationResult<LoginInfo>> {
    try {
      // 检查上下文是否活跃
      if (!this.ctx.scope.isActive) {
        return {
          success: false,
          error: '服务正在重启或停止中，无法获取登录状态',
        };
      }

      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        BILIBILI_DOMAINS.API + API_ENDPOINTS.NAV,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS && response.data.isLogin) {
        const loginInfo: LoginInfo = {
          isLogin: true,
          uid: response.data.mid?.toString(),
          uname: response.data.uname,
          face: response.data.face,
          level: response.data.level_info?.current_level,
        };

        return { success: true, data: loginInfo };
      } else {
        const loginInfo: LoginInfo = { isLogin: false };
        return { success: true, data: loginInfo };
      }
    } catch (error) {
      // 特殊处理上下文非活跃错误
      if (error.code === 'INACTIVE_EFFECT' || error.message?.includes('服务上下文已停用')) {
        return {
          success: false,
          error: '服务正在重启或停止中，无法获取登录状态',
        };
      }

      this.logger.error('获取登录状态失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取登录状态失败',
      };
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(uid: string): Promise<OperationResult<UserInfo>> {
    try {
      // 获取基本用户信息
      const wbiQuery = await this.wbiService.getWbi({ mid: uid });
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.API}${API_ENDPOINTS.USER_INFO}?${wbiQuery}`,
      );

      if (response.code !== API_RESPONSE_CODES.SUCCESS) {
        this.handleApiError(response);
      }

      // 获取用户统计信息（粉丝数、关注数）
      const statResponse = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.API}${API_ENDPOINTS.USER_STATS}?vmid=${uid}`,
      );

      const userInfo: UserInfo = {
        uid: response.data.mid.toString(),
        name: response.data.name,
        uname: response.data.name,
        face: response.data.face,
        sign: response.data.sign,
        level: response.data.level,
        // 从统计 API 获取粉丝数和关注数
        follower:
          statResponse.code === API_RESPONSE_CODES.SUCCESS ? statResponse.data.follower : undefined,
        following:
          statResponse.code === API_RESPONSE_CODES.SUCCESS
            ? statResponse.data.following
            : undefined,
      };

      return { success: true, data: userInfo };
    } catch (error) {
      this.logger.error(`获取用户 ${uid} 信息失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户信息失败',
      };
    }
  }

  /**
   * 获取用户动态
   */
  async getUserDynamics(uid: string, offset?: string): Promise<OperationResult<DynamicItem[]>> {
    try {
      const params: any = {
        host_mid: uid,
        platform: 'web',
        features: 'itemOpusStyle',
      };
      if (offset) params.offset = offset;

      const wbiQuery = await this.wbiService.getWbi(params);
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.API}${API_ENDPOINTS.USER_DYNAMICS}?${wbiQuery}`,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS) {
        const dynamics: DynamicItem[] =
          response.data.items?.map((item: any) => ({
            id_str: item.id_str,
            type: item.type,
            modules: item.modules,
            author: item.modules?.module_author,
            timestamp: item.modules?.module_author?.pub_ts,
          })) || [];

        return { success: true, data: dynamics };
      } else {
        this.handleApiError(response);
      }
    } catch (error) {
      this.logger.error(`获取用户 ${uid} 动态失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户动态失败',
      };
    }
  }

  /**
   * 获取直播间信息
   */
  async getLiveRoomInfo(roomId: string): Promise<OperationResult<LiveStatus>> {
    try {
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.LIVE_API}${API_ENDPOINTS.ROOM_INFO}?room_id=${roomId}`,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS) {
        const liveStatus: LiveStatus = {
          live_status: response.data.live_status,
          title: response.data.title,
          cover: response.data.user_cover,
          online: response.data.online,
        };

        return { success: true, data: liveStatus };
      } else {
        this.handleApiError(response);
      }
    } catch (error) {
      this.logger.error(`获取直播间 ${roomId} 信息失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取直播间信息失败',
      };
    }
  }

  /**
   * 根据UID获取直播间ID
   */
  async getRoomIdByUid(uid: string): Promise<OperationResult<string>> {
    try {
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.LIVE_API}${API_ENDPOINTS.ROOM_INFO_OLD}?mid=${uid}`,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS && response.data?.roomid) {
        const roomId = response.data.roomid.toString();

        // 检查是否需要转换为长房间ID
        const longRoomIdResult = await this.getLongRoomId(roomId);
        if (longRoomIdResult.success) {
          return { success: true, data: longRoomIdResult.data };
        } else {
          // 如果转换失败，返回原始房间ID
          this.logger.warn(`转换长房间ID失败，使用原始房间ID: ${roomId}`);
          return { success: true, data: roomId };
        }
      } else {
        return {
          success: false,
          error: '该用户没有直播间',
        };
      }
    } catch (error) {
      this.logger.error(`获取用户 ${uid} 直播间ID失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取直播间ID失败',
      };
    }
  }

  /**
   * 获取长房间ID（将短房间ID转换为长房间ID）
   */
  async getLongRoomId(roomId: string): Promise<OperationResult<string>> {
    try {
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.LIVE_API}${API_ENDPOINTS.ROOM_INIT}?id=${roomId}`,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS && response.data?.room_id) {
        const longRoomId = response.data.room_id.toString();
        this.logger.debug(`房间ID转换: ${roomId} -> ${longRoomId}`);
        return { success: true, data: longRoomId };
      } else {
        return {
          success: false,
          error: '无法获取长房间ID',
        };
      }
    } catch (error) {
      this.logger.error(`获取长房间ID失败 (${roomId}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取长房间ID失败',
      };
    }
  }

  /**
   * 搜索用户
   */
  async searchUser(keyword: string): Promise<OperationResult<UserInfo[]>> {
    try {
      const wbiQuery = await this.wbiService.getWbi({
        keyword,
        search_type: SEARCH_CONFIG.USER_SEARCH_TYPE,
      });
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.API}${API_ENDPOINTS.USER_SEARCH}?${wbiQuery}`,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS) {
        const users = response.data?.result || [];
        const userList: UserInfo[] = users
          .slice(0, SEARCH_CONFIG.MAX_USER_RESULTS)
          .map((user: any) => ({
            uid: user.mid.toString(),
            name: user.uname,
            uname: user.uname,
            face: user.upic,
            sign: user.usign,
            level: user.level,
            follower: user.fans,
            following: 0,
          }));

        return { success: true, data: userList };
      } else {
        this.handleApiError(response);
      }
    } catch (error) {
      this.logger.error(`搜索用户 "${keyword}" 失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索用户失败',
      };
    }
  }

  /**
   * 获取弹幕连接信息
   */
  async getDanmuInfo(roomId: string): Promise<
    OperationResult<{
      token: string;
      host_list: Array<{ host: string; port: number; wss_port: number; ws_port: number }>;
      max_delay: number;
    }>
  > {
    try {
      // 为弹幕API使用特殊的请求头
      const specialHeaders = this.httpService.getSpecialHeaders(roomId);

      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        `${BILIBILI_DOMAINS.LIVE_API}${API_ENDPOINTS.DANMU_INFO}?id=${roomId}`,
        { headers: specialHeaders },
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS) {
        return {
          success: true,
          data: {
            token: response.data.token,
            host_list: response.data.host_list,
            max_delay: response.data.max_delay,
          },
        };
      } else {
        this.handleApiError(response);
      }
    } catch (error) {
      this.logger.error(`获取房间 ${roomId} 弹幕信息失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取弹幕信息失败',
      };
    }
  }

  /**
   * 获取当前用户详细信息（与老版本兼容）
   */
  async getMyselfInfo(): Promise<OperationResult<any>> {
    try {
      const response = await this.httpService.getWithRetry<ApiResponse<any>>(
        BILIBILI_DOMAINS.API + API_ENDPOINTS.USER_ACCOUNT,
      );

      if (response.code === API_RESPONSE_CODES.SUCCESS) {
        return { success: true, data: response.data };
      } else {
        this.handleApiError(response);
      }
    } catch (error) {
      this.logger.error('获取用户详细信息失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取用户详细信息失败',
      };
    }
  }

  /**
   * 重置服务状态（用于处理风控等异常情况）
   */
  resetServiceState(): void {
    this.httpService.resetServiceState();
    this.wbiService.clearCache();
    this.logger.info('API服务状态已重置');
  }

  /**
   * 更新配置
   */
  updateConfig(config: any): void {
    this.httpService.updateConfig(config);
  }

  /**
   * 处理API错误
   */
  private handleApiError(response: ApiResponse<any>): never {
    const friendlyMessage = BILIBILI_ERROR_CODES[response.code] || '未知错误';
    const originalMessage = response.message || '无详细信息';

    // 构建包含友好提示和原始信息的完整错误消息
    let errorMessage = friendlyMessage;

    // 如果友好消息和原始消息不同，则同时显示
    if (friendlyMessage !== originalMessage && originalMessage !== '无详细信息') {
      errorMessage = `${friendlyMessage} (原始信息: ${originalMessage})`;
    }

    // 添加错误码信息
    const fullErrorMessage = `${errorMessage} [错误码: ${response.code}]`;

    switch (response.code) {
      case API_RESPONSE_CODES.NOT_LOGIN:
        throw new Error(`需要登录才能访问此接口 [错误码: ${response.code}]`);
      case API_RESPONSE_CODES.RISK_CONTROL:
        // 为-352错误添加详细的诊断信息
        const uaInfo = this.getCurrentUserAgentInfo();
        const diagnosticInfo =
          `请求被风控，建议检查User-Agent设置或稍后重试 (原始信息: ${originalMessage}) [错误码: ${response.code}]\n` +
          `诊断信息: User-Agent(${uaInfo.index}/${uaInfo.total}): ${uaInfo.current.substring(0, 50)}...\n` +
          `Cookie状态: ${this.getCookiesForHeader() ? '已设置' : '未设置'}, 长度: ${this.getCookiesForHeader().length}`;
        throw new Error(diagnosticInfo);
      case API_RESPONSE_CODES.FORBIDDEN:
        throw new Error(
          `权限不足，可能需要更高等级账号 (原始信息: ${originalMessage}) [错误码: ${response.code}]`,
        );
      case API_RESPONSE_CODES.TOO_FAST:
      case API_RESPONSE_CODES.TOO_FREQUENT:
      case API_RESPONSE_CODES.RATE_LIMITED:
        throw new Error(
          `请求过于频繁，请稍后再试 (原始信息: ${originalMessage}) [错误码: ${response.code}]`,
        );
      case API_RESPONSE_CODES.NOT_FOUND:
        throw new Error(
          `请求的资源不存在 (原始信息: ${originalMessage}) [错误码: ${response.code}]`,
        );
      case API_RESPONSE_CODES.USER_NOT_EXIST:
        throw new Error(`用户不存在 (原始信息: ${originalMessage}) [错误码: ${response.code}]`);
      default:
        throw new Error(fullErrorMessage);
    }
  }
}
