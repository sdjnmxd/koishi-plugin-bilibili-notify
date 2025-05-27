// 基础类型定义
export interface BaseConfig {
  enable: boolean;
}

// 用户信息
export interface UserInfo {
  uid: string;
  name: string;
  face?: string;
  roomId?: string;
}

// 订阅目标
export interface SubscriptionTarget {
  platform: string;
  channelId: string;
  dynamic: boolean;
  live: boolean;
  liveGuardBuy: boolean;
  atAll: boolean;
}

// 订阅项
export interface SubscriptionItem {
  uid: string;
  name?: string;
  dynamic: boolean;
  live: boolean;
  targets: SubscriptionTarget[];
  card?: CardStyle;
}

// 卡片样式
export interface CardStyle {
  enable: boolean;
  cardColorStart: string;
  cardColorEnd: string;
  cardBasePlateColor: string;
  cardBasePlateBorder: string;
}

// 过滤器配置
export interface FilterConfig extends BaseConfig {
  regex?: string;
  keywords: string[];
}

// 动态过滤器配置
export interface DynamicFilterConfig extends FilterConfig {
  forward?: boolean;
  article?: boolean;
}

// 主人配置
export interface MasterConfig extends BaseConfig {
  platform: string;
  account: string;
  guildId?: string;
}

// 推送类型
export enum PushType {
  Dynamic = 'dynamic',
  Live = 'live',
  LiveStart = 'live_start',
  LiveEnd = 'live_end',
  LiveGuardBuy = 'live_guard_buy',
}

// 直播状态
export enum LiveStatus {
  Offline = 0,
  Starting = 1,
  Online = 2,
  Ending = 3,
}

// 动态类型
export enum DynamicType {
  Forward = 'DYNAMIC_TYPE_FORWARD',
  Article = 'DYNAMIC_TYPE_ARTICLE',
  Video = 'DYNAMIC_TYPE_AV',
  Draw = 'DYNAMIC_TYPE_DRAW',
}

// API响应基础类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

// 操作结果
export interface OperationResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: Error;
}

// 事件类型
export interface EventData {
  type: string;
  payload: any;
  timestamp: number;
}

// 导出其他模块的类型
export * from './base';
export * from './common';
export * from './subscription';
