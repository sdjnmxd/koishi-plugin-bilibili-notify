export interface RiskControlStatus {
  isBlocked: boolean;
  blockStartTime?: number;
  blockDuration: number;
  consecutiveFailures: number;
  lastFailureTime?: number;
  lastError?: string;
  errorType?: string;
  lastLogTime?: number; // 最后一次日志输出时间
}

export class RiskControlManager {
  private status: RiskControlStatus = {
    isBlocked: false,
    blockDuration: 0,
    consecutiveFailures: 0,
  };

  private readonly MAX_CONSECUTIVE_FAILURES = 3; // 连续失败次数阈值
  private readonly BASE_BLOCK_DURATION = 5 * 60 * 1000; // 基础暂停时间：5分钟
  private readonly MAX_BLOCK_DURATION = 60 * 60 * 1000; // 最大暂停时间：1小时
  private readonly LOG_INTERVAL = 5 * 60 * 1000; // 日志输出间隔：5分钟

  /**
   * 检查是否被风控
   */
  isCurrentlyBlocked(): boolean {
    if (!this.status.isBlocked) {
      return false;
    }

    // 检查暂停时间是否已过
    if (
      this.status.blockStartTime &&
      Date.now() - this.status.blockStartTime >= this.status.blockDuration
    ) {
      this.clearBlock();
      return false;
    }

    return true;
  }

  /**
   * 记录API请求失败
   */
  recordFailure(error: string, context?: { uid?: string; name?: string; api?: string }): void {
    // 分析错误类型
    const errorType = this.analyzeErrorType(error);

    // 检查是否是风控相关错误
    if (this.isRiskControlError(error)) {
      this.status.consecutiveFailures++;
      this.status.lastFailureTime = Date.now();
      this.status.lastError = error;
      this.status.errorType = errorType;

      // 如果连续失败次数达到阈值，启动暂停机制
      if (this.status.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
        this.activateBlock(context);
      }
    }
  }

  /**
   * 记录API请求成功
   */
  recordSuccess(): void {
    // 成功时重置连续失败计数
    this.status.consecutiveFailures = 0;
    this.status.lastFailureTime = undefined;
    this.status.lastError = undefined;
    this.status.errorType = undefined;
  }

  /**
   * 获取剩余暂停时间（毫秒）
   */
  getRemainingBlockTime(): number {
    if (!this.status.isBlocked || !this.status.blockStartTime) {
      return 0;
    }

    const elapsed = Date.now() - this.status.blockStartTime;
    return Math.max(0, this.status.blockDuration - elapsed);
  }

  /**
   * 检查是否应该输出日志（避免重复日志）
   */
  shouldLogWarning(): boolean {
    if (!this.status.isBlocked) return false;

    // 如果是第一次或者距离上次日志输出超过间隔时间
    if (!this.status.lastLogTime || Date.now() - this.status.lastLogTime >= this.LOG_INTERVAL) {
      this.status.lastLogTime = Date.now();
      return true;
    }

    return false;
  }

  /**
   * 获取详细的风控信息
   */
  getDetailedBlockInfo(): {
    errorType: string;
    lastError: string;
    remainingMinutes: number;
    consecutiveFailures: number;
    blockLevel: string;
  } {
    const remainingTime = this.getRemainingBlockTime();
    const remainingMinutes = Math.ceil(remainingTime / 60000);

    // 根据连续失败次数确定风控等级
    let blockLevel = '轻度';
    if (this.status.consecutiveFailures >= 6) blockLevel = '严重';
    else if (this.status.consecutiveFailures >= 4) blockLevel = '中度';

    return {
      errorType: this.status.errorType || '未知',
      lastError: this.status.lastError || '无详细信息',
      remainingMinutes,
      consecutiveFailures: this.status.consecutiveFailures,
      blockLevel,
    };
  }

  /**
   * 获取状态信息
   */
  getStatus(): RiskControlStatus & { remainingTime: number } {
    return {
      ...this.status,
      remainingTime: this.getRemainingBlockTime(),
    };
  }

  /**
   * 手动重置状态
   */
  reset(): void {
    this.status = {
      isBlocked: false,
      blockDuration: 0,
      consecutiveFailures: 0,
    };
  }

  /**
   * 分析错误类型
   */
  private analyzeErrorType(error: string): string {
    if (error.includes('-352')) return '访问频率限制';
    if (error.includes('-503')) return '服务暂时不可用';
    if (error.includes('-509')) return '请求过于频繁';
    if (error.includes('-799')) return 'IP被限制';
    if (error.includes('User-Agent')) return 'User-Agent异常';
    if (error.includes('风控') || error.includes('拦截')) return '风控检测';
    if (error.includes('频繁')) return '请求频率过高';
    return '未知风控类型';
  }

  /**
   * 检查是否是风控相关错误
   */
  private isRiskControlError(error: string): boolean {
    const riskControlKeywords = [
      '-352',
      '请求被风控',
      '请求被拦截',
      '风控',
      'User-Agent',
      '请求过于频繁',
      '-503',
      '-509',
      '-799',
    ];

    return riskControlKeywords.some(keyword => error.includes(keyword));
  }

  /**
   * 激活暂停机制
   */
  private activateBlock(context?: { uid?: string; name?: string; api?: string }): void {
    // 计算暂停时间（指数退避）
    const multiplier = Math.min(
      this.status.consecutiveFailures - this.MAX_CONSECUTIVE_FAILURES + 1,
      4,
    );
    this.status.blockDuration = Math.min(
      this.BASE_BLOCK_DURATION * Math.pow(2, multiplier),
      this.MAX_BLOCK_DURATION,
    );

    this.status.isBlocked = true;
    this.status.blockStartTime = Date.now();
    this.status.lastLogTime = Date.now(); // 记录激活时的日志时间
  }

  /**
   * 清除暂停状态
   */
  private clearBlock(): void {
    this.status.isBlocked = false;
    this.status.blockStartTime = undefined;
    this.status.blockDuration = 0;
    this.status.consecutiveFailures = 0;
    this.status.lastLogTime = undefined;
  }
}
