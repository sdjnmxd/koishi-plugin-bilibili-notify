import { Target } from './common';
import { CardStyle } from './index';

/**
 * 订阅项
 */
export interface SubItem {
  id: number;
  uid: string;
  uname: string;
  roomId: string;
  target: Target;
  pushTarget?: Target;
  platform: string;
  live: boolean;
  dynamic: boolean;
  lastDynamicId?: string;
  card: {
    enable: boolean;
    cardColorStart: string;
    cardColorEnd: string;
    cardBasePlateColor: string;
    cardBasePlateBorder: string;
  };
}

/**
 * 用户信息
 */
export interface UserInfo {
  uid: string;
  name: string; // 添加name字段
  uname?: string; // 保持向后兼容
  face: string;
  sign?: string;
  level?: number;
  follower?: number;
  following?: number;
  roomId?: string; // 添加roomId字段
}

/**
 * 动态项
 */
export interface DynamicItem {
  id_str: string;
  type: string;
  modules?: {
    module_author?: {
      name?: string;
      pub_ts?: number;
    };
    module_dynamic?: {
      desc?: {
        text?: string;
        rich_text_nodes?: Array<{
          type: string;
          text?: string;
          orig_text?: string;
        }>;
      };
      major?: {
        archive?: {
          title?: string;
          desc?: string;
        };
        article?: {
          title?: string;
          desc?: string;
        };
        opus?: {
          summary?: {
            rich_text_nodes?: Array<{
              text?: string;
            }>;
          };
        };
      };
    };
  };
  author?: any;
  timestamp?: number;
}

/**
 * 直播状态
 */
export interface LiveStatus {
  live_status: number;
  title: string;
  cover: string;
  online: number;
}

/**
 * 订阅配置项
 */
export interface SubscriptionItem {
  uid: string;
  name: string; // 用户名称
  dynamic: boolean;
  live: boolean;
  targets: Array<{
    platform: string;
    channelId: string;
    dynamic: boolean;
    live: boolean;
    liveGuardBuy: boolean;
    atAll: boolean;
  }>;
  card?: CardStyle;
}

/**
 * B站动态API响应类型
 */
export interface AllDynamicInfo {
  code: number;
  message: string;
  data: {
    items: Array<{
      id_str: string;
      type: string;
      modules: {
        module_author: {
          mid: number;
          name: string;
          pub_ts: number;
        };
        module_dynamic: {
          desc?: {
            text: string;
          };
          major?: {
            archive?: {
              jump_url: string;
            };
            draw?: {
              items: Array<{
                src: string;
              }>;
            };
            opus?: {
              summary?: {
                rich_text_nodes: Array<{
                  text?: string;
                }>;
              };
            };
          };
        };
      };
    }>;
  };
}

/**
 * 动态类型（简化版）
 */
export interface Dynamic {
  id_str: string;
  type: string;
  modules: {
    module_author: {
      mid: number;
      name: string;
      pub_ts: number;
    };
    module_dynamic: {
      desc?: {
        text: string;
      };
      major?: any;
    };
  };
}
