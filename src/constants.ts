// 插件基础信息
export const PLUGIN_NAME = 'bilibili-notify-modern';
export const PLUGIN_DESCRIPTION = 'Bilibili通知插件 - 现代化版本';

// 默认配置
export const DEFAULT_CONFIG = {
  // 连接配置
  MAX_CONNECTIONS: 5,
  RECONNECT_INTERVAL: 30000, // 30秒
  HEARTBEAT_INTERVAL: 30000, // 30秒

  // 轮询配置
  POLL_INTERVAL: 60000, // 60秒
  MAX_POLL_RETRIES: 3,

  // 超时配置
  REQUEST_TIMEOUT: 10000, // 10秒
  LOGIN_POLL_TIMEOUT: 180000, // 3分钟

  // 其他配置
  ENABLE_DANMAKU: true,
  ENABLE_DYNAMIC: true,
  ENABLE_LIVE: true,
} as const;

// API相关常量
export const API_ENDPOINTS = {
  BASE_URL: 'https://api.bilibili.com',
  LIVE_BASE_URL: 'https://api.live.bilibili.com',
  PASSPORT_BASE_URL: 'https://passport.bilibili.com',

  // 具体API端点
  NAV: '/x/web-interface/nav',
  USER_INFO: '/x/space/wbi/acc/info',
  USER_STATS: '/x/relation/stat',
  USER_DYNAMICS: '/x/polymer/web-dynamic/v1/feed/space',
  USER_SEARCH: '/x/web-interface/wbi/search/type',
  USER_ACCOUNT: '/x/member/web/account',

  // 直播相关端点
  ROOM_INFO: '/room/v1/Room/get_info',
  ROOM_INFO_OLD: '/room/v1/Room/getRoomInfoOld',
  ROOM_INIT: '/room/v1/Room/room_init',
  DANMU_INFO: '/xlive/web-room/v1/index/getDanmuInfo',
} as const;

// 域名常量
export const BILIBILI_DOMAINS = {
  MAIN: 'https://www.bilibili.com',
  LIVE: 'https://live.bilibili.com',
  API: 'https://api.bilibili.com',
  LIVE_API: 'https://api.live.bilibili.com',
} as const;

// HTTP请求相关常量
export const HTTP_CONFIG = {
  // 超时时间
  DEFAULT_TIMEOUT: 15000, // 15秒

  // 速率限制
  MIN_REQUEST_INTERVAL: 3000, // 3秒
  MAX_REQUEST_INTERVAL: 5000, // 5秒
  STARTUP_GRACE_PERIOD: 30000, // 30秒
  NORMAL_GRACE_PERIOD: 300000, // 5分钟

  // 重试配置
  DEFAULT_MAX_RETRIES: 3,
  BASE_RETRY_DELAY: 1000, // 1秒
  MAX_RETRY_DELAY: 10000, // 10秒

  // 风控重试配置
  RISK_CONTROL_MIN_DELAY: 10000, // 10秒
  RISK_CONTROL_MAX_DELAY: 30000, // 30秒
  RISK_CONTROL_EXTENDED_MIN_DELAY: 30000, // 30秒
  RISK_CONTROL_EXTENDED_MAX_DELAY: 90000, // 90秒

  // User-Agent轮换概率
  UA_ROTATION_PROBABILITY: 0.2, // 20%
} as const;

// WBI相关常量
export const WBI_CONFIG = {
  // 缓存时间
  CACHE_DURATION: 5 * 60 * 1000, // 5分钟

  // 混淆密钥长度
  MIXIN_KEY_LENGTH: 32,

  // WBI签名混淆表
  MIXIN_KEY_ENC_TAB: [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29,
    28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25,
    54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
  ],

  // 字符过滤正则
  CHAR_FILTER: /[!'()*]/g,
} as const;

// API响应码常量
export const API_RESPONSE_CODES = {
  SUCCESS: 0,
  NOT_LOGIN: -101,
  RISK_CONTROL: -352,
  FORBIDDEN: -403,
  NOT_FOUND: -404,
  TOO_FAST: -503,
  TOO_FREQUENT: -509,
  USER_NOT_EXIST: -626,
  RATE_LIMITED: -799,
} as const;

// 搜索相关常量
export const SEARCH_CONFIG = {
  MAX_USER_RESULTS: 10,
  USER_SEARCH_TYPE: 'bili_user',
} as const;

// Cookie相关常量
export const COOKIE_CONFIG = {
  ESSENTIAL_FIELDS: ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5'],
  DEFAULT_BUVID3: 'some_non_empty_value',
} as const;

export const BILIBILI_ERROR_CODES: Record<number, string> = {
  0: '成功',
  '-1': '应用程序不存在或已被封禁',
  '-2': 'Access key错误',
  '-3': 'API校验密匙错误',
  '-101': '账号未登录',
  '-102': '账号被封停',
  '-103': '积分不足',
  '-104': '硬币不足',
  '-105': '验证码错误',
  '-352': '请求被拦截，可能是User-Agent或请求头问题',
  '-400': '请求错误',
  '-403': '权限不足',
  '-404': '无视频',
  '-500': '服务器内部错误',
  '-503': '调用速度过快',
  '-509': '请求过于频繁',
  '-616': '上传文件不存在',
  '-617': '上传文件太大',
  '-625': '登录失败次数太多',
  '-626': '用户不存在',
  '-628': '密码太弱',
  '-629': '用户名或密码错误',
  '-632': '操作对象数量限制',
  '-643': '被锁定',
  '-650': '用户等级太低',
  '-652': '重复的内容',
  '-658': 'Token过期',
  '-662': '密码时间戳过期',
  '-688': '地理位置限制',
  '-689': '版权限制',
  '-701': '扣节操失败',
  '-799': '请求过于频繁',
  '-8888': '对不起，服务器开小差了~ (ಥ﹏ಥ)',
};

export const DEFAULT_REQUEST_USER_AGENT = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];
