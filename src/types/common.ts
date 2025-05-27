/**
 * 操作结果类型
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 推送类型枚举
 */
export enum PushType {
  Dynamic = 'dynamic',
  Live = 'live',
  LiveStart = 'live-start',
  LiveEnd = 'live-end',
  LiveGuardBuy = 'live-guard-buy',
}

/**
 * 平台类型
 */
export type Platform = 'onebot' | 'discord' | 'telegram' | 'qq' | 'kook';

/**
 * 目标频道配置
 */
export interface TargetChannel {
  channelId: string;
  dynamic: boolean;
  live: boolean;
  liveGuardBuy: boolean;
  atAll: boolean;
}

/**
 * 推送目标项
 */
export interface TargetItem {
  platform: string;
  channelArr: TargetChannel[];
}

/**
 * 推送目标（兼容 legacy 格式）
 */
export type Target = TargetItem[];

/**
 * 通知内容
 */
export interface NotificationContent {
  type: 'dynamic' | 'live';
  subType?: 'start' | 'end' | 'push';
  user: string;
  content: string;
  image?: Buffer;
  url?: string;
}
