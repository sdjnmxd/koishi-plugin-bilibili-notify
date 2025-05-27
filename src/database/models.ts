import { Context } from 'koishi';

// 登录信息表
export interface BilibiliNotifyLogin {
  id: number;
  bili_cookies: string;
  bili_refresh_token: string;
  // TODO: 实现订阅功能时使用，用于存储B站"订阅"分组的ID，管理插件订阅的用户
  dynamic_group_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

// 初始化数据库表
export function initializeDatabase(ctx: Context) {
  // 登录信息表
  ctx.model.extend(
    'bilibili-notify-modern-login',
    {
      id: 'unsigned',
      bili_cookies: 'text',
      bili_refresh_token: 'text',
      // TODO: 实现订阅功能时启用此字段
      dynamic_group_id: 'string',
      created_at: 'timestamp',
      updated_at: 'timestamp',
    },
    {
      primary: 'id',
      autoInc: true,
    },
  );
}

declare module 'koishi' {
  interface Tables {
    'bilibili-notify-modern-login': BilibiliNotifyLogin;
  }
}
