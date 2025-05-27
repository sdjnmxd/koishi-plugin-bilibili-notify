import { Context, Logger, Schema } from 'koishi';
import { createLogger } from '../utils/logger';

// 订阅目标配置
export interface SubscriptionTarget {
  platform: string;
  channelId: string;
  dynamic: boolean;
  live: boolean;
  liveGuardBuy: boolean;
  atAll: boolean;
}

// 卡片样式配置
export interface CardStyle {
  enable: boolean;
  cardColorStart: string;
  cardColorEnd: string;
  cardBasePlateColor: string;
  cardBasePlateBorder: string;
}

// 订阅项配置
export interface SubscriptionItem {
  uid: string;
  name?: string;
  dynamic: boolean;
  live: boolean;
  targets: SubscriptionTarget[];
  card?: CardStyle;
}

// 主人配置
export interface MasterConfig {
  enable: boolean;
  platform: string;
  account: string;
  guildId?: string;
}

// 推送设置配置
export interface PushSettings {
  restartPush: boolean;
  pushTime: number;
  pushImgsInDynamic: boolean;
  dynamicUrl: boolean;
}

// 自定义消息配置
export interface CustomMessages {
  liveStart: string;
  live: string;
  liveEnd: string;
}

// 弹幕监听配置
export interface DanmakuConfig {
  enable: boolean;
  maxConnections: number;
  reconnectInterval: number;
  heartbeatInterval: number;
  enableGuardBuy: boolean;
  enableViewerCount: boolean;
}

// 图片生成配置
export interface ImageConfig {
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  showAvatar: boolean;
  showImages: boolean;
  maxImageCount: number;
}

// 过滤配置
export interface FilterConfig {
  enableKeywordFilter: boolean;
  excludeKeywords: string[];
  includeKeywords: string[];
  enableRepostFilter: boolean;
  allowReposts: boolean;
}

// 样式配置
export interface StyleConfig {
  removeBorder: boolean;
  cardColorStart: string;
  cardColorEnd: string;
  cardBasePlateColor: string;
  cardBasePlateBorder: string;
  enableLargeFont: boolean;
  font: string;
  hideDesc: boolean;
  followerDisplay: boolean;
}

// 统一配置接口
export interface UnifiedConfig {
  // API设置
  customUserAgents: string;

  // 订阅配置
  subscriptions: SubscriptionItem[];

  // 主人设置
  master: MasterConfig;

  // 推送设置
  pushSettings: PushSettings;

  // 自定义消息
  customMessages: CustomMessages;

  // 检测间隔设置
  dynamicInterval: number;
  liveInterval: number;

  // 功能开关
  enableDynamic: boolean;
  enableLive: boolean;
  enableImageGeneration: boolean;
  enableAdvancedFilter: boolean;

  // 弹幕监听设置
  danmakuConfig: DanmakuConfig;

  // 图片生成设置
  imageConfig: ImageConfig;

  // 过滤设置
  filterConfig: FilterConfig;

  // 样式设置
  style: StyleConfig;

  // 调试设置
  debug: boolean;
}

