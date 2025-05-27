import { Context, Logger } from 'koishi';
import { DynamicFilterConfig, DynamicType, FilterConfig } from '../../types';
import { Service } from '../../types/base';
import type { AllDynamicInfo } from '../../types/subscription';
import { createLogger } from '../../utils/logger';

export class BilibiliFilterService extends Service {
  private logger: Logger;

  constructor(ctx: Context) {
    super(ctx);
    this.logger = createLogger(ctx, 'FILTER');
  }

  /**
   * 检查动态是否应该被过滤
   */
  checkDynamicFilter(
    item: AllDynamicInfo['data']['items'][number],
    config: DynamicFilterConfig,
  ): string | null {
    if (!config.enable) return null;

    // 检查动态类型过滤
    if (config.forward && item.type === DynamicType.Forward) {
      return '已屏蔽转发动态';
    }

    if (config.article && item.type === DynamicType.Article) {
      return '已屏蔽专栏动态';
    }

    // 提取文本内容
    const textContent = this.extractDynamicText(item);

    // 检查关键词过滤
    if (this.checkKeywords(textContent, config.keywords)) {
      return '出现关键词，屏蔽该动态';
    }

    // 检查正则表达式过滤
    if (this.checkRegex(textContent, config.regex)) {
      return '出现关键词，屏蔽该动态';
    }

    return null;
  }

  /**
   * 检查直播是否应该被过滤
   */
  checkLiveFilter(title: string, config: FilterConfig): boolean {
    if (!config.enable || !title) return false;

    // 检查关键词过滤
    if (this.checkKeywords(title, config.keywords)) {
      return true;
    }

    // 检查正则表达式过滤
    if (this.checkRegex(title, config.regex)) {
      return true;
    }

    return false;
  }

  /**
   * 提取动态文本内容
   */
  private extractDynamicText(item: AllDynamicInfo['data']['items'][number]): string {
    let textContent = '';

    // 获取动态描述
    if (item.modules.module_dynamic?.desc?.text) {
      textContent += item.modules.module_dynamic.desc.text;
    }

    // 获取富文本内容（opus类型动态）
    if (item.modules.module_dynamic?.major?.opus?.summary?.rich_text_nodes) {
      textContent += item.modules.module_dynamic.major.opus.summary.rich_text_nodes.reduce(
        (accumulator, currentValue) => {
          if (!currentValue.text) {
            return accumulator;
          }
          return accumulator + currentValue.text;
        },
        '',
      );
    }

    return textContent;
  }

  /**
   * 检查关键词过滤
   */
  private checkKeywords(text: string, keywords: string[]): boolean {
    if (!keywords || keywords.length === 0) return false;

    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * 检查正则表达式过滤
   */
  private checkRegex(text: string, regex?: string): boolean {
    if (!regex) return false;

    try {
      const reg = new RegExp(regex);
      return reg.test(text);
    } catch (e) {
      this.logger.error(`正则表达式错误: ${e.message}`);
      return false;
    }
  }
}

declare module 'koishi' {
  interface Context {
    bilibiliFilter: BilibiliFilterService;
  }
}
