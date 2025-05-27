import { Context, Service, Schema } from 'koishi';
import { Config } from './types';

export class ServerManager extends Service {
  static inject = ['database', 'notifier'];
  
  private servers: any[] = [];
  private config: Config;

  constructor(ctx: Context, config: Config) {
    super(ctx, 'sm');
    this.config = config;
    this.registerCommands();
  }

  private registerCommands() {
    const sysCom = this.ctx.command('sys', 'bili-notify插件运行相关指令', {
      permissions: ['authority:5'],
    });

    sysCom
      .subcommand('.restart', '重启插件')
      .usage('重启插件')
      .example('sys restart')
      .action(async () => {
        this.logger.info('调用sys restart指令');
        if (await this.restartPlugin()) {
          return '插件重启成功';
        }
        return '插件重启失败';
      });

    sysCom
      .subcommand('.stop', '停止插件')
      .usage('停止插件')
      .example('sys stop')
      .action(async () => {
        this.logger.info('调用sys stop指令');
        if (await this.disposePlugin()) {
          return '插件已停止';
        }
        return '停止插件失败';
      });

    sysCom
      .subcommand('.start', '启动插件')
      .usage('启动插件')
      .example('sys start')
      .action(async () => {
        this.logger.info('调用sys start指令');
        if (await this.registerPlugin()) {
          return '插件启动成功';
        }
        return '插件启动失败';
      });
  }

  protected start(): void | Promise<void> {
    if (!this.registerPlugin()) {
      this.logger.error('插件启动失败');
    }
  }

  async registerPlugin(): Promise<boolean> {
    if (this.servers.length !== 0) return false;

    try {
      // 注册各个服务
      const ba = this.ctx.plugin(require('../services/bilibili/api').default, {
        userAgent: this.config.userAgent,
        key: this.config.key,
      });

      const gi = this.ctx.plugin(require('../services/notification/formatter').default, {
        filter: this.config.filter,
        removeBorder: this.config.removeBorder,
        cardColorStart: this.config.cardColorStart,
        cardColorEnd: this.config.cardColorEnd,
        cardBasePlateColor: this.config.cardBasePlateColor,
        cardBasePlateBorder: this.config.cardBasePlateBorder,
        hideDesc: this.config.hideDesc,
        enableLargeFont: this.config.enableLargeFont,
        followerDisplay: this.config.followerDisplay,
      });

      const cr = this.ctx.plugin(require('../commands/bilibili').default, {
        sub: this.config.sub,
        master: this.config.master,
        restartPush: this.config.restartPush,
        pushTime: this.config.pushTime,
        pushImgsInDynamic: this.config.pushImgsInDynamic,
        customLiveStart: this.config.customLiveStart,
        customLive: this.config.customLive,
        customLiveEnd: this.config.customLiveEnd,
        dynamicUrl: this.config.dynamicUrl,
        filter: this.config.filter,
        dynamicDebugMode: this.config.dynamicDebugMode,
      });

      const bl = this.ctx.plugin(require('../services/bilibili/live').default);

      this.servers.push(ba, bl, gi, cr);
      return true;
    } catch (e) {
      this.logger.error('插件注册失败', e);
      return false;
    }
  }

  async disposePlugin(): Promise<boolean> {
    if (this.servers.length === 0) return false;

    await Promise.all(this.servers.map(server => server.dispose()));
    this.servers = [];
    return true;
  }

  async restartPlugin(): Promise<boolean> {
    if (this.servers.length === 0) return false;

    await this.disposePlugin();
    return new Promise((resolve) => {
      this.ctx.setTimeout(() => {
        try {
          this.registerPlugin();
          resolve(true);
        } catch (e) {
          this.logger.error('重启插件失败', e);
          resolve(false);
        }
      }, 1000);
    });
  }
} 
