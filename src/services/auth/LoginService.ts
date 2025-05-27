import { Context, Logger } from 'koishi';
import { BilibiliApiService } from '../bilibili/BilibiliApiService';
import { BilibiliNotifyLogin } from '../../database/models';
import { Service } from '../../types/base';
import { createLogger } from '../../utils/logger';

export interface QRCodeInfo {
  url: string;
  qrcode_key: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  cookies?: string;
  refresh_token?: string;
}

export class LoginService extends Service {
  public logger: Logger;
  private bilibiliApi: BilibiliApiService;

  constructor(ctx: Context) {
    super(ctx, {});
    this.logger = createLogger(ctx, 'AUTH');
    // 从上下文获取配置，如果没有则传入null
    const config = (ctx as any).config || null;
    this.bilibiliApi = new BilibiliApiService(ctx, config);
  }

  /**
   * 获取登录二维码
   */
  async getLoginQRCode(): Promise<QRCodeInfo> {
    try {
      const response = await this.ctx.http.get(
        'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        },
      );

      if (response.code === 0) {
        return {
          url: response.data.url,
          qrcode_key: response.data.qrcode_key,
        };
      } else {
        throw new Error(`获取二维码失败: ${response.message}`);
      }
    } catch (error) {
      this.logger.error('获取登录二维码失败:', error);
      throw error;
    }
  }

