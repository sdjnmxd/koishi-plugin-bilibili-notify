import { BilibiliApiService } from '../../src/services/bilibili/BilibiliApiService';
import { BilibiliHttpService } from '../../src/services/bilibili/BilibiliHttpService';

// Mock Context
const mockContext = {
  http: {
    get: jest.fn(),
    post: jest.fn(),
  },
  logger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  scope: {
    isActive: true,
  },
} as any;

describe('HTTP服务集成测试', () => {
  let apiService: BilibiliApiService;
  let httpService: BilibiliHttpService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.scope.isActive = true;

    // 创建服务实例
    httpService = new BilibiliHttpService(mockContext);
    apiService = new BilibiliApiService(mockContext);
  });

  describe('API服务与HTTP服务集成', () => {
    it('应该能够通过API服务获取用户信息', async () => {
      const mockUserInfo = {
        code: 0,
        data: {
          mid: 123456,
          name: 'TestUser',
          face: 'https://example.com/avatar.jpg',
          level: 5,
          sign: 'Test signature',
        },
      };

      const mockUserStats = {
        code: 0,
        data: {
          following: 100,
          follower: 1000,
        },
      };

      // Mock WBI keys response
      const mockWbiKeys = {
        code: 0,
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      mockContext.http.get
        .mockResolvedValueOnce(mockWbiKeys) // WBI keys
        .mockResolvedValueOnce(mockUserInfo) // User info
        .mockResolvedValueOnce(mockUserStats); // User stats

      const result = await apiService.getUserInfo('123456');

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('TestUser');
      expect(result.data?.follower).toBe(1000);
      expect(result.data?.following).toBe(100);
    });

    it('应该能够通过API服务获取登录状态', async () => {
      const mockLoginResponse = {
        code: 0,
        data: {
          isLogin: true,
          mid: 123456,
          uname: 'TestUser',
          face: 'https://example.com/avatar.jpg',
          level_info: {
            current_level: 5,
          },
        },
      };

      mockContext.http.get.mockResolvedValue(mockLoginResponse);

      const result = await apiService.getLoginStatus();

      expect(mockContext.http.get).toHaveBeenCalledWith(
        'https://api.bilibili.com/x/web-interface/nav',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            Referer: 'https://www.bilibili.com/',
            Origin: 'https://www.bilibili.com',
          }),
          timeout: 15000,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data?.isLogin).toBe(true);
      expect(result.data?.uname).toBe('TestUser');
    });

    it('应该能够处理带Cookie的请求', async () => {
      const mockWbiKeys = {
        code: 0,
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      const mockUserInfo = {
        code: 0,
        data: {
          mid: 123456,
          name: 'TestUser',
          face: 'https://example.com/avatar.jpg',
          level: 5,
          sign: 'Test signature',
        },
      };

      const mockUserStats = {
        code: 0,
        data: {
          following: 100,
          follower: 1000,
        },
      };

      // 设置Cookie
      apiService.setCookies('SESSDATA=test123; bili_jct=abc456');

      mockContext.http.get
        .mockResolvedValueOnce(mockWbiKeys)
        .mockResolvedValueOnce(mockUserInfo)
        .mockResolvedValueOnce(mockUserStats);

      const result = await apiService.getUserInfo('123456');

      expect(result.success).toBe(true);
      // 验证请求包含Cookie
      expect(mockContext.http.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Cookie: expect.stringContaining('SESSDATA=test123'),
          }),
        }),
      );
    });

    it('应该能够处理直播间信息请求', async () => {
      const mockRoomInfo = {
        code: 0,
        data: {
          live_status: 1,
          title: 'Test Stream',
          user_cover: 'https://example.com/cover.jpg',
          online: 1000,
        },
      };

      mockContext.http.get.mockResolvedValue(mockRoomInfo);

      const result = await apiService.getLiveRoomInfo('12345');

      expect(mockContext.http.get).toHaveBeenCalledWith(
        'https://api.live.bilibili.com/room/v1/Room/get_info?room_id=12345',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
          }),
          timeout: 15000,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data?.live_status).toBe(1);
      expect(result.data?.title).toBe('Test Stream');
    });
  });

  describe('服务状态管理', () => {
    it('应该能够获取服务状态', () => {
      apiService.setCookies('SESSDATA=test123');

      const status = apiService.status;

      expect(status).toHaveProperty('hasLogin', true);
      expect(status).toHaveProperty('lastRequestTime');
      expect(status).toHaveProperty('currentUserAgent');
    });

    it('应该能够获取User-Agent信息', () => {
      const uaInfo = apiService.getCurrentUserAgentInfo();

      expect(uaInfo).toHaveProperty('index');
      expect(uaInfo).toHaveProperty('total');
      expect(uaInfo).toHaveProperty('current');
      expect(uaInfo.total).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该能够处理上下文非活跃错误', async () => {
      mockContext.scope.isActive = false;

      const result = await apiService.getLoginStatus();

      expect(result.success).toBe(false);
      expect(result.error).toContain('服务正在重启或停止中');

      // 恢复活跃状态
      mockContext.scope.isActive = true;
    });
  });

  describe('配置管理', () => {
    it('应该能够更新User-Agent配置', () => {
      const newConfig = {
        customUserAgents: 'Custom UA 1\nCustom UA 2',
      };

      apiService.updateConfig(newConfig);

      const uaInfo = apiService.getCurrentUserAgentInfo();
      expect(uaInfo.total).toBe(2);
      expect(uaInfo.current).toBe('Custom UA 1');
    });

    it('应该能够重新加载User-Agent', () => {
      apiService.reloadUserAgents();

      const uaInfo = apiService.getCurrentUserAgentInfo();
      expect(uaInfo.index).toBe(1); // 重置到第一个
    });
  });
});
