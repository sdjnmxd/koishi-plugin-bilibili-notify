/**
 * 消息模板格式化工具
 */

export interface MessageTemplateData {
  name: string;
  title?: string;
  url?: string;
  online?: string;
  time?: string;
  follower?: string;
  followerChange?: string;
}

/**
 * 格式化消息模板
 * @param template 消息模板
 * @param data 模板数据
 * @returns 格式化后的消息
 */
export function formatMessage(template: string, data: MessageTemplateData): string {
  if (!template) {
    return '';
  }

  let formattedMessage = template;

  // 替换变量
  formattedMessage = formattedMessage
    .replace(/\{name\}/g, data.name || '')
    .replace(/\{title\}/g, data.title || '')
    .replace(/\{url\}/g, data.url || '')
    .replace(/\{online\}/g, data.online || '')
    .replace(/\{time\}/g, data.time || '')
    .replace(/\{follower\}/g, data.follower || '')
    .replace(/\{followerChange\}/g, data.followerChange || '');

  // 处理换行符 - 将 \n 转换为真正的换行符
  formattedMessage = formattedMessage.replace(/\\n/g, '\n');

  return formattedMessage;
}

/**
 * 格式化开播消息
 */
export function formatLiveStartMessage(
  template: string,
  data: {
    name: string;
    title: string;
    url: string;
    follower?: string;
    time?: string;
  },
): string {
  return formatMessage(template, {
    name: data.name,
    title: data.title,
    url: data.url,
    follower: data.follower,
    time: data.time,
  });
}

/**
 * 格式化直播中消息
 */
export function formatLiveMessage(
  template: string,
  data: {
    name: string;
    title: string;
    url: string;
    online: string;
    time: string;
  },
): string {
  return formatMessage(template, {
    name: data.name,
    title: data.title,
    url: data.url,
    online: data.online,
    time: data.time,
  });
}

/**
 * 格式化下播消息
 */
export function formatLiveEndMessage(
  template: string,
  data: {
    name: string;
    time?: string;
    followerChange?: string;
  },
): string {
  return formatMessage(template, {
    name: data.name,
    time: data.time,
    followerChange: data.followerChange,
  });
}
