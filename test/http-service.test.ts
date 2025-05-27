import { BilibiliHttpService } from '../src/services/bilibili/BilibiliHttpService';

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

describe('BilibiliHttpService', () => {
  let httpService: BilibiliHttpService;

  beforeEach(() => {
    jest.clearAllMocks();
    // 确保上下文始终活跃
    mockContext.scope.isActive = true;
    httpService = new BilibiliHttpService(mockContext);
  });

  describe('User-Agent管理', () => {
    it('应该能够初始化默认User-Agent列表', () => {
      const uaInfo = httpService.getCurrentUserAgentInfo();

      expect(uaInfo.total).toBeGreaterThan(0);
      expect(uaInfo.index).toBe(1);
      expect(uaInfo.current).toBeTruthy();
    });

    it('应该能够使用自定义User-Agent列表', () => {
      const customConfig = {
        customUserAgents: 'Custom UA 1\nCustom UA 2\nCustom UA 3',
      };

      const customHttpService = new BilibiliHttpService(mockContext, customConfig);
      const uaInfo = customHttpService.getCurrentUserAgentInfo();

      expect(uaInfo.total).toBe(3);
      expect(uaInfo.current).toBe('Custom UA 1');
    });

    it('应该能够轮换User-Agent', () => {
      const initialUA = httpService.getCurrentUserAgentInfo().current;

      httpService.rotateUserAgent();
      const newUA = httpService.getCurrentUserAgentInfo().current;

      // 如果只有一个UA，轮换后应该还是同一个
      if (httpService.getCurrentUserAgentInfo().total > 1) {
        expect(newUA).not.toBe(initialUA);
      }
    });

    it('应该能够重新加载User-Agent配置', () => {
      httpService.reloadUserAgents();

      const uaInfo = httpService.getCurrentUserAgentInfo();
      expect(uaInfo.index).toBe(1); // 重置到第一个
    });
  });

  describe('Cookie管理', () => {
    it('应该能够设置和获取Cookie', () => {
      const testCookies = 'SESSDATA=test123; bili_jct=abc456; DedeUserID=789';

      httpService.setCookies(testCookies);
      const cookieHeader = httpService.getCookiesForHeader();

      expect(cookieHeader).toContain('SESSDATA=test123');
      expect(cookieHeader).toContain('bili_jct=abc456');
      expect(cookieHeader).toContain('DedeUserID=789');
    });

    it('应该能够清理无效的Cookie字段', () => {
      const testCookies = 'SESSDATA=test123; invalid_field=should_be_removed; bili_jct=abc456';

      httpService.setCookies(testCookies);
      const cookieHeader = httpService.getCookiesForHeader();

      expect(cookieHeader).toContain('SESSDATA=test123');
      expect(cookieHeader).toContain('bili_jct=abc456');
      expect(cookieHeader).not.toContain('invalid_field');
    });

    it('应该自动添加buvid3字段', () => {
      const testCookies = 'SESSDATA=test123';

      httpService.setCookies(testCookies);
      const cookieHeader = httpService.getCookiesForHeader();

      expect(cookieHeader).toContain('buvid3=some_non_empty_value');
    });
  });

  describe('请求头生成', () => {
    it('应该能够生成标准请求头', () => {
      const headers = httpService.getHeaders();

      expect(headers).toHaveProperty('User-Agent');
      expect(headers).toHaveProperty('Referer', 'https://www.bilibili.com/');
      expect(headers).toHaveProperty('Origin', 'https://www.bilibili.com');
      expect(headers).toHaveProperty('Accept', 'application/json, text/plain, */*');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    it('应该能够自定义Referer和Origin', () => {
      const headers = httpService.getHeaders({
        customReferer: 'https://live.bilibili.com/',
        customOrigin: 'https://live.bilibili.com',
      });

      expect(headers.Referer).toBe('https://live.bilibili.com/');
      expect(headers.Origin).toBe('https://live.bilibili.com');
    });

    it('应该能够包含Cookie', () => {
      httpService.setCookies('SESSDATA=test123');

      const headers = httpService.getHeaders({ includeCookies: true });

      expect(headers).toHaveProperty('Cookie');
      expect(headers.Cookie).toContain('SESSDATA=test123');
    });

    it('应该能够排除Cookie', () => {
      httpService.setCookies('SESSDATA=test123');

      const headers = httpService.getHeaders({ includeCookies: false });

      expect(headers).not.toHaveProperty('Cookie');
    });

    it('应该能够生成特殊请求头', () => {
      const roomId = '12345';
      const headers = httpService.getSpecialHeaders(roomId);

      expect(headers).toHaveProperty('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8');
      expect(headers).toHaveProperty('Accept-Encoding', 'gzip, deflate, br');
      expect(headers).toHaveProperty('Sec-Fetch-Dest', 'empty');
      expect(headers).toHaveProperty('Sec-Fetch-Mode', 'cors');
      expect(headers).toHaveProperty('Sec-Fetch-Site', 'same-site');
      expect(headers.Referer).toBe(`https://live.bilibili.com/${roomId}`);
      expect(headers.Origin).toBe('https://live.bilibili.com');
    });
  });

  describe('HTTP请求', () => {
    it('应该能够发送GET请求', async () => {
      const mockResponse = { data: 'test' };
      mockContext.http.get.mockResolvedValue(mockResponse);

      const result = await httpService.get('https://example.com/api');

      expect(mockContext.http.get).toHaveBeenCalledWith(
        'https://example.com/api',
        expect.objectContaining({
          headers: expect.any(Object),
          timeout: 15000,
        }),
      );
      expect(result).toBe(mockResponse);
    });

    it('应该能够发送POST请求', async () => {
      const mockResponse = { data: 'test' };
      const postData = { key: 'value' };
      mockContext.http.post.mockResolvedValue(mockResponse);

      const result = await httpService.post('https://example.com/api', postData);

      expect(mockContext.http.post).toHaveBeenCalledWith(
        'https://example.com/api',
        postData,
        expect.objectContaining({
          headers: expect.any(Object),
          timeout: 15000,
        }),
      );
      expect(result).toBe(mockResponse);
    });

    it('应该能够处理上下文非活跃错误', async () => {
      mockContext.scope.isActive = false;

      await expect(httpService.get('https://example.com/api')).rejects.toThrow(
        '服务上下文已停用，无法进行HTTP请求',
      );

      // 恢复活跃状态
      mockContext.scope.isActive = true;
    });
  });

  describe('重试机制', () => {
    beforeEach(() => {
      // 确保上下文在重试测试中始终活跃
      mockContext.scope.isActive = true;
    });

    it('应该能够重试失败的请求', async () => {
      const mockError = new Error('Network error');
      const mockSuccess = { data: 'success' };

      mockContext.http.get
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);

      const result = await httpService.getWithRetry('https://example.com/api');

      expect(mockContext.http.get).toHaveBeenCalledTimes(3);
      expect(result).toBe(mockSuccess);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      const mockError = new Error('Persistent error');
      mockContext.http.get.mockRejectedValue(mockError);

      await expect(
        httpService.getWithRetry('https://example.com/api', {}, { maxRetries: 2 }),
      ).rejects.toThrow('Persistent error');

      expect(mockContext.http.get).toHaveBeenCalledTimes(3); // 1 + 2 retries
    });

    it('应该对-352风控错误使用特殊重试策略', async () => {
      const mockError = new Error('请求被风控 -352');
      const mockSuccess = { data: 'success' };

      // Mock sleep to avoid actual delays in tests
      const originalSleep = httpService['sleep'];
      httpService['sleep'] = jest.fn().mockResolvedValue(undefined);

      mockContext.http.get.mockRejectedValueOnce(mockError).mockResolvedValueOnce(mockSuccess);

      const result = await httpService.getWithRetry('https://example.com/api');

      expect(result).toBe(mockSuccess);
      expect(httpService['sleep']).toHaveBeenCalled();

      // 恢复原始方法
      httpService['sleep'] = originalSleep;
    });
  });

  describe('服务状态', () => {
    it('应该能够获取服务状态', () => {
      httpService.setCookies('test=123');

      const status = httpService.getStatus();

      expect(status).toHaveProperty('hasLogin', true);
      expect(status).toHaveProperty('lastRequestTime');
      expect(status).toHaveProperty('currentUserAgent');
      expect(status).toHaveProperty('startupTime');
    });

    it('应该能够重置服务状态', async () => {
      const initialStatus = httpService.getStatus();

      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 10));

      httpService.resetServiceState();

      const newStatus = httpService.getStatus();
      expect(newStatus.startupTime).toBeGreaterThan(initialStatus.startupTime);
    });

    it('应该能够更新配置', () => {
      const newConfig = {
        customUserAgents: 'New UA 1\nNew UA 2',
      };

      httpService.updateConfig(newConfig);

      const uaInfo = httpService.getCurrentUserAgentInfo();
      expect(uaInfo.total).toBe(2);
      expect(uaInfo.current).toBe('New UA 1');
    });
  });
});
