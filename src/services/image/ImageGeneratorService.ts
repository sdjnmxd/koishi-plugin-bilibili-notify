import { Context, Logger } from 'koishi';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Service } from '../../types/base';
import { AllDynamicInfo } from '../../types/subscription';
import { createLogger } from '../../utils/logger';

// 动态类型常量
const DYNAMIC_TYPE_NONE = 'DYNAMIC_TYPE_NONE';
const DYNAMIC_TYPE_FORWARD = 'DYNAMIC_TYPE_FORWARD';
const DYNAMIC_TYPE_AV = 'DYNAMIC_TYPE_AV';
const DYNAMIC_TYPE_PGC = 'DYNAMIC_TYPE_PGC';
const DYNAMIC_TYPE_WORD = 'DYNAMIC_TYPE_WORD';
const DYNAMIC_TYPE_DRAW = 'DYNAMIC_TYPE_DRAW';
const DYNAMIC_TYPE_ARTICLE = 'DYNAMIC_TYPE_ARTICLE';
const DYNAMIC_TYPE_MUSIC = 'DYNAMIC_TYPE_MUSIC';
const DYNAMIC_TYPE_COMMON_SQUARE = 'DYNAMIC_TYPE_COMMON_SQUARE';
const DYNAMIC_TYPE_LIVE = 'DYNAMIC_TYPE_LIVE';
const DYNAMIC_TYPE_MEDIALIST = 'DYNAMIC_TYPE_MEDIALIST';
const DYNAMIC_TYPE_COURSES_SEASON = 'DYNAMIC_TYPE_COURSES_SEASON';
const DYNAMIC_TYPE_LIVE_RCMD = 'DYNAMIC_TYPE_LIVE_RCMD';
const DYNAMIC_TYPE_UGC_SEASON = 'DYNAMIC_TYPE_UGC_SEASON';

interface CardConfig {
  removeBorder: boolean;
  cardColorStart: string;
  cardColorEnd: string;
  cardBasePlateColor: string;
  cardBasePlateBorder: string;
  enableLargeFont: boolean;
  font: string;
  hideDesc: boolean;
  followerDisplay: boolean;
}

// 声明 puppeteer 模块
declare module 'koishi' {
  interface Context {
    puppeteer?: {
      page(): Promise<{
        goto(url: string): Promise<void>;
        setContent(html: string, options?: { waitUntil: string }): Promise<void>;
        $(selector: string): Promise<{
          boundingBox(): Promise<{ x: number; y: number; width: number; height: number }>;
          dispose(): Promise<void>;
        }>;
        screenshot(options: {
          type: string;
          clip: { x: number; y: number; width: number; height: number };
        }): Promise<Buffer>;
        close(): Promise<void>;
      }>;
    };
  }
}

export class ImageGeneratorService extends Service {
  static inject = ['puppeteer'];

  public logger: Logger;
  private defaultConfig: CardConfig;

  constructor(ctx: Context) {
    super(ctx, {});
    this.logger = createLogger(ctx, 'IMAGE_GENERATOR');

    this.defaultConfig = {
      removeBorder: false,
      cardColorStart: '#74b9ff',
      cardColorEnd: '#0984e3',
      cardBasePlateColor: '#ffffff',
      cardBasePlateBorder: '0px',
      enableLargeFont: false,
      font: 'Microsoft YaHei',
      hideDesc: false,
      followerDisplay: true,
    };
  }

  /**
   * 获取服务状态
   */
  get status() {
    return {
      initialized: true,
      puppeteerAvailable: !!this.ctx.puppeteer,
      defaultConfig: this.defaultConfig,
    };
  }

  /**
   * 初始化图片生成器
   */
  async initialize(): Promise<boolean> {
    try {
      if (!this.ctx.puppeteer) {
        this.logger.warn('Puppeteer服务未找到，图片生成功能将不可用');
        return false;
      }

      this.logger.info('图片生成服务初始化成功');
      return true;
    } catch (error) {
      this.logger.error('图片生成服务初始化失败:', error);
      return false;
    }
  }

