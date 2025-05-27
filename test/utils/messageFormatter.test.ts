import {
  formatMessage,
  formatLiveStartMessage,
  formatLiveMessage,
  formatLiveEndMessage,
} from '../../src/utils/messageFormatter';

describe('MessageFormatter', () => {
  describe('formatMessage', () => {
    it('应该正确替换基本变量', () => {
      const template = '🔴 {name} 开始直播啦！\n📺 {title}\n🔗 {url}';
      const result = formatMessage(template, {
        name: '测试UP主',
        title: '今天来玩游戏',
        url: 'https://live.bilibili.com/123456',
      });

      expect(result).toContain('测试UP主');
      expect(result).toContain('今天来玩游戏');
      expect(result).toContain('https://live.bilibili.com/123456');
      expect(result).toContain('\n');
    });

    it('应该正确处理换行符', () => {
      const template = '{name}开播啦\\n当前粉丝数：{follower}\\n{url}';
      const result = formatMessage(template, {
        name: '某UP主',
        follower: '10万',
        url: 'https://live.bilibili.com/654321',
      });

      expect(result).toContain('\n');
      expect(result).not.toContain('\\n');
      expect(result).toContain('某UP主');
      expect(result).toContain('10万');
    });

    it('应该处理空模板', () => {
      const result = formatMessage('', { name: '测试' });
      expect(result).toBe('');
    });

    it('应该处理缺失的变量', () => {
      const template = '{name} 开播了，{missingVar} 这个变量不存在';
      const result = formatMessage(template, { name: '测试UP主' });

      expect(result).toContain('测试UP主');
      expect(result).toBe('测试UP主 开播了，{missingVar} 这个变量不存在');
    });

    it('应该处理undefined数据', () => {
      const template = '{name} - {title}';
      const result = formatMessage(template, {
        name: '测试UP主',
        title: undefined,
      });

      expect(result).toBe('测试UP主 - ');
    });
  });

  describe('formatLiveStartMessage', () => {
    it('应该正确格式化开播消息', () => {
      const template = '🎉 {name} 开播了！\\n🎬 {title}\\n👀 快来围观：{url}';
      const result = formatLiveStartMessage(template, {
        name: '游戏主播',
        title: '今晚吃鸡大作战',
        url: 'https://live.bilibili.com/789012',
      });

      expect(result).toContain('游戏主播');
      expect(result).toContain('今晚吃鸡大作战');
      expect(result).toContain('https://live.bilibili.com/789012');
      expect(result).toContain('\n');
    });

    it('应该处理可选字段', () => {
      const template = '{name} 开播了！粉丝数：{follower}';
      const result = formatLiveStartMessage(template, {
        name: '主播',
        title: '直播标题',
        url: 'https://live.bilibili.com/123',
        follower: '1万',
      });

      expect(result).toContain('主播');
      expect(result).toContain('1万');
    });
  });

  describe('formatLiveMessage', () => {
    it('应该正确格式化直播中消息', () => {
      const template = '📺 {name} 直播中\\n🎬 {title}\\n👥 {online} 人在看\\n⏰ 已播 {time}';
      const result = formatLiveMessage(template, {
        name: '游戏主播',
        title: '今晚吃鸡大作战',
        url: 'https://live.bilibili.com/789012',
        online: '1234',
        time: '2小时30分钟',
      });

      expect(result).toContain('游戏主播');
      expect(result).toContain('今晚吃鸡大作战');
      expect(result).toContain('1234');
      expect(result).toContain('2小时30分钟');
    });
  });

  describe('formatLiveEndMessage', () => {
    it('应该正确格式化下播消息', () => {
      const template = '😴 {name} 下播了\\n⏰ 本次直播时长：{time}\\n📈 粉丝变化：{followerChange}';
      const result = formatLiveEndMessage(template, {
        name: '游戏主播',
        time: '3小时45分钟',
        followerChange: '+156',
      });

      expect(result).toContain('游戏主播');
      expect(result).toContain('3小时45分钟');
      expect(result).toContain('+156');
    });

    it('应该处理可选时间字段', () => {
      const template = '{name} 下播了';
      const result = formatLiveEndMessage(template, {
        name: '主播',
      });

      expect(result).toBe('主播 下播了');
    });
  });
});
