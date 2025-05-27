import { BilibiliWbi } from '../src/services/bilibili/BilibiliWbi';
import { BilibiliHttpService } from '../src/services/bilibili/BilibiliHttpService';

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

// Mock BilibiliHttpService
const mockHttpService = {
  getWithRetry: jest.fn(),
} as any;

describe('BilibiliWbi', () => {
  let wbiService: BilibiliWbi;

  beforeEach(() => {
    jest.clearAllMocks();
    wbiService = new BilibiliWbi(mockContext, mockHttpService);
  });

  describe('getWbiKeys', () => {
    it('应该能够获取WBI密钥', async () => {
      // Mock API响应
      const mockResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/7cd084941338484aae1ad9425b84077c.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/4932caff0ff746eab6f01bf08b70ac45.png',
          },
        },
      };

      mockHttpService.getWithRetry.mockResolvedValue(mockResponse);

      const keys = await wbiService.getWbiKeys();

      expect(keys).toEqual({
        img_key: '7cd084941338484aae1ad9425b84077c',
        sub_key: '4932caff0ff746eab6f01bf08b70ac45',
      });
    });

    it('应该缓存WBI密钥', async () => {
      const mockResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      mockHttpService.getWithRetry.mockResolvedValue(mockResponse);

      // 第一次调用
      await wbiService.getWbiKeys();
      // 第二次调用
      await wbiService.getWbiKeys();

      // HTTP请求应该只被调用一次（因为有缓存）
      expect(mockHttpService.getWithRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWbi', () => {
    it('应该能够生成WBI签名查询字符串', async () => {
      const mockResponse = {
        data: {
          wbi_img: {
            img_url: 'https://i0.hdslb.com/bfs/wbi/test.png',
            sub_url: 'https://i0.hdslb.com/bfs/wbi/test2.png',
          },
        },
      };

      mockHttpService.getWithRetry.mockResolvedValue(mockResponse);

      const params = {
        mid: '123456',
        keyword: 'test',
      };

      const result = await wbiService.getWbi(params);

      // 结果应该包含原始参数和WBI签名
      expect(result).toContain('mid=123456');
      expect(result).toContain('keyword=test');
      expect(result).toContain('wts=');
      expect(result).toContain('w_rid=');
    });
  });

  describe('缓存管理', () => {
    it('应该能够清除缓存', () => {
      wbiService.clearCache();

      const status = wbiService.getStatus();
      expect(status.hasCache).toBe(false);
    });

    it('应该能够获取缓存状态', () => {
      const status = wbiService.getStatus();

      expect(status).toHaveProperty('hasCache');
      expect(status).toHaveProperty('isExpired');
      expect(status).toHaveProperty('expiryTime');
    });
  });
});