  /**
   * 处理HTML页面生成图片
   */
  async imgHandler(html: string): Promise<Buffer> {
    const htmlPath = `file://${__dirname.replace(/\\/g, '/')}/../../page/0.html`;
    const page = await this.ctx.puppeteer.page();

    try {
      await page.goto(htmlPath);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const elementHandle = await page.$('html');
      const boundingBox = await elementHandle.boundingBox();
      const buffer = await page.screenshot({
        type: 'jpeg',
        clip: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      });
      await elementHandle.dispose();
      return buffer;
    } finally {
      await page.close();
    }
  }

  /**
   * 生成动态卡片
   */
  async generateDynamicCard(
    data: AllDynamicInfo,
    config: Partial<CardConfig> = {},
  ): Promise<Buffer | null> {
    try {
      if (!this.ctx.puppeteer) {
        throw new Error('Puppeteer服务未找到');
      }

      const finalConfig = { ...this.defaultConfig, ...config };

      // 提取动态数据
      if (!data.data?.items?.length) {
        throw new Error('动态数据为空');
      }

      const item = data.data.items[0];
      const html = await this.buildDynamicHTML(item, finalConfig);

      return await this.imgHandler(html);
    } catch (error) {
      this.logger.error('生成动态卡片失败:', error);
      return null;
    }
  }

