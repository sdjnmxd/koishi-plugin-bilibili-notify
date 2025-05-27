import { Context, Service } from 'koishi';
import { LiveType, MasterInfo } from '../../core/types';

export interface Config {
  filter: {
    enable: boolean
    notify: boolean
    regex: string
    keywords: string[]
  }
  removeBorder: boolean
  cardColorStart: string
  cardColorEnd: string
  cardBasePlateColor: string
  cardBasePlateBorder: string
  hideDesc: boolean
  enableLargeFont: boolean
  followerDisplay: boolean
}

export default class NotificationFormatter extends Service {
  static inject = ['ba'];
  
  private config: Config;

  constructor(ctx: Context, config: Config) {
    super(ctx, 'gi');
    this.config = config;
  }

  async formatLiveNotification(
    type: LiveType,
    masterInfo: MasterInfo,
    liveInfo: any,
    customMessage?: string,
  ): Promise<string> {
    const { name, face, follower } = masterInfo;
    const { title, cover, room_id } = liveInfo;

    let message = '';
    switch (type) {
      case 'start':
        message = this.config.customLiveStart || '开播啦！';
        break;
      case 'end':
        message = this.config.customLiveEnd || '下播啦！';
        break;
      case 'guard':
        message = this.config.customLive || '上舰啦！';
        break;
    }

    if (customMessage) {
      message = customMessage;
    }

    return `
      ${message}
      主播：${name}
      ${this.config.followerDisplay ? `粉丝数：${follower}` : ''}
      ${type === 'start' ? `标题：${title}` : ''}
      ${type === 'start' ? `房间号：${room_id}` : ''}
      ${type === 'start' ? `封面：${cover}` : ''}
    `.trim();
  }

  async formatDynamicNotification(
    dynamicInfo: any,
    masterInfo: MasterInfo,
  ): Promise<string> {
    const { name, face, follower } = masterInfo;
    const { content, images, timestamp } = dynamicInfo;

    return `
      动态更新！
      用户：${name}
      ${this.config.followerDisplay ? `粉丝数：${follower}` : ''}
      内容：${content}
      ${images ? `图片：${images.join('\n')}` : ''}
      时间：${new Date(timestamp * 1000).toLocaleString()}
    `.trim();
  }

  shouldFilter(content: string): boolean {
    if (!this.config.filter.enable) {
      return false;
    }

    if (this.config.filter.regex) {
      const regex = new RegExp(this.config.filter.regex);
      if (regex.test(content)) {
        return true;
      }
    }

    if (this.config.filter.keywords.length > 0) {
      return this.config.filter.keywords.some(keyword => content.includes(keyword));
    }

    return false;
  }
} 
