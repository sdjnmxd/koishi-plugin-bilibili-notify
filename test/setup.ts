// Jest测试环境设置文件

// 设置测试超时时间
jest.setTimeout(10000);

// 模拟console方法以避免测试输出过多日志
const originalConsole = console;

beforeAll(() => {
  // 在测试期间静默console输出，除非是错误
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: originalConsole.error, // 保留错误输出
  };
});

afterAll(() => {
  // 恢复原始console
  global.console = originalConsole;
});

// 全局测试工具函数
(global as any).createMockContext = () => ({
  config: {},
  logger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  get: jest.fn(),
  setInterval: jest.fn(),
  setTimeout: jest.fn(),
  bots: [],
  broadcast: jest.fn(),
});

// 类型声明
declare global {
  function createMockContext(): any;
}

export {};
