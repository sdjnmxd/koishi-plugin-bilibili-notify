import { Context, Logger } from 'koishi';
import { Service } from '../../types/base';
import { AllDynamicInfo } from '../../types/subscription';
import { createLogger } from '../../utils/logger';

export interface FilterRule {
  id: string;
  name: string;
  type: 'keyword' | 'user' | 'content_type' | 'repost' | 'custom';
  enabled: boolean;
  config: any;
}

export interface KeywordFilterConfig {
  keywords: string[];
  mode: 'include' | 'exclude';
  caseSensitive: boolean;
}

export interface UserFilterConfig {
  userIds: string[];
  mode: 'include' | 'exclude';
}

export interface ContentTypeFilterConfig {
  allowedTypes: string[];
}

export interface RepostFilterConfig {
  allowReposts: boolean;
  maxRepostDepth: number;
}

export interface FilterResult {
  passed: boolean;
  reason?: string;
  matchedRules: string[];
}

export class AdvancedFilterService extends Service {
  public logger: Logger;
  private rules: FilterRule[] = [];

  constructor(ctx: Context) {
    super(ctx, {});
    this.logger = createLogger(ctx, 'FILTER');
    this.initializeDefaultFilters();
  }

  /**
   * 添加过滤器
   */
  addFilter(filter: FilterRule): void {
    this.rules.push(filter);
  }

  /**
   * 移除过滤器
   */
  removeFilter(filterId: string): boolean {
    const index = this.rules.findIndex(f => f.id === filterId);
    if (index !== -1) {
      const removed = this.rules.splice(index, 1);
      this.logger.info(`移除过滤器: ${filterId}`);
      return true;
    }
    return false;
  }

  /**
   * 启用/禁用过滤器
   */
  toggleFilter(filterId: string, enabled: boolean): boolean {
    const filter = this.rules.find(f => f.id === filterId);
    if (filter) {
      filter.enabled = enabled;
      this.logger.info(`${enabled ? '启用' : '禁用'}过滤器: ${filter.name}`);
      return true;
    }
    return false;
  }

  /**
   * 更新过滤器配置
   */
  updateFilterConfig(filterId: string, config: any): boolean {
    const filter = this.rules.find(f => f.id === filterId);
    if (filter) {
      filter.config = { ...filter.config, ...config };
      this.logger.info(`更新过滤器配置: ${filter.name}`);
      return true;
    }
    return false;
  }

  /**
   * 获取所有过滤器
   */
  getAllFilters(): FilterRule[] {
    return this.rules.slice();
  }

  /**
   * 获取启用的过滤器
   */
  getEnabledFilters(): FilterRule[] {
    return this.rules.filter(f => f.enabled);
  }

  /**
   * 过滤动态
   */
  async filterDynamic(dynamic: AllDynamicInfo, userFilters?: FilterRule[]): Promise<FilterResult> {
    const filtersToApply = userFilters || this.getEnabledFilters();
    const matchedRules: string[] = [];

    for (const filter of filtersToApply) {
      if (!filter.enabled) continue;

      const result = await this.applyFilter(dynamic, filter);

      if (!result.passed) {
        return {
          passed: false,
          reason: result.reason,
          matchedRules: [filter.id],
        };
      }

      if (result.matched) {
        matchedRules.push(filter.id);
      }
    }

    return {
      passed: true,
      matchedRules,
    };
  }

  /**
   * 批量过滤动态
   */
  async filterDynamics(
    dynamics: AllDynamicInfo[],
    userFilters?: FilterRule[],
  ): Promise<{
    passed: AllDynamicInfo[];
    filtered: { dynamic: AllDynamicInfo; reason: string }[];
  }> {
    const passed: AllDynamicInfo[] = [];
    const filtered: { dynamic: AllDynamicInfo; reason: string }[] = [];

    for (const dynamic of dynamics) {
      const result = await this.filterDynamic(dynamic, userFilters);

      if (result.passed) {
        passed.push(dynamic);
      } else {
        filtered.push({
          dynamic,
          reason: result.reason || '未知原因',
        });
      }
    }

    return { passed, filtered };
  }