  /**
   * 轮询二维码登录状态
   */
  async pollQRCodeStatus(qrcode_key: string): Promise<LoginResult> {
    try {
      // 使用更详细的请求配置来获取完整响应
      const response = await this.ctx.http(
        'GET',
        'https://passport.bilibili.com/x/passport-login/web/qrcode/poll',
        {
          params: { qrcode_key },
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Referer: 'https://passport.bilibili.com/',
            Origin: 'https://passport.bilibili.com',
          },
          responseType: 'json',
        },
      );

      // 记录响应信息用于调试
      this.logger.debug('登录轮询响应:', {
        status: response.status,
        hasHeaders: !!response.headers,
        outerCode: response.data?.code,
        innerCode: response.data?.data?.code,
      });

      // B站API响应结构是嵌套的，真正的状态码在 data.data.code 中
      const outerResponse = response.data || response;
      if (outerResponse.code !== 0) {
        return { success: false, message: outerResponse.message || '请求失败' };
      }

      const { code, message, url, refresh_token } = outerResponse.data || {};

      switch (code) {
        case 0: // 登录成功
          // 尝试多种方式获取cookies
          let cookies = '';

          // 方法1: 从URL提取cookies（如果有的话）
          if (url) {
            cookies = this.extractCookiesFromUrl(url);
            if (cookies) {
              this.logger.info('从URL成功提取cookies');
            }
          }

          // 方法2: 从响应头获取cookies
          if (!cookies && response.headers) {
            const setCookieHeader =
              response.headers['set-cookie'] || response.headers['Set-Cookie'];
            if (setCookieHeader) {
              cookies = this.extractCookiesFromHeaders(setCookieHeader);
              if (cookies) {
                this.logger.info('从响应头成功提取cookies');
              }
            }
          }

          // 如果还是没有cookies，记录详细信息用于调试
          if (!cookies) {
            this.logger.error('无法获取登录cookies', {
              hasUrl: !!url,
              url: url,
              hasResponseHeaders: !!response.headers,
              hasSetCookie: !!(
                response.headers &&
                (response.headers['set-cookie'] || response.headers['Set-Cookie'])
              ),
              outerData: Object.keys(outerResponse || {}),
              innerData: Object.keys(outerResponse.data || {}),
              fullResponse: JSON.stringify(response, null, 2),
            });
            return { success: false, message: '登录信息提取失败，请重试' };
          }

          // 保存登录信息到数据库
          await this.saveLoginInfo(cookies, refresh_token);

          // 立即设置cookies到API服务
          this.bilibiliApi.setCookies(cookies);
          this.logger.info('已将cookies设置到API服务');

          return {
            success: true,
            message: '登录成功',
            cookies,
            refresh_token,
          };

        case 86101: // 未扫码
          return { success: false, message: '请使用哔哩哔哩客户端扫描二维码' };

        case 86090: // 已扫码未确认
          return { success: false, message: '已扫码，请在手机上确认登录' };

        case 86038: // 二维码已失效
          return { success: false, message: '二维码已失效，请重新获取' };

        default:
          return { success: false, message: message || '未知错误' };
      }
    } catch (error) {
      this.logger.error('轮询二维码状态失败:', error);
      return { success: false, message: '网络错误，请重试' };
    }
  }

  /**
   * 检查登录状态
   */
  async getLoginStatus(): Promise<{ isLoggedIn: boolean; userInfo?: any }> {
    try {
      const loginInfo = await this.getStoredLoginInfo();
      if (!loginInfo?.bili_cookies) {
        return { isLoggedIn: false };
      }

      // 设置cookies到API服务
      this.bilibiliApi.setCookies(loginInfo.bili_cookies);

      // 直接使用API服务检查登录状态
      const loginStatusResult = await this.bilibiliApi.getLoginStatus();

      if (loginStatusResult.success && loginStatusResult.data?.isLogin) {
        // 登录有效，返回用户信息
        return {
          isLoggedIn: true,
          userInfo: {
            uid: loginStatusResult.data.uid,
            name: loginStatusResult.data.uname,
            face: loginStatusResult.data.face,
            level: loginStatusResult.data.level,
          },
        };
      } else {
        // Cookie无效或已过期
        this.logger.warn('Cookie已失效，需要重新登录');
        return { isLoggedIn: false };
      }
    } catch (error) {
      this.logger.error('检查登录状态失败:', error);
      return { isLoggedIn: false };
    }
  }

  /**
   * 获取存储的登录信息
   */
  async getStoredLoginInfo(): Promise<BilibiliNotifyLogin | null> {
    try {
      const loginInfos = await this.ctx.database.get('bilibili-notify-modern-login', {});
      return loginInfos.length > 0 ? loginInfos[0] : null;
    } catch (error) {
      this.logger.error('获取存储的登录信息失败:', error);
      return null;
    }
  }

  /**
   * 获取当前cookies
   */
  async getCurrentCookies(): Promise<string | null> {
    const loginInfo = await this.getStoredLoginInfo();
    return loginInfo?.bili_cookies || null;
  }

  /**
   * 刷新cookies
   */
  async refreshCookies(): Promise<boolean> {
    try {
      const loginInfo = await this.getStoredLoginInfo();
      if (!loginInfo?.bili_refresh_token) {
        this.logger.warn('没有refresh_token，无法刷新cookies');
        return false;
      }

      const response = await this.ctx.http.post(
        'https://passport.bilibili.com/x/passport-login/web/cookie/refresh',
        {
          refresh_token: loginInfo.bili_refresh_token,
        },
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        },
      );

      if (response.code === 0) {
        const newCookies = response.data.cookie;
        const newRefreshToken = response.data.refresh_token;

        await this.saveLoginInfo(newCookies, newRefreshToken);
        this.logger.info('cookies刷新成功');
        return true;
      } else {
        this.logger.error('刷新cookies失败:', response.message);
        return false;
      }
    } catch (error) {
      this.logger.error('刷新cookies时发生错误:', error);
      return false;
    }
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    try {
      await this.ctx.database.remove('bilibili-notify-modern-login', {});
    } catch (error) {
      this.logger.error('登出失败:', error);
      throw error;
    }
  }

  /**
   * 从URL中提取cookies
   */
  private extractCookiesFromUrl(url: string): string {
    // 检查URL是否有效
    if (!url || typeof url !== 'string' || url.trim() === '') {
      this.logger.warn('收到空的URL，无法提取cookies');
      return '';
    }

    try {
      const urlObj = new URL(url);
      const cookies: string[] = [];

      // 提取关键cookie参数
      const params = ['DedeUserID', 'DedeUserID__ckMd5', 'SESSDATA', 'bili_jct'];

      for (const param of params) {
        const value = urlObj.searchParams.get(param);
        if (value) {
          cookies.push(`${param}=${value}`);
        }
      }

      return cookies.join('; ');
    } catch (error) {
      this.logger.error(`URL解析失败: ${url}`, error);
      return '';
    }
  }

  /**
   * 从响应头中提取cookies
   */
  private extractCookiesFromHeaders(setCookieHeaders: string | string[]): string {
    try {
      const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
      const cookies: string[] = [];

      // 需要的关键cookie参数
      const requiredCookies = ['DedeUserID', 'DedeUserID__ckMd5', 'SESSDATA', 'bili_jct'];

      for (const header of headers) {
        // 解析每个Set-Cookie头
        const cookieParts = header.split(';')[0]; // 只取cookie名值对部分
        const [name, value] = cookieParts.split('=');

        if (name && value && requiredCookies.includes(name.trim())) {
          cookies.push(`${name.trim()}=${value.trim()}`);
        }
      }

      return cookies.join('; ');
    } catch (error) {
      this.logger.error('从响应头提取cookies失败:', error);
      return '';
    }
  }

  /**
   * 保存登录信息到数据库
   */
  private async saveLoginInfo(cookies: string, refresh_token: string): Promise<void> {
    try {
      // 检查是否已存在登录信息
      const existing = await this.ctx.database.get('bilibili-notify-modern-login', {});

      if (existing.length > 0) {
        // 更新现有记录
        await this.ctx.database.set(
          'bilibili-notify-modern-login',
          { id: existing[0].id },
          {
            bili_cookies: cookies,
            bili_refresh_token: refresh_token,
            updated_at: new Date(),
          },
        );
      } else {
        // 创建新记录
        await this.ctx.database.create('bilibili-notify-modern-login', {
          bili_cookies: cookies,
          bili_refresh_token: refresh_token,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      this.logger.info('登录信息已保存到数据库');
    } catch (error) {
      this.logger.error('保存登录信息失败:', error);
      throw error;
    }
  }
}

declare module 'koishi' {
  interface Context {
    loginService: LoginService;
  }
}
