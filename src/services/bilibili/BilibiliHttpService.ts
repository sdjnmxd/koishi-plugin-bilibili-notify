import { Context, HTTP, Logger } from 'koishi';
import {
  BILIBILI_DOMAINS,
  COOKIE_CONFIG,
  DEFAULT_REQUEST_USER_AGENT,
  HTTP_CONFIG,
} from '../../constants';
import { createLogger } from '../../utils/logger';

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  includeCookies?: boolean;
  customReferer?: string;
  customOrigin?: string;

  [key: string]: any;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  retryCondition?: (error: any) => boolean;
}

export interface RateLimitConfig {
  minInterval?: number;
  maxInterval?: number;
  startupGracePeriod?: number;
  normalGracePeriod?: number;
}

export class BilibiliHttpService {
  private logger: Logger;
  private http: HTTP;
  private ctx: Context;

  // Cookie管理
  private cookies: string = '';

  // User-Agent管理
  private currentUserAgentIndex = 0;
  private userAgents: string[] = [];

  // 频率限制
  private lastRequestTime: number = 0;
  private startupTime: number = Date.now();
  private readonly defaultRateLimitConfig: Required<RateLimitConfig> = {
    minInterval: HTTP_CONFIG.MIN_REQUEST_INTERVAL,
    maxInterval: HTTP_CONFIG.MAX_REQUEST_INTERVAL,
    startupGracePeriod: HTTP_CONFIG.STARTUP_GRACE_PERIOD,
    normalGracePeriod: HTTP_CONFIG.NORMAL_GRACE_PERIOD,
  };

  // 配置
  private pluginConfig: any;

  constructor(ctx: Context, config?: any) {
    this.ctx = ctx;
    this.logger = createLogger(ctx, 'HTTP');
    this.http = ctx.http;
    this.pluginConfig = config;
    this.initializeUserAgents();
  }

  /**
   * 重新加载User-Agent配置
   */
  reloadUserAgents(): void {
    this.initializeUserAgents();
    this.currentUserAgentIndex = 0;
  }

  /**
   * 轮换User-Agent
   */
  rotateUserAgent(): void {
    this.currentUserAgentIndex = (this.currentUserAgentIndex + 1) % this.userAgents.length;
  }

  /**
   * 获取当前User-Agent信息
   */
  getCurrentUserAgentInfo(): { index: number; total: number; current: string } {
    return {
      index: this.currentUserAgentIndex + 1,
      total: this.userAgents.length,
      current: this.userAgents[this.currentUserAgentIndex] || DEFAULT_REQUEST_USER_AGENT[0],
    };
  }

  /**
   * 设置登录Cookie
   */
  setCookies(cookies: string): void {
    this.cookies = cookies;
    this.logger.debug(`已设置Cookie，长度: ${cookies.length}`);
  }

  /**
   * 获取用于请求头的Cookie字符串
   */
  getCookiesForHeader(): string {
    if (!this.cookies) {
      return '';
    }
    return this.sanitizeCookies(this.cookies);
  }