  /**
   * 获取过滤统计
   */
  getFilterStats(): {
    totalFilters: number;
    enabledFilters: number;
    filtersByType: Record<string, number>;
  } {
    const allFilters = this.getAllFilters();
    const enabledFilters = this.getEnabledFilters();

    const filtersByType: Record<string, number> = {};
    for (const filter of allFilters) {
      filtersByType[filter.type] = (filtersByType[filter.type] || 0) + 1;
    }

    return {
      totalFilters: allFilters.length,
      enabledFilters: enabledFilters.length,
      filtersByType,
    };
  }

  /**
   * 初始化默认过滤器
   */
  private initializeDefaultFilters(): void {
    // 默认关键词过滤器
    this.addFilter({
      id: 'default-keyword',
      name: '关键词过滤',
      type: 'keyword',
      enabled: true,
      config: {
        keywords: [],
        mode: 'include',
        caseSensitive: false,
      } as KeywordFilterConfig,
    });

    // 默认转发过滤器
    this.addFilter({
      id: 'default-repost',
      name: '转发过滤',
      type: 'repost',
      enabled: false,
      config: {
        allowReposts: true,
        maxRepostDepth: 1,
      } as RepostFilterConfig,
    });

    // 默认内容类型过滤器
    this.addFilter({
      id: 'default-content-type',
      name: '内容类型过滤',
      type: 'content_type',
      enabled: false,
      config: {
        allowedTypes: ['DYNAMIC_TYPE_AV', 'DYNAMIC_TYPE_DRAW', 'DYNAMIC_TYPE_WORD'],
      } as ContentTypeFilterConfig,
    });
  }

  /**
   * 应用单个过滤器
   */
  private async applyFilter(
    dynamic: AllDynamicInfo,
    filter: FilterRule,
  ): Promise<{ passed: boolean; reason?: string; matched?: boolean }> {
    try {
      switch (filter.type) {
        case 'keyword':
          return this.applyKeywordFilter(dynamic, filter.config as KeywordFilterConfig);

        case 'user':
          return this.applyUserFilter(dynamic, filter.config as UserFilterConfig);

        case 'content_type':
          return this.applyContentTypeFilter(dynamic, filter.config as ContentTypeFilterConfig);

        case 'repost':
          return this.applyRepostFilter(dynamic, filter.config as RepostFilterConfig);

        case 'custom':
          return this.applyCustomFilter(dynamic, filter.config);

        default:
          return { passed: true };
      }
    } catch (error) {
      this.logger.error(`应用过滤器失败 (${filter.id}):`, error);
      return { passed: true }; // 过滤器错误时默认通过
    }
  }

  /**
   * 关键词过滤
   */
  private applyKeywordFilter(
    dynamic: AllDynamicInfo,
    config: KeywordFilterConfig,
  ): { passed: boolean; reason?: string; matched?: boolean } {
    // 从AllDynamicInfo结构中提取文本内容
    const text = this.extractTextFromDynamic(dynamic).toLowerCase();
    const { keywords, mode, caseSensitive } = config;

    const searchText = caseSensitive ? this.extractTextFromDynamic(dynamic) : text;

    // 检查排除关键词
    if (mode === 'exclude' && keywords && keywords.length > 0) {
      for (const keyword of keywords) {
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        if (searchText.includes(searchKeyword)) {
          return { passed: false, reason: `包含排除关键词: ${keyword}`, matched: true };
        }
      }
    }

    // 检查包含关键词
    if (mode === 'include' && keywords && keywords.length > 0) {
      let hasIncludeKeyword = false;
      for (const keyword of keywords) {
        const searchKeyword = caseSensitive ? keyword : keyword.toLowerCase();
        if (searchText.includes(searchKeyword)) {
          hasIncludeKeyword = true;
          break;
        }
      }

      if (!hasIncludeKeyword) {
        return { passed: false, reason: '不包含必需关键词', matched: false };
      }
    }

    return { passed: true, matched: true };
  }

