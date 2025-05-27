import { BilibiliApiService } from '../../src/services/bilibili/BilibiliApiService';
import { BilibiliWbi } from '../../src/services/bilibili/BilibiliWbi';

// Mock Context
const mockContext = {
  http: {
    get: jest.fn(),
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

describe('WBI Integration Test', () => {
  let apiService: BilibiliApiService;
  let wbiService: BilibiliWbi;

  beforeEach(() => {
    jest.clearAllMocks();
    apiService = new BilibiliApiService(mockContext);
    wbiService = new BilibiliWbi(mockContext);
  });

  describe('BilibiliApiService with WBI', () => {
    it('应该能够使用WBI服务获取用户信息', async () => {
      // Mock WBI密钥响应
      const mockWbiResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      // Mock 用户信息响应
      const mockUserResponse = {
        code: 0,
        data: {
          mid: 123456,
          name: 'TestUser',
          face: 'https://example.com/face.jpg',
          sign: 'Test signature',
          level: 5,
        },
      };

      // Mock 用户统计响应
      const mockStatResponse = {
        code: 0,
        data: {
          follower: 1000,
          following: 500,
        },
      };

      // 设置mock响应
      mockContext.http.get
        .mockResolvedValueOnce(mockWbiResponse) // WBI密钥请求
        .mockResolvedValueOnce(mockUserResponse) // 用户信息请求
        .mockResolvedValueOnce(mockStatResponse); // 用户统计请求

      const result = await apiService.getUserInfo('123456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        uid: '123456',
        name: 'TestUser',
        uname: 'TestUser',
        face: 'https://example.com/face.jpg',
        sign: 'Test signature',
        level: 5,
        follower: 1000,
        following: 500,
      });

      // 验证WBI请求被正确调用
      expect(mockContext.http.get).toHaveBeenCalledTimes(3);

      // 第一次调用应该是获取WBI密钥
      expect(mockContext.http.get).toHaveBeenNthCalledWith(
        1,
        'https://api.bilibili.com/x/web-interface/nav',
        expect.any(Object),
      );

      // 第二次调用应该是获取用户信息（带WBI签名）
      const secondCall = mockContext.http.get.mock.calls[1];
      expect(secondCall[0]).toContain('https://api.bilibili.com/x/space/wbi/acc/info');
      expect(secondCall[0]).toContain('mid=123456');
      expect(secondCall[0]).toContain('wts=');
      expect(secondCall[0]).toContain('w_rid=');
    });

    it('应该能够使用WBI服务搜索用户', async () => {
      // Mock WBI密钥响应
      const mockWbiResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      // Mock 搜索响应
      const mockSearchResponse = {
        code: 0,
        data: {
          result: [
            {
              mid: 123456,
              uname: 'TestUser',
              upic: 'https://example.com/face.jpg',
              usign: 'Test signature',
              level: 5,
              fans: 1000,
            },
          ],
        },
      };

      // 设置mock响应
      mockContext.http.get
        .mockResolvedValueOnce(mockWbiResponse) // WBI密钥请求
        .mockResolvedValueOnce(mockSearchResponse); // 搜索请求

      const result = await apiService.searchUser('TestUser');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        uid: '123456',
        name: 'TestUser',
        uname: 'TestUser',
        face: 'https://example.com/face.jpg',
        sign: 'Test signature',
        level: 5,
        follower: 1000,
        following: 0,
      });

      // 验证WBI搜索请求被正确调用
      const searchCall = mockContext.http.get.mock.calls[1];
      expect(searchCall[0]).toContain('https://api.bilibili.com/x/web-interface/wbi/search/type');
      expect(searchCall[0]).toContain('keyword=TestUser');
      expect(searchCall[0]).toContain('search_type=bili_user');
      expect(searchCall[0]).toContain('wts=');
      expect(searchCall[0]).toContain('w_rid=');
    });

    it('应该能够使用WBI服务获取用户动态', async () => {
      // Mock WBI密钥响应
      const mockWbiResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      // Mock 动态响应
      const mockDynamicResponse = {
        code: 0,
        data: {
          items: [
            {
              id_str: '123456789',
              type: 'DYNAMIC_TYPE_AV',
              modules: {
                module_author: {
                  pub_ts: 1640995200,
                },
              },
            },
          ],
        },
      };

      // 设置mock响应
      mockContext.http.get
        .mockResolvedValueOnce(mockWbiResponse) // WBI密钥请求
        .mockResolvedValueOnce(mockDynamicResponse); // 动态请求

      const result = await apiService.getUserDynamics('123456');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id_str: '123456789',
        type: 'DYNAMIC_TYPE_AV',
        modules: {
          module_author: {
            pub_ts: 1640995200,
          },
        },
        author: {
          pub_ts: 1640995200,
        },
        timestamp: 1640995200,
      });

      // 验证WBI动态请求被正确调用
      const dynamicCall = mockContext.http.get.mock.calls[1];
      expect(dynamicCall[0]).toContain(
        'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space',
      );
      expect(dynamicCall[0]).toContain('host_mid=123456');
      expect(dynamicCall[0]).toContain('wts=');
      expect(dynamicCall[0]).toContain('w_rid=');
    });
  });

  describe('WBI缓存机制', () => {
    it('应该在多次调用时复用WBI密钥缓存', async () => {
      // Mock WBI密钥响应
      const mockWbiResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      // Mock API响应
      const mockApiResponse = {
        code: 0,
        data: { result: [] },
      };

      // 设置mock响应
      mockContext.http.get
        .mockResolvedValueOnce(mockWbiResponse) // 第一次WBI密钥请求
        .mockResolvedValue(mockApiResponse); // 后续API请求

      // 进行两次搜索调用
      await apiService.searchUser('user1');
      await apiService.searchUser('user2');

      // 验证WBI密钥只被请求了一次（因为有缓存）
      const wbiCalls = mockContext.http.get.mock.calls.filter(call =>
        call[0].includes('x/web-interface/nav'),
      );
      expect(wbiCalls).toHaveLength(1);

      // 验证API调用都包含WBI签名
      const apiCalls = mockContext.http.get.mock.calls.filter(call =>
        call[0].includes('search/type'),
      );
      expect(apiCalls).toHaveLength(2);
      apiCalls.forEach(call => {
        expect(call[0]).toContain('wts=');
        expect(call[0]).toContain('w_rid=');
      });
    });
  });
});
