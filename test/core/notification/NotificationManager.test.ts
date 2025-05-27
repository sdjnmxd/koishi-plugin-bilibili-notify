import { NotificationManager } from '../../../src/core/notification/manager';

// Mock Bot
const mockBot = {
  platform: 'test-platform',
  sendMessage: jest.fn(),
};

describe('NotificationManager', () => {
  let notificationManager: NotificationManager;
  let mockContext: any;

  beforeEach(() => {
    mockContext = (global as any).createMockContext();
    mockContext.bots = [mockBot];

    notificationManager = new NotificationManager(mockContext);

    // 重置所有mock
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('应该成功发送文本通知', async () => {
      const notificationData = {
        type: 'live',
        subType: 'start',
        user: '测试UP主',
        content: '开始直播了！',
        target: {
          platform: 'test-platform',
          channelId: 'test-channel',
        },
      };

      mockBot.sendMessage.mockResolvedValue(undefined);

      const result = await notificationManager.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith('test-channel', '开始直播了！');
    });

    it('应该成功发送带图片的通知', async () => {
      const mockImage = Buffer.from('fake-image-data');
      const notificationData = {
        type: 'live',
        user: '测试UP主',
        content: '直播中',
        image: mockImage,
        url: 'https://live.bilibili.com/123',
        target: {
          platform: 'test-platform',
          channelId: 'test-channel',
        },
      };

      mockBot.sendMessage.mockResolvedValue(undefined);

      const result = await notificationManager.sendNotification(notificationData);

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        'test-channel',
        expect.arrayContaining([
          expect.objectContaining({ type: 'img' }),
          '直播中',
          'https://live.bilibili.com/123',
        ]),
      );
    });

    it('应该处理找不到机器人的情况', async () => {
      const notificationData = {
        type: 'live',
        user: '测试UP主',
        content: '测试消息',
        target: {
          platform: 'unknown-platform',
          channelId: 'test-channel',
        },
      };

      const result = await notificationManager.sendNotification(notificationData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('找不到平台');
    });

    it('应该处理发送失败的情况', async () => {
      const notificationData = {
        type: 'live',
        user: '测试UP主',
        content: '测试消息',
        target: {
          platform: 'test-platform',
          channelId: 'test-channel',
        },
      };

      mockBot.sendMessage.mockRejectedValue(new Error('发送失败'));

      const result = await notificationManager.sendNotification(notificationData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('发送失败');
    });

    it('应该处理没有目标的通知', async () => {
      const notificationData = {
        type: 'live',
        user: '测试UP主',
        content: '测试消息',
      };

      const result = await notificationManager.sendNotification(notificationData);

      expect(result.success).toBe(true);
      // 应该记录到日志而不是发送消息
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToConfigTargets', () => {
    it('应该向配置的目标发送直播通知', async () => {
      const targets = [
        {
          platform: 'test-platform',
          channelId: 'channel1',
          live: true,
          dynamic: false,
          liveGuardBuy: false,
          atAll: false,
        },
        {
          platform: 'test-platform',
          channelId: 'channel2',
          live: false,
          dynamic: true,
          liveGuardBuy: false,
          atAll: false,
        },
      ];

      mockBot.sendMessage.mockResolvedValue(undefined);

      const result = await notificationManager.broadcastToConfigTargets(
        targets,
        '直播开始了！',
        'live',
      );

      expect(result.success).toBe(true);
      // 只有第一个目标应该收到直播通知
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith('channel1', '直播开始了！');
    });

    it('应该向配置的目标发送动态通知', async () => {
      const targets = [
        {
          platform: 'test-platform',
          channelId: 'channel1',
          live: true,
          dynamic: false,
          liveGuardBuy: false,
          atAll: false,
        },
        {
          platform: 'test-platform',
          channelId: 'channel2',
          live: false,
          dynamic: true,
          liveGuardBuy: false,
          atAll: false,
        },
      ];

      mockBot.sendMessage.mockResolvedValue(undefined);

      const result = await notificationManager.broadcastToConfigTargets(
        targets,
        '发布了新动态',
        'dynamic',
      );

      expect(result.success).toBe(true);
      // 只有第二个目标应该收到动态通知
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockBot.sendMessage).toHaveBeenCalledWith('channel2', '发布了新动态');
    });

    it('应该处理@全体功能', async () => {
      const targets = [
        {
          platform: 'test-platform',
          channelId: 'channel1',
          live: true,
          dynamic: false,
          liveGuardBuy: false,
          atAll: true,
        },
      ];

      mockBot.sendMessage.mockResolvedValue(undefined);

      const result = await notificationManager.broadcastToConfigTargets(
        targets,
        '直播开始了！',
        'live',
      );

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockBot.sendMessage).toHaveBeenNthCalledWith(1, 'channel1', '直播开始了！');
      expect(mockBot.sendMessage).toHaveBeenNthCalledWith(2, 'channel1', '<at type="all" />');
    });

    it('应该处理空目标列表', async () => {
      const result = await notificationManager.broadcastToConfigTargets([], '测试消息', 'live');

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).not.toHaveBeenCalled();
    });
  });
});
