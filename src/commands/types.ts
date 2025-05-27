import { Context } from 'koishi';

// 命令注册函数类型
export type CommandRegistrar = (ctx: Context, bili: any) => void;

// 服务操作结果类型
export interface ServiceOperationResult {
  success: boolean;
  error?: string;
}

// 登录状态类型
export interface LoginStatus {
  isLoggedIn: boolean;
  userInfo?: {
    name: string;
    uid: string;
    level?: string;
  };
}

// 服务状态类型
export interface ServiceStatus {
  isRunning: boolean;
  roomCount?: number;
}
