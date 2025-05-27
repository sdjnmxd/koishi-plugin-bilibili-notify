import { Context } from 'koishi';

/**
 * 基础服务类
 */
export abstract class Service<T = any, C extends Context = Context> {
  protected ctx: C;
  protected config: T;

  constructor(ctx: C, config?: T) {
    this.ctx = ctx;
    this.config = config || ({} as T);
  }

  /**
   * 获取服务状态
   */
  get status(): any {
    return {};
  }

  /**
   * 启动服务
   */
  async start?(): Promise<void>;

  /**
   * 停止服务
   */
  async stop?(): Promise<void>;
}