  /**
   * 从动态中提取文本内容
   */
  private extractTextFromDynamic(dynamic: AllDynamicInfo): string {
    if (!dynamic.data?.items?.length) return '';

    const item = dynamic.data.items[0];
    let text = '';

    // 提取描述文本
    if (item.modules?.module_dynamic?.desc?.text) {
      text += item.modules.module_dynamic.desc.text;
    }

    // 提取opus内容
    if (item.modules?.module_dynamic?.major?.opus?.summary?.rich_text_nodes) {
      const nodes = item.modules.module_dynamic.major.opus.summary.rich_text_nodes;
      for (const node of nodes) {
        if (node.text) {
          text += node.text;
        }
      }
    }

    return text;
  }

  /**
   * 用户过滤
   */
  private applyUserFilter(
    dynamic: AllDynamicInfo,
    config: UserFilterConfig,
  ): { passed: boolean; reason?: string; matched?: boolean } {
    const { userIds, mode } = config;

    if (!dynamic.data?.items?.length) return { passed: true, matched: false };

    const item = dynamic.data.items[0];
    const uid = item.modules?.module_author?.mid?.toString();
    const uname = item.modules?.module_author?.name;

    // 检查黑名单用户
    if (mode === 'exclude' && userIds && userIds.length > 0) {
      if (userIds.includes(uid) || userIds.includes(uname)) {
        return { passed: false, reason: `用户在黑名单中: ${uname}`, matched: true };
      }
    }

    // 检查白名单用户
    if (mode === 'include' && userIds && userIds.length > 0) {
      if (!userIds.includes(uid) && !userIds.includes(uname)) {
        return { passed: false, reason: `用户不在白名单中: ${uname}`, matched: false };
      }
    }

    return { passed: true, matched: true };
  }

  /**
   * 内容类型过滤
   */
  private applyContentTypeFilter(
    dynamic: AllDynamicInfo,
    config: ContentTypeFilterConfig,
  ): { passed: boolean; reason?: string; matched?: boolean } {
    const { allowedTypes } = config;

    if (!dynamic.data?.items?.length) return { passed: true, matched: false };

    const item = dynamic.data.items[0];
    const type = item.type;

    // 检查禁止的类型
    if (allowedTypes && allowedTypes.length > 0) {
      if (!allowedTypes.includes(type)) {
        return { passed: false, reason: `内容类型不被允许: ${type}`, matched: false };
      }
    }

    return { passed: true, matched: true };
  }

  /**
   * 转发过滤
   */
  private applyRepostFilter(
    dynamic: AllDynamicInfo,
    config: RepostFilterConfig,
  ): { passed: boolean; reason?: string; matched?: boolean } {
    const { allowReposts, maxRepostDepth } = config;

    if (!dynamic.data?.items?.length) return { passed: true, matched: false };

    const item = dynamic.data.items[0];
    const isRepost = item.type === 'DYNAMIC_TYPE_FORWARD';

    // 如果不允许转发
    if (!allowReposts && isRepost) {
      return { passed: false, reason: '不允许转发内容', matched: true };
    }

    // TODO: 实现转发深度检查
    // 这需要递归解析转发链
    if (maxRepostDepth !== undefined && isRepost) {
      // 暂时简单处理，认为所有转发都是1层深度
      if (maxRepostDepth < 1) {
        return { passed: false, reason: `转发深度超过限制: ${maxRepostDepth}`, matched: true };
      }
    }

    return { passed: true, matched: true };
  }

  /**
   * 自定义过滤器
   */
  private applyCustomFilter(
    dynamic: AllDynamicInfo,
    config: any,
  ): { passed: boolean; reason?: string; matched?: boolean } {
    // 这里可以实现自定义过滤逻辑
    // 例如基于时间、互动数据等的过滤

    // 示例：基于发布时间的过滤
    if (config.minAge || config.maxAge) {
      if (!dynamic.data?.items?.length) return { passed: true, matched: false };

      const item = dynamic.data.items[0];
      const pubTime = item.modules?.module_author?.pub_ts;

      if (pubTime) {
        const now = Math.floor(Date.now() / 1000);
        const age = now - pubTime;

        if (config.minAge && age < config.minAge) {
          return { passed: false, reason: '内容太新', matched: true };
        }

        if (config.maxAge && age > config.maxAge) {
          return { passed: false, reason: '内容太旧', matched: true };
        }
      }
    }

    return { passed: true, matched: true };
  }
}

declare module 'koishi' {
  interface Context {
    advancedFilterService: AdvancedFilterService;
  }
}
