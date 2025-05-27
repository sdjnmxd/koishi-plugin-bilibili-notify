import md5 from 'md5';
import { Context, Logger } from 'koishi';

import { createLogger } from '../../utils/logger';
import { API_ENDPOINTS, BILIBILI_DOMAINS, WBI_CONFIG } from '../../constants';

import { BilibiliHttpService } from './BilibiliHttpService';

export class BilibiliWbi {
  private logger: Logger;
  private httpService: BilibiliHttpService;

  // WBI密钥缓存
  private wbiKeys: { img_key: string; sub_key: string } | null = null;
  private wbiKeysExpiry: number = 0;

  // WBI签名混淆表
  private readonly mixinKeyEncTab = WBI_CONFIG.MIXIN_KEY_ENC_TAB;

  constructor(ctx: Context, httpService?: BilibiliHttpService) {
    this.logger = createLogger(ctx, 'WBI');
    this.httpService = httpService || new BilibiliHttpService(ctx);
  }

  /**
   * 获取WBI密钥
   */
  async getWbiKeys(): Promise<{ img_key: string; sub_key: string }> {
    // 检查缓存是否有效
    if (this.wbiKeys && Date.now() < this.wbiKeysExpiry) {
      return this.wbiKeys;
    }

    try {
      const response = await this.httpService.getWithRetry<any>(
        BILIBILI_DOMAINS.API + API_ENDPOINTS.NAV,
      );

      const { img_url, sub_url } = response.data.wbi_img;

      this.wbiKeys = {
        img_key: img_url.slice(img_url.lastIndexOf('/') + 1, img_url.lastIndexOf('.')),
        sub_key: sub_url.slice(sub_url.lastIndexOf('/') + 1, sub_url.lastIndexOf('.')),
      };

      // 设置缓存过期时间
      this.wbiKeysExpiry = Date.now() + WBI_CONFIG.CACHE_DURATION;

      this.logger.debug('WBI密钥获取成功');
      return this.wbiKeys;
    } catch (error) {
      this.logger.error('获取WBI密钥失败:', error.message);
      // 如果有缓存的密钥，即使过期也使用
      if (this.wbiKeys) {
        this.logger.warn('使用过期的缓存WBI密钥');
        return this.wbiKeys;
      }
      throw new Error('获取WBI密钥失败');
    }
  }

  /**
   * 生成带WBI签名的查询字符串
   */
  async getWbi(params: { [key: string]: string | number | object }): Promise<string> {
    const web_keys = await this.getWbiKeys();
    const img_key = web_keys.img_key;
    const sub_key = web_keys.sub_key;
    return this.encWbi(params, img_key, sub_key);
  }

  /**
   * 清除WBI密钥缓存
   */
  clearCache(): void {
    this.wbiKeys = null;
    this.wbiKeysExpiry = 0;
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      hasCache: !!this.wbiKeys,
      isExpired: Date.now() >= this.wbiKeysExpiry,
      expiryTime: this.wbiKeysExpiry,
      img_key: this.wbiKeys?.img_key || null,
      sub_key: this.wbiKeys?.sub_key || null,
    };
  }

  /**
   * 获取混淆后的密钥
   */
  private getMixinKey(orig: string): string {
    return this.mixinKeyEncTab
      .map(n => orig[n])
      .join('')
      .slice(0, WBI_CONFIG.MIXIN_KEY_LENGTH);
  }

  /**
   * 生成WBI签名
   */
  private encWbi(
    params: { [key: string]: string | number | object },
    img_key: string,
    sub_key: string,
  ): string {
    const mixinKey = this.getMixinKey(img_key + sub_key);
    const currTime = Math.round(Date.now() / 1000);

    Object.assign(params, { wts: currTime });

    // 按照 key 重排参数
    const query = Object.keys(params)
      .sort()
      .map(key => {
        // 过滤 value 中的特殊字符
        const value = params[key].toString().replace(WBI_CONFIG.CHAR_FILTER, '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      })
      .join('&');

    const wbiSign = md5(query + mixinKey); // 计算 w_rid

    return `${query}&w_rid=${wbiSign}`;
  }
}