  /**
   * 生成直播卡片
   */
  async generateLiveCard(
    data: any,
    username: string,
    userface: string,
    followerDisplay: string,
    liveStatus: number,
    config: Partial<CardConfig> = {},
  ): Promise<Buffer | null> {
    try {
      if (!this.ctx.puppeteer) {
        throw new Error('Puppeteer服务未找到');
      }

      const finalConfig = { ...this.defaultConfig, ...config };
      const [titleStatus, liveTime, cover] = await this.getLiveStatus(data.live_time, liveStatus);

      // 加载字体
      const fontURL = pathToFileURL(resolve(__dirname, '../../font/HYZhengYuan-75W.ttf'));

      const html = /* html */ `
        <!DOCTYPE html>
        <html>
        <head>
          <title>直播通知</title>
          <style>
            @font-face {
              font-family: "Custom Font";
              src: url(${fontURL});
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              font-family: "${finalConfig.font}", "Custom Font", "Microsoft YaHei", "Source Han Sans", "Noto Sans CJK", sans-serif;
            }

            html {
              width: 800px;
              height: auto;
            }

            .background {
              width: 100%;
              height: auto;
              padding: 15px;
              background: linear-gradient(to right bottom, ${finalConfig.cardColorStart}, ${finalConfig.cardColorEnd});
              overflow: hidden;
            }

            .base-plate {
              width: 100%;
              height: auto;
              box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
              padding: ${finalConfig.cardBasePlateBorder};
              border-radius: 10px;
              background-color: ${finalConfig.cardBasePlateColor};
            }

            .card {
              width: 100%;
              height: auto;
              border-radius: 5px;
              padding: 15px;
              overflow: hidden;
              background-color: #fff;
            }

            .card img {
              border-radius: 5px 5px 0 0;
              max-width: 100%;
              max-height: 80%;
            }

            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 5px;
              margin-bottom: 10px;
            }

            .card-title {
              line-height: 50px;
            }

            .card-body {
              padding: 2px 16px;
              margin-bottom: 10px;
            }

            .live-broadcast-info {
              display: flex;
              align-items: center;
              margin-bottom: 10px;
            }

            .anchor-avatar {
              width: 50px;
              height: auto;
              box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
            }

            .broadcast-message {
              display: inline-block;
              margin-left: 10px;
              font-size: 20px;
              color: #333;
            }

            .card-text {
              color: grey;
              font-size: 20px;
            }

            .card-link {
              display: flex;
              justify-content: space-between;
              text-decoration: none;
              font-size: 20px;
              margin-top: 10px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="background">
            <div ${finalConfig.removeBorder ? '' : 'class="base-plate"'}>
              <div class="card">
                <img src="${cover ? data.user_cover : data.keyframe}" alt="封面">
                <div class="card-body">
                  <div class="card-header">
                    <h1 class="card-title">${data.title}</h1>
                    <div class="live-broadcast-info">
                      <img style="border-radius: 10px; margin-left: 10px" class="anchor-avatar" src="${userface}" alt="主播头像">
                      <span class="broadcast-message">${username}${titleStatus}</span>
                    </div>
                  </div>
                  ${finalConfig.hideDesc ? '' : `<p class="card-text">${data.description ? data.description : '这个主播很懒，什么简介都没写'}</p>`}
                  <p class="card-link">
                    <span>人气：${data.online > 10000 ? `${(data.online / 10000).toFixed(1)}万` : data.online}</span>
                    <span>分区名称：${data.area_name}</span>
                  </p>
                  <p class="card-link">
                    <span>${liveTime}</span>
                    ${
                      finalConfig.followerDisplay
                        ? `
                      <span>
                        ${
                          liveStatus === 1
                            ? `当前粉丝数：${followerDisplay}`
                            : liveStatus === 2
                              ? `累计观看人数：${followerDisplay}`
                              : liveStatus === 3
                                ? `粉丝数变化：${followerDisplay}`
                                : ''
                        }
                      </span>`
                        : ''
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      return await this.imgHandler(html);
    } catch (error) {
      this.logger.error('生成直播卡片失败:', error);
      return null;
    }
  }

  /**
   * 构建动态HTML
   */
  private async buildDynamicHTML(item: any, config: CardConfig): Promise<string> {
    // 加载字体
    const fontURL = pathToFileURL(resolve(__dirname, '../../font/HYZhengYuan-75W.ttf'));

    // 提取基础信息
    const module_author = item.modules.module_author;
    const avatarUrl = module_author.face;
    const upName = module_author.name;
    const pubTime = this.unixTimestampToString(module_author.pub_ts);

    // 提取统计信息
    const module_stat = item.modules.module_stat;
    const comment = module_stat.comment.count;
    const forward = module_stat.forward.count;
    const like = module_stat.like.count;

    // 提取话题
    const topic = item.modules.module_dynamic.topic ? item.modules.module_dynamic.topic.name : '';

    // 构建主要内容
    const [main, link] = await this.getDynamicMajor(item, false);

    const html = /* html */ `
      <!DOCTYPE html>
      <html>
      <head>
        <title>动态卡片</title>
        <style>
          @font-face {
            font-family: "Custom Font";
            src: url(${fontURL});
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: "${config.font}", "Custom Font", "Microsoft YaHei", "Source Han Sans", "Noto Sans CJK", sans-serif;
          }

          html {
            width: 800px;
            height: auto;
          }

          .background {
            width: 100%;
            height: auto;
            padding: 15px;
            background: linear-gradient(to right bottom, ${config.cardColorStart}, ${config.cardColorEnd});
            overflow: hidden;
          }

          .base-plate {
            width: 100%;
            height: auto;
            box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2);
            padding: ${config.cardBasePlateBorder};
            border-radius: 10px;
            background-color: ${config.cardBasePlateColor};
          }

          .card {
            width: 100%;
            height: auto;
            border-radius: 5px;
            padding: 15px;
            overflow: hidden;
            background-color: #fff;
          }

          .card-details {
            margin-bottom: 15px;
            line-height: 1.6;
          }

          .dyn-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
          }

          .card-major {
            margin: 15px 0;
          }

          .photo-item, .four-photo-item, .single-photo-item {
            max-width: 100%;
            border-radius: 8px;
            margin: 5px;
          }

          .four-photo-item {
            width: calc(50% - 10px);
          }

          .single-photo-container {
            position: relative;
            display: inline-block;
          }

          .single-photo-mask {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            text-align: center;
            padding: 10px;
          }

          .card-forward {
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            background-color: #f8f9fa;
          }

          .forward-userinfo {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
          }