// 配置Schema定义
export const UnifiedConfigSchema: Schema<UnifiedConfig> = Schema.object({
  customUserAgents: Schema.string()
    .role('textarea', { rows: 6 })
    .default(
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0`,
    )
    .description('User-Agent列表，一行一个。系统会自动轮换使用以避免-352风控错误。'),

  subscriptions: Schema.array(
    Schema.object({
      uid: Schema.string().required().description('用户UID'),
      name: Schema.string().description('用户昵称（备注）'),
      dynamic: Schema.boolean().default(false).description('是否订阅用户动态'),
      live: Schema.boolean().default(false).description('是否订阅用户直播'),
      targets: Schema.array(
        Schema.object({
          platform: Schema.string().required().description('推送平台（如onebot、qq、discord）'),
          channelId: Schema.string().required().description('频道/群组号'),
          dynamic: Schema.boolean().default(false).description('该频道/群组是否推送动态信息'),
          live: Schema.boolean().default(false).description('该频道/群组是否推送直播通知'),
          liveGuardBuy: Schema.boolean().default(false).description('该频道/群组是否推送上舰消息'),
          atAll: Schema.boolean().default(false).description('推送开播通知时是否艾特全体成员'),
        }),
      )
        .role('table')
        .required()
        .description('推送目标配置'),
      card: Schema.object({
        enable: Schema.boolean().default(false).description('启用自定义卡片样式'),
        cardColorStart: Schema.string().default('#74b9ff').description('卡片渐变起始颜色'),
        cardColorEnd: Schema.string().default('#0984e3').description('卡片渐变结束颜色'),
        cardBasePlateColor: Schema.string().default('#ffffff').description('卡片底板颜色'),
        cardBasePlateBorder: Schema.string().default('0px').description('卡片底板边框'),
      }).description('自定义卡片样式（可选）'),
    }),
  )
    .role('table')
    .description('订阅列表 - 手动配置订阅信息，支持自定义推送目标和样式'),

  master: Schema.object({
    enable: Schema.boolean().default(false).description('启用主人功能'),
    platform: Schema.string().default('onebot').description('主人所在平台'),
    account: Schema.string().description('主人账号ID'),
    guildId: Schema.string().description('主人所在服务器/群组ID'),
  }).description('主人设置 - 配置插件管理员权限'),

  pushSettings: Schema.object({
    restartPush: Schema.boolean().default(false).description('重启时推送通知'),
    pushTime: Schema.number().default(1).description('推送检测间隔（小时）'),
    pushImgsInDynamic: Schema.boolean().default(true).description('推送动态中的图片'),
    dynamicUrl: Schema.boolean().default(true).description('推送动态链接'),
  }).description('推送设置'),

  customMessages: Schema.object({
    liveStart: Schema.string()
      .role('textarea')
      .default('🔴 {name} 开始直播啦！\n📺 {title}\n🔗 {url}')
      .description('开播消息模板'),
    live: Schema.string()
      .role('textarea')
      .default('🔴 {name} 正在直播\n📺 {title}\n👥 观看人数：{online}')
      .description('直播中消息模板'),
    liveEnd: Schema.string()
      .role('textarea')
      .default('⚫ {name} 直播结束了')
      .description('下播消息模板'),
  }).description('自定义消息模板 - 支持变量：{name}、{title}、{url}、{online}'),

  dynamicInterval: Schema.number()
    .min(1)
    .default(2)
    .description('动态检测间隔（分钟），建议不少于1分钟'),

  liveInterval: Schema.number()
    .min(15)
    .default(30)
    .description('直播检测间隔（秒），建议不少于15秒'),

  enableDynamic: Schema.boolean().default(true).description('启用动态检测'),

  enableLive: Schema.boolean().default(true).description('启用直播监听'),

  enableImageGeneration: Schema.boolean().default(true).description('启用图片生成'),

  enableAdvancedFilter: Schema.boolean().default(false).description('启用高级过滤'),

  danmakuConfig: Schema.object({
    enable: Schema.boolean().default(false).description('启用弹幕监听'),
    maxConnections: Schema.number().default(5).description('最大连接数'),
    reconnectInterval: Schema.number().default(30).description('重连间隔（秒）'),
    heartbeatInterval: Schema.number().default(10).description('心跳间隔（秒）'),
    enableGuardBuy: Schema.boolean().default(false).description('启用上舰消息监听'),
    enableViewerCount: Schema.boolean().default(false).description('启用观看人数监听'),
  }).description('弹幕监听配置'),

  imageConfig: Schema.object({
    width: Schema.number().default(800).description('图片宽度'),
    height: Schema.number().default(600).description('图片高度'),
    backgroundColor: Schema.string().default('#ffffff').description('背景颜色'),
    textColor: Schema.string().default('#333333').description('文字颜色'),
    accentColor: Schema.string().default('#00a1d6').description('强调色'),
    showAvatar: Schema.boolean().default(true).description('显示头像'),
    showImages: Schema.boolean().default(true).description('显示图片'),
    maxImageCount: Schema.number().default(4).description('最大图片数量'),
  }).description('图片生成配置'),

  filterConfig: Schema.object({
    enableKeywordFilter: Schema.boolean().default(false).description('启用关键词过滤'),
    excludeKeywords: Schema.array(String).default(['广告', '推广']).description('排除关键词'),
    includeKeywords: Schema.array(String).default([]).description('包含关键词'),
    enableRepostFilter: Schema.boolean().default(false).description('启用转发过滤'),
    allowReposts: Schema.boolean().default(true).description('允许转发'),
  }).description('过滤配置'),

  style: Schema.object({
    removeBorder: Schema.boolean().default(false).description('移除卡片边框'),
    cardColorStart: Schema.string().default('#74b9ff').description('默认卡片渐变起始颜色'),
    cardColorEnd: Schema.string().default('#0984e3').description('默认卡片渐变结束颜色'),
    cardBasePlateColor: Schema.string().default('#ffffff').description('默认卡片底板颜色'),
    cardBasePlateBorder: Schema.string().default('0px').description('默认卡片底板边框'),
    enableLargeFont: Schema.boolean().default(false).description('启用大字体'),
    font: Schema.string().default('Microsoft YaHei').description('字体设置'),
    hideDesc: Schema.boolean().default(false).description('隐藏用户简介'),
    followerDisplay: Schema.boolean().default(true).description('显示粉丝数'),
  }).description('全局样式设置'),

  debug: Schema.boolean().default(false).description('调试模式'),
});

/**
 * 统一配置管理器
 */
export class UnifiedConfigManager {
  private logger: Logger;
  private config: UnifiedConfig;
  private changeListeners: Array<(config: UnifiedConfig) => void> = [];

  constructor(
    private ctx: Context,
    config: UnifiedConfig,
  ) {
    this.logger = createLogger(ctx, 'CONFIG');
    this.config = { ...config };

    // 监听配置变更
    this.ctx.on('config', () => {
      // 从上下文获取最新配置
      const newConfig = this.ctx.config as UnifiedConfig;
      this.updateConfig(newConfig);
    });
  }

  /**
   * 获取完整配置
   */
  getConfig(): UnifiedConfig {
    return { ...this.config };
  }

  /**
   * 获取特定配置项
   */
  get<K extends keyof UnifiedConfig>(key: K): UnifiedConfig[K] {
    return this.config[key];
  }

  /**
   * 设置特定配置项
   */
  set<K extends keyof UnifiedConfig>(key: K, value: UnifiedConfig[K]): void {
    const oldValue = this.config[key];
    this.config[key] = value;
    this.logger.debug(`配置项 ${key} 已更新`);

    // 通知监听器
    this.notifyChange();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<UnifiedConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    this.logger.info('配置已更新');

    // 通知监听器
    this.notifyChange();
  }

  /**
   * 添加配置变更监听器
   */
  onConfigChange(listener: (config: UnifiedConfig) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * 移除配置变更监听器
   */
  removeConfigChangeListener(listener: (config: UnifiedConfig) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * 验证配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证订阅配置
    if (!this.config.subscriptions || this.config.subscriptions.length === 0) {
      errors.push('至少需要配置一个订阅');
    } else {
      this.config.subscriptions.forEach((sub, index) => {
        if (!sub.uid) {
          errors.push(`订阅 ${index + 1}: 缺少用户UID`);
        }
        if (!sub.dynamic && !sub.live) {
          errors.push(`订阅 ${index + 1}: 至少需要启用动态或直播订阅`);
        }
        if (!sub.targets || sub.targets.length === 0) {
          errors.push(`订阅 ${index + 1}: 至少需要配置一个推送目标`);
        }
      });
    }

    // 验证间隔设置
    if (this.config.dynamicInterval < 1) {
      errors.push('动态检测间隔不能少于1分钟');
    }
    if (this.config.liveInterval < 15) {
      errors.push('直播检测间隔不能少于15秒');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取配置统计信息
   */
  getStats() {
    const subscriptions = this.config.subscriptions || [];
    const dynamicSubs = subscriptions.filter(sub => sub.dynamic);
    const liveSubs = subscriptions.filter(sub => sub.live);

    let totalTargets = 0;
    const platformStats: Record<string, number> = {};

    subscriptions.forEach(sub => {
      sub.targets?.forEach(target => {
        totalTargets++;
        platformStats[target.platform] = (platformStats[target.platform] || 0) + 1;
      });
    });

    return {
      totalSubscriptions: subscriptions.length,
      dynamicSubscriptions: dynamicSubs.length,
      liveSubscriptions: liveSubs.length,
      totalTargets,
      platformStats,
      enabledFeatures: {
        dynamic: this.config.enableDynamic,
        live: this.config.enableLive,
        imageGeneration: this.config.enableImageGeneration,
        advancedFilter: this.config.enableAdvancedFilter,
        danmaku: this.config.danmakuConfig.enable,
      },
    };
  }

  /**
   * 通知配置变更
   */
  private notifyChange(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(this.getConfig());
      } catch (error) {
        this.logger.error('配置变更监听器执行失败:', error);
      }
    });
  }
}

// 导出类型别名以保持兼容性
export type Config = UnifiedConfig;
export const Config = UnifiedConfigSchema;
