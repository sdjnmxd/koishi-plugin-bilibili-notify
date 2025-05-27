import { LoginService } from '../../../src/services/auth/LoginService';

// Mock BilibiliApiService
const mockBilibiliApiService = {
  setCookies: jest.fn(),
  getLoginStatus: jest.fn(),
};

// Mock Database
const mockDatabase = {
  get: jest.fn(),
  set: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

describe('LoginService', () => {
  let loginService: LoginService;
  let mockContext: any;

  beforeEach(() => {
    mockContext = (global as any).createMockContext();
    mockContext.database = mockDatabase;
    mockContext.http = {
      get: jest.fn(),
    };

    loginService = new LoginService(mockContext);
    // 手动设置bilibiliApi，因为构造函数中创建了新实例
    (loginService as any).bilibiliApi = mockBilibiliApiService;

    // 重置所有mock
    jest.clearAllMocks();
  });

  describe('getLoginStatus', () => {
    it('应该在没有登录信息时返回未登录状态', async () => {
      mockDatabase.get.mockResolvedValue([]);

      const result = await loginService.getLoginStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(result.userInfo).toBeUndefined();
    });

    it('应该在有有效cookie时返回登录状态', async () => {
      const mockLoginInfo = {
        bili_cookies: 'SESSDATA=test123; bili_jct=abc456',
      };
      const mockLoginStatus = {
        isLogin: true,
        uname: '测试用户',
        face: 'https://example.com/avatar.jpg',
        uid: '12345',
        level: 5,
      };

      mockDatabase.get.mockResolvedValue([mockLoginInfo]);
      mockBilibiliApiService.getLoginStatus.mockResolvedValue({
        success: true,
        data: mockLoginStatus,
      });

      const result = await loginService.getLoginStatus();

      expect(result.isLoggedIn).toBe(true);
      expect(result.userInfo?.uid).toBe('12345');
      expect(result.userInfo?.name).toBe('测试用户');
      expect(result.userInfo?.face).toBe('https://example.com/avatar.jpg');
      expect(result.userInfo?.level).toBe(5);

      expect(mockBilibiliApiService.setCookies).toHaveBeenCalledWith(mockLoginInfo.bili_cookies);
      expect(mockBilibiliApiService.getLoginStatus).toHaveBeenCalled();
    });

    it('应该在cookie无效时返回未登录状态', async () => {
      const mockLoginInfo = {
        bili_cookies: 'invalid_cookie',
      };

      mockDatabase.get.mockResolvedValue([mockLoginInfo]);
      mockBilibiliApiService.getLoginStatus.mockResolvedValue({
        success: false,
        error: 'Cookie已过期',
      });

      const result = await loginService.getLoginStatus();

      expect(result.isLoggedIn).toBe(false);
      expect(mockBilibiliApiService.setCookies).toHaveBeenCalledWith(mockLoginInfo.bili_cookies);
    });

    it('应该处理数据库错误', async () => {
      mockDatabase.get.mockRejectedValue(new Error('数据库连接失败'));

      const result = await loginService.getLoginStatus();

      expect(result.isLoggedIn).toBe(false);
    });
  });

  describe('getLoginQRCode', () => {
    it('应该成功获取二维码信息', async () => {
      const mockResponse = {
        code: 0,
        data: {
          url: 'https://passport.bilibili.com/h5-app/passport/auth/qrcode?qrcode_key=test123',
          qrcode_key: 'test123',
        },
      };

      mockContext.http.get.mockResolvedValue(mockResponse);

      const result = await loginService.getLoginQRCode();

      expect(result.url).toBe(mockResponse.data.url);
      expect(result.qrcode_key).toBe(mockResponse.data.qrcode_key);
    });

    it('应该处理获取二维码失败的情况', async () => {
      const mockResponse = {
        code: -1,
        message: '获取失败',
      };

      mockContext.http.get.mockResolvedValue(mockResponse);

      await expect(loginService.getLoginQRCode()).rejects.toThrow('获取二维码失败');
    });
  });

  describe('pollQRCodeStatus', () => {
    it('应该处理登录成功的情况', async () => {
      const mockResponse = {
        code: 0,
        data: {
          url: 'https://passport.bilibili.com/login/success?DedeUserID=123&SESSDATA=test&bili_jct=abc',
          refresh_token: 'refresh123',
        },
      };

      mockContext.http.get.mockResolvedValue(mockResponse);
      mockDatabase.get.mockResolvedValue([]);
      mockDatabase.create.mockResolvedValue({});

      const result = await loginService.pollQRCodeStatus('test_key');

      expect(result.success).toBe(true);
      expect(result.message).toBe('登录成功');
      expect(result.cookies).toContain('DedeUserID=123');
      expect(result.cookies).toContain('SESSDATA=test');
    });

    it('应该处理未扫码的情况', async () => {
      const mockResponse = {
        code: 86101,
      };

      mockContext.http.get.mockResolvedValue(mockResponse);

      const result = await loginService.pollQRCodeStatus('test_key');

      expect(result.success).toBe(false);
      expect(result.message).toContain('请使用哔哩哔哩客户端扫描二维码');
    });

    it('应该处理二维码失效的情况', async () => {
      const mockResponse = {
        code: 86038,
      };

      mockContext.http.get.mockResolvedValue(mockResponse);

      const result = await loginService.pollQRCodeStatus('test_key');

      expect(result.success).toBe(false);
      expect(result.message).toContain('二维码已失效');
    });
  });

  describe('logout', () => {
    it('应该成功删除登录信息', async () => {
      mockDatabase.remove.mockResolvedValue(undefined);

      await expect(loginService.logout()).resolves.not.toThrow();
      expect(mockDatabase.remove).toHaveBeenCalledWith('bilibili-notify-modern-login', {});
    });
  });
});