          .forward-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            margin-right: 10px;
          }

          .forward-username {
            font-weight: bold;
            color: #1da1f2;
          }

          .user-info {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
          }

          .avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            margin-right: 12px;
          }

          .username {
            font-weight: bold;
            font-size: 18px;
            color: #333;
          }

          .pub-time {
            color: #666;
            font-size: 14px;
            margin-left: 10px;
          }

          .stats {
            display: flex;
            justify-content: space-around;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e1e8ed;
          }

          .stat-item {
            display: flex;
            align-items: center;
            color: #666;
          }

          .stat-item svg {
            margin-right: 5px;
          }
        </style>
      </head>
      <body>
        <div class="background">
          <div ${config.removeBorder ? '' : 'class="base-plate"'}>
            <div class="card">
              <div class="user-info">
                <img class="avatar" src="${avatarUrl}" alt="头像">
                <div>
                  <div class="username">${upName}</div>
                  <div class="pub-time">${pubTime}</div>
                </div>
              </div>

              ${topic ? `<div class="topic">#${topic}#</div>` : ''}

              ${main}

              <div class="stats">
                <div class="stat-item">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M9 0C4.029 0 0 4.029 0 9s4.029 9 9 9 9-4.029 9-9S13.971 0 9 0zm0 16.2c-3.969 0-7.2-3.231-7.2-7.2S5.031 1.8 9 1.8s7.2 3.231 7.2 7.2-3.231 7.2-7.2 7.2z"/>
                    <path d="M9 4.5c-.828 0-1.5.672-1.5 1.5v3c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5V6c0-.828-.672-1.5-1.5-1.5z"/>
                  </svg>
                  <span>${comment}</span>
                </div>
                <div class="stat-item">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M17.726 13.02L14.738 9.02c-.24-.32-.66-.5-1.08-.5H12V7c0-.55-.45-1-1-1H8c-.55 0-1 .45-1 1v1H5.342c-.42 0-.84.18-1.08.5L1.274 13.02c-.24.32-.24.78 0 1.1.24.32.66.5 1.08.5H17.646c.42 0 .84-.18 1.08-.5.24-.32.24-.78 0-1.1z"/>
                  </svg>
                  <span>${forward}</span>
                </div>
                <div class="stat-item">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                    <path d="M12.76 3.76l-8.48 8.48c-.78.78-.78 2.05 0 2.83.78.78 2.05.78 2.83 0l8.48-8.48c.78-.78.78-2.05 0-2.83-.78-.78-2.05-.78-2.83 0z"/>
                    <path d="M5.24 3.76c-.78-.78-2.05-.78-2.83 0-.78.78-.78 2.05 0 2.83l8.48 8.48c.78.78 2.05.78 2.83 0 .78-.78.78-2.05 0-2.83L5.24 3.76z"/>
                  </svg>
                  <span>${like}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * 获取动态主要内容
   */
  private async getDynamicMajor(
    dynamic: any,
    forward: boolean,
  ): Promise<[string, string, string?]> {
    let main = '';
    const link = '';
    let forwardInfo: string;

    // 基础图文处理
    const basicDynamic = () => {
      const module_dynamic = dynamic.modules.module_dynamic;
      if (module_dynamic?.major?.opus?.summary) {
        const richText = module_dynamic.major.opus.summary.rich_text_nodes.reduce(
          (accumulator: string, currentValue: any) => {
            if (currentValue.emoji) {
              return `${accumulator}<img style="width:28px; height:28px;" src="${currentValue.emoji.icon_url}"/>`;
            }
            return accumulator + currentValue.text;
          },
          '',
        );

        const text = richText.replace(/\n/g, '<br>');

        if (text) {
          main += `
            <div class="card-details">
              ${module_dynamic.major.opus.title ? `<h1 class="dyn-title">${module_dynamic.major.opus.title}</h1>` : ''}
              ${text}
            </div>
          `;
        }
      }

      // 图片处理
      let major = '';
      const arrowImg = pathToFileURL(resolve(__dirname, '../../img/arrow.png'));

      if (module_dynamic?.major?.opus?.pics) {
        if (module_dynamic.major.opus.pics.length === 1) {
          const height = module_dynamic.major.opus.pics[0].height;
          if (height > 3000) {
            major += `
              <div class="single-photo-container">
                <img class="single-photo-item" src="${module_dynamic.major.opus.pics[0].url}"/>
                <div class="single-photo-mask">
                  <span class="single-photo-mask-text">点击链接浏览全部</span>
                </div>
                <img class="single-photo-mask-arrow" src="${arrowImg}"/>
              </div>
            `;
          } else {
            major += `
              <div class="single-photo-container">
                <img class="single-photo-item" src="${module_dynamic.major.opus.pics[0].url}"/>
              </div>
            `;
          }
        } else if (module_dynamic.major.opus.pics.length === 4) {
          major += module_dynamic.major.opus.pics.reduce((acc: string, cV: any) => {
            return `${acc}<img class="four-photo-item" src="${cV.url}"/>`;
          }, '');
        } else {
          major += module_dynamic.major.opus.pics.reduce((acc: string, cV: any) => {
            return `${acc}<img class="photo-item" src="${cV.url}"/>`;
          }, '');
        }

        main += `<div class="card-major">${major}</div>`;
      }
    };

    // 根据动态类型处理
    switch (dynamic.type) {
      case DYNAMIC_TYPE_WORD:
      case DYNAMIC_TYPE_DRAW:
      case DYNAMIC_TYPE_FORWARD: {
        basicDynamic();

        // 转发动态处理
        if (dynamic.type === DYNAMIC_TYPE_FORWARD) {
          const forward_module_author = dynamic.orig.modules.module_author;
          const forwardUserAvatarUrl = forward_module_author.face;
          const forwardUserName = forward_module_author.name;

          const [forwardMain, _, forwardInfo] = await this.getDynamicMajor(dynamic.orig, true);

          main += `
            <div class="card-forward">
              <div class="forward-userinfo">
                <img class="forward-avatar" src="${forwardUserAvatarUrl}" alt="avatar">
                <span class="forward-username">${forwardUserName} ${forwardInfo ? forwardInfo : ''}</span>
              </div>
              <div class="forward-main">
                ${forwardMain}
              </div>
            </div>
          `;
        }
        break;
      }
      // 可以继续添加其他动态类型的处理
    }

    return [main, link, forwardInfo];
  }

  /**
   * 获取直播状态
   */
  private async getLiveStatus(
    time: string,
    liveStatus: number,
  ): Promise<[string, string, boolean]> {
    let titleStatus: string;
    let liveTime: string;
    let cover: boolean;

    switch (liveStatus) {
      case 0: {
        titleStatus = '未直播';
        liveTime = '未开播';
        cover = true;
        break;
      }
      case 1: {
        titleStatus = '开播啦';
        liveTime = `开播时间：${time}`;
        cover = true;
        break;
      }
      case 2: {
        titleStatus = '正在直播';
        liveTime = `直播时长：${await this.getTimeDifference(time)}`;
        cover = false;
        break;
      }
      case 3: {
        titleStatus = '下播啦';
        liveTime = `开播时间：${time}`;
        cover = true;
        break;
      }
    }

    return [titleStatus, liveTime, cover];
  }

  /**
   * 计算时间差
   */
  private async getTimeDifference(dateString: string): Promise<string> {
    const apiDateTime = new Date(dateString + ' UTC+8');
    const currentDateTime = new Date();
    const diff = currentDateTime.getTime() - apiDateTime.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分${seconds % 60}秒`;
    return `${seconds}秒`;
  }

  /**
   * Unix时间戳转字符串
   */
  private unixTimestampToString(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = `0${date.getMonth() + 1}`.slice(-2);
    const day = `0${date.getDate()}`.slice(-2);
    const hours = `0${date.getHours()}`.slice(-2);
    const minutes = `0${date.getMinutes()}`.slice(-2);
    const seconds = `0${date.getSeconds()}`.slice(-2);
    return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
  }
}

declare module 'koishi' {
  interface Context {
    imageGeneratorService: ImageGeneratorService;
  }
}