  /**
   * 获取完整的请求头
   */
  getHeaders(options: HttpRequestOptions = {}): Record<string, string> {
    const { includeCookies = true, customReferer, customOrigin } = options;

    // 按配置概率轮换UA
    if (Math.random() < HTTP_CONFIG.UA_ROTATION_PROBABILITY) {
      this.rotateUserAgent();
    }

    const headers: Record<string, string> = {
      'User-Agent': this.userAgents[this.currentUserAgentIndex] || DEFAULT_REQUEST_USER_AGENT[0],
      Referer: customReferer || BILIBILI_DOMAINS.MAIN + '/',
      Origin: customOrigin || BILIBILI_DOMAINS.MAIN,
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
    };

    if (includeCookies && this.cookies) {
      headers['Cookie'] = this.sanitizeCookies(this.cookies);
    }

    // 合并自定义头部
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  /**
   * 获取特殊请求头（用于弹幕等特殊API）
   */
  getSpecialHeaders(
    roomId?: string,
    additionalHeaders?: Record<string, string>,
  ): Record<string, string> {
    const baseHeaders = this.getHeaders({ includeCookies: true });

    const specialHeaders = {
      ...baseHeaders,
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
    };

    if (roomId) {
      specialHeaders['Referer'] = `${BILIBILI_DOMAINS.LIVE}/${roomId}`;
      specialHeaders['Origin'] = BILIBILI_DOMAINS.LIVE;
    }

    if (additionalHeaders) {
      Object.assign(specialHeaders, additionalHeaders);
    }

    return specialHeaders;
  }

  /**
   * 请求频率限制
   */
  async enforceRateLimit(config?: RateLimitConfig): Promise<void> {
    const rateLimitConfig = { ...this.defaultRateLimitConfig, ...config };
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const timeSinceStartup = now - this.startupTime;

    // 生成基础随机间隔
    let randomInterval =
      Math.floor(Math.random() * (rateLimitConfig.maxInterval - rateLimitConfig.minInterval + 1)) +
      rateLimitConfig.minInterval;

    // 如果是服务启动后的前30秒，使用更温和的延迟策略
    if (timeSinceStartup < rateLimitConfig.startupGracePeriod) {
      // 初始化阶段：2-4秒随机延迟
      randomInterval = Math.max(randomInterval, 2000 + Math.random() * 2000);
    } else if (timeSinceStartup < rateLimitConfig.normalGracePeriod) {
      // 启动后5分钟内，使用稍微保守的策略：5-8秒
      randomInterval = Math.max(randomInterval, 5000 + Math.random() * 3000);
    } else {
      // 正常运行时，使用标准间隔
      randomInterval = Math.max(randomInterval, rateLimitConfig.minInterval);
    }

    if (timeSinceLastRequest < randomInterval) {
      const waitTime = randomInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 智能重试策略
   */
  async smartRetry<T>(requestFn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      maxRetries = HTTP_CONFIG.DEFAULT_MAX_RETRIES,
      baseDelay = HTTP_CONFIG.BASE_RETRY_DELAY,
      maxDelay = HTTP_CONFIG.MAX_RETRY_DELAY,
      retryCondition = error => {
        // 如果是上下文非活跃错误，不进行重试
        if (error.code === 'INACTIVE_EFFECT' || error.message?.includes('服务上下文已停用')) {
          return false;
        }

        // 检查是否是可重试的错误
        const retryableCodes = [-503, -509, -799, -500, -352];

        // 如果错误消息包含错误码，从中提取
        if (error.message && typeof error.message === 'string') {
          const codeMatch = error.message.match(/API错误 \((-?\d+)\):/);
          if (codeMatch) {
            const errorCode = parseInt(codeMatch[1]);
            return retryableCodes.includes(errorCode);
          }

          // 检查是否包含-352相关的错误信息
          if (error.message.includes('-352') || error.message.includes('请求被风控')) {
            return true;
          }
        }

        // 检查error对象的code属性
        if (error.code !== undefined) {
          return retryableCodes.includes(error.code);
        }

        // 对于网络错误等未知错误，也进行重试
        return true;
      },
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 在每次重试前检查上下文状态
        if (!this.ctx.scope.isActive) {
          throw new Error('服务上下文已停用，停止重试');
        }

        return await requestFn();
      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试，直接抛出错误
        if (attempt === maxRetries) {
          break;
        }

        // 检查是否应该重试
        if (!retryCondition(error)) {
          break;
        }

        // 计算延迟时间（指数退避）
        let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

        // 对于-352风控错误，使用更长的延迟并轮换User-Agent
        if (error.message && error.message.includes('-352')) {
          delay = Math.max(
            delay,
            HTTP_CONFIG.RISK_CONTROL_MIN_DELAY +
            Math.random() *
            (HTTP_CONFIG.RISK_CONTROL_MAX_DELAY - HTTP_CONFIG.RISK_CONTROL_MIN_DELAY),
          );
          this.rotateUserAgent(); // 轮换User-Agent

          // 如果是第2次及以后的重试，使用更长的延迟
          if (attempt >= 1) {
            delay = Math.max(
              delay,
              HTTP_CONFIG.RISK_CONTROL_EXTENDED_MIN_DELAY +
              Math.random() *
              (HTTP_CONFIG.RISK_CONTROL_EXTENDED_MAX_DELAY -
                HTTP_CONFIG.RISK_CONTROL_EXTENDED_MIN_DELAY),
            );
          }

          this.logger.warn(
            `检测到风控错误，已轮换User-Agent并延长等待时间: ${Math.round(delay / 1000)}秒 (第${attempt + 1}次重试)`,
          );
        }

        this.logger.warn(`HTTP请求失败，${delay}ms后进行第${attempt + 1}次重试: ${error.message}`);

        // 等待延迟时间
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 通用GET请求
   */
  async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<T> {
    // 检查上下文是否活跃
    if (!this.ctx.scope.isActive) {
      throw new Error('服务上下文已停用，无法进行HTTP请求');
    }

    await this.enforceRateLimit();

    const headers = this.getHeaders(options);
    const requestOptions = {
      ...options,
      headers,
      timeout: options.timeout || HTTP_CONFIG.DEFAULT_TIMEOUT,
    };

    try {
      const response = await this.http.get(url, requestOptions);
      return response;
    } catch (error) {
      // 检查是否是上下文非活跃错误
      if (error.code === 'INACTIVE_EFFECT') {
        this.logger.warn(`HTTP请求被中断，服务上下文已停用: ${url}`);
        throw new Error('服务正在重启或停止中，请稍后重试');
      }

      this.logger.error(`HTTP GET请求失败 ${url}:`, error);
      throw error;
    }
  }

  /**
   * 通用POST请求
   */
  async post<T = any>(url: string, data?: any, options: HttpRequestOptions = {}): Promise<T> {
    // 检查上下文是否活跃
    if (!this.ctx.scope.isActive) {
      throw new Error('服务上下文已停用，无法进行HTTP请求');
    }

    await this.enforceRateLimit();

    const headers = this.getHeaders(options);
    const requestOptions = {
      ...options,
      headers,
      timeout: options.timeout || HTTP_CONFIG.DEFAULT_TIMEOUT,
    };

    try {
      const response = await this.http.post(url, data, requestOptions);
      return response;
    } catch (error) {
      // 检查是否是上下文非活跃错误
      if (error.code === 'INACTIVE_EFFECT') {
        this.logger.warn(`HTTP请求被中断，服务上下文已停用: ${url}`);
        throw new Error('服务正在重启或停止中，请稍后重试');
      }

      this.logger.error(`HTTP POST请求失败 ${url}:`, error);
      throw error;
    }
  }

  /**
   * 带重试的GET请求
   */
  async getWithRetry<T = any>(
    url: string,
    options: HttpRequestOptions = {},
    retryOptions?: RetryOptions,
  ): Promise<T> {
    return this.smartRetry(() => this.get<T>(url, options), retryOptions);
  }

  /**
   * 带重试的POST请求
   */
  async postWithRetry<T = any>(
    url: string,
    data?: any,
    options: HttpRequestOptions = {},
    retryOptions?: RetryOptions,
  ): Promise<T> {
    return this.smartRetry(() => this.post<T>(url, data, options), retryOptions);
  }

  /**
   * 重置服务状态（用于处理风控等异常情况）
   */
  resetServiceState(): void {
    this.lastRequestTime = 0;
    this.startupTime = Date.now();
    this.currentUserAgentIndex = Math.floor(Math.random() * this.userAgents.length);
    this.logger.info('HTTP服务状态已重置，将使用更保守的请求策略');
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      hasLogin: !!this.cookies,
      lastRequestTime: this.lastRequestTime,
      currentUserAgent: this.getCurrentUserAgentInfo(),
      startupTime: this.startupTime,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: any): void {
    this.pluginConfig = config;
    this.reloadUserAgents();
  }

  /**
   * 清理和验证Cookie字符串
   */
  sanitizeCookies(cookies: string): string {
    if (!cookies) return '';

    const cookieMap = new Map<string, string>();

    // 解析现有cookies
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && (COOKIE_CONFIG.ESSENTIAL_FIELDS as readonly string[]).includes(key) && value) {
        cookieMap.set(key.trim(), value.trim());
      }
    });

    // 如果没有buvid3，添加默认值
    if (!cookieMap.has('buvid3')) {
      cookieMap.set('buvid3', COOKIE_CONFIG.DEFAULT_BUVID3);
    }

    // 重新构建cookie字符串
    return Array.from(cookieMap.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  /**
   * 初始化User-Agent列表
   */
  private initializeUserAgents(): void {
    // 解析自定义User-Agent列表
    if (this.pluginConfig?.customUserAgents && this.pluginConfig.customUserAgents.trim()) {
      const customUAs = this.pluginConfig.customUserAgents
        .split('\n')
        .map((ua: string) => ua.trim())
        .filter((ua: string) => ua.length > 0);

      if (customUAs.length > 0) {
        this.userAgents = customUAs;
        this.logger.info(`已加载 ${customUAs.length} 个自定义User-Agent`);
        return;
      }
    }

    // 如果配置为空，使用内置默认UA列表
    this.userAgents = [...DEFAULT_REQUEST_USER_AGENT];
    this.logger.info(`使用默认User-Agent列表 (${this.userAgents.length} 个)`);
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
