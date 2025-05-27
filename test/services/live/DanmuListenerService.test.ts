import { Context } from 'koishi';
import { DanmuListenerService } from '../../../src/services/live/DanmuListenerService';
import { BilibiliApiService } from '../../../src/services/bilibili/BilibiliApiService';

// Mock blive-message-listener
jest.mock('blive-message-listener', () => ({
  startListen: jest.fn(() => ({
    close: jest.fn(),
  })),
}));

describe('DanmuListenerService', () => {
  let ctx: Context;
  let danmuService: DanmuListenerService;
  let mockApiService: jest.Mocked<BilibiliApiService>;

  beforeEach(() => {
    ctx = new Context();

    // Mock BilibiliApiService
    mockApiService = {
      getLongRoomId: jest.fn(),
      getCookiesForHeader: jest.fn(),
      getMyselfInfo: jest.fn(),
      getDanmuInfo: jest.fn(),
    } as any;

    ctx.set('bilibiliApiService', mockApiService);

    danmuService = new DanmuListenerService(ctx);
  });

  afterEach(async () => {
    await danmuService.stop();
  });

  describe('connectRoom', () => {
    it('应该在用户未登录时返回失败', async () => {
      // 模拟未登录状态
      mockApiService.getLongRoomId.mockResolvedValue({
        success: true,
        data: '123456',
      });
      mockApiService.getCookiesForHeader.mockReturnValue('');
      mockApiService.getMyselfInfo.mockResolvedValue({
        success: false,
        error: '未登录',
      });

      const result = await danmuService.connectRoom(123456);

      expect(result).toBe(false);
      expect(mockApiService.getLongRoomId).toHaveBeenCalledWith('123456');
      expect(mockApiService.getCookiesForHeader).toHaveBeenCalled();
      expect(mockApiService.getMyselfInfo).toHaveBeenCalled();
    });

    it('应该在用户已登录时尝试连接', async () => {
      // 模拟已登录状态
      mockApiService.getLongRoomId.mockResolvedValue({
        success: true,
        data: '123456',
      });
      mockApiService.getCookiesForHeader.mockReturnValue('SESSDATA=test; DedeUserID=123');
      mockApiService.getMyselfInfo.mockResolvedValue({
        success: true,
        data: { mid: 123456, uname: 'testuser' },
      });
      mockApiService.getDanmuInfo.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-12345',
          host_list: [{ host: 'test.bilibili.com', port: 2243, wss_port: 443, ws_port: 2244 }],
          max_delay: 5000,
        },
      });

      const result = await danmuService.connectRoom(123456);

      expect(result).toBe(true);
      expect(mockApiService.getLongRoomId).toHaveBeenCalledWith('123456');
      expect(mockApiService.getCookiesForHeader).toHaveBeenCalled();
      expect(mockApiService.getMyselfInfo).toHaveBeenCalled();
      expect(mockApiService.getDanmuInfo).toHaveBeenCalledWith('123456');
    });

    it('应该正确处理短房间ID转长房间ID', async () => {
      // 模拟短房间ID转换
      mockApiService.getLongRoomId.mockResolvedValue({
        success: true,
        data: '987654321',
      });
      mockApiService.getCookiesForHeader.mockReturnValue('SESSDATA=test; DedeUserID=123');
      mockApiService.getMyselfInfo.mockResolvedValue({
        success: true,
        data: { mid: 123456, uname: 'testuser' },
      });
      mockApiService.getDanmuInfo.mockResolvedValue({
        success: true,
        data: {
          token: 'test-token-12345',
          host_list: [{ host: 'test.bilibili.com', port: 2243, wss_port: 443, ws_port: 2244 }],
          max_delay: 5000,
        },
      });

      const result = await danmuService.connectRoom(123);

      expect(result).toBe(true);
      expect(mockApiService.getLongRoomId).toHaveBeenCalledWith('123');
      expect(mockApiService.getDanmuInfo).toHaveBeenCalledWith('987654321');
    });

    it('应该在API服务不可用时返回失败', async () => {
      // 移除API服务
      ctx.set('bilibiliApiService', null);

      const result = await danmuService.connectRoom(123456);

      expect(result).toBe(false);
    });

    it('应该在获取弹幕信息失败时返回失败', async () => {
      // 模拟弹幕信息获取失败
      mockApiService.getLongRoomId.mockResolvedValue({
        success: true,
        data: '123456',
      });
      mockApiService.getCookiesForHeader.mockReturnValue('SESSDATA=test; DedeUserID=123');
      mockApiService.getMyselfInfo.mockResolvedValue({
        success: true,
        data: { mid: 123456, uname: 'testuser' },
      });
      mockApiService.getDanmuInfo.mockResolvedValue({
        success: false,
        error: '获取弹幕信息失败',
      });

      const result = await danmuService.connectRoom(123456);

      expect(result).toBe(false);
      expect(mockApiService.getDanmuInfo).toHaveBeenCalledWith('123456');
    });
  });

  describe('连接状态管理', () => {
    it('应该正确跟踪连接状态', () => {
      expect(danmuService.status.isRunning).toBe(false);
      expect(danmuService.status.connectionCount).toBe(0);
    });

    it('应该正确检查连接状态', () => {
      const isConnected = danmuService.isConnected(123456);
      expect(isConnected).toBe(false);
    });

    it('应该返回正确的连接统计', () => {
      const stats = danmuService.getConnectionStats();
      expect(stats.total).toBe(0);
      expect(stats.connected).toBe(0);
      expect(stats.rooms).toEqual([]);
    });
  });
});
