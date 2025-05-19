import { Context } from 'koishi'
import { Config, Result, SubItem, Target, PushType } from '../core/types'
import { withLock, withRetry } from '../utils'
import { DateTime } from 'luxon'
import QRCode from 'qrcode'

export default class BiliCommands {
  static inject = ['ba', 'gi', 'database', 'bl', 'sm']

  private ctx: Context
  private config: Config
  private subManager: SubItem[] = []
  private dynamicTimelineManager: Map<string, number> = new Map()
  private loginTimer: () => void
  private dynamicJob: any
  private num = 0
  private rebootCount = 0

  constructor(ctx: Context, config: Config) {
    this.ctx = ctx
    this.config = config
    this.init(config)
    this.registerCommands()
  }

  private async init(config: Config) {
    await this.checkIfLoginInfoIsLoaded()
    const { code, msg } = await this.loadSubFromConfig(config.sub)
    if (code !== 0) {
      this.ctx.logger.error(msg)
    }
  }

  private registerCommands() {
    const biliCom = this.ctx.command('bili', 'bili-notify插件相关指令', {
      permissions: ['authority:3'],
    })

    biliCom
      .subcommand('.login', '登录B站之后才可以进行之后的操作')
      .usage('使用二维码登录，登录B站之后才可以进行之后的操作')
      .example('bili login')
      .action(async ({ session }) => {
        this.ctx.logger.info('调用bili login指令')
        const content = await this.ctx.ba.getLoginQRCode()
        if (content.code !== 0) {
          return await session.send('出问题咯，请联系管理员解决')
        }

        QRCode.toBuffer(
          content.data.url,
          {
            errorCorrectionLevel: 'H',
            type: 'png',
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          },
          async (err, buffer) => {
            if (err) return await session.send('二维码生成出错，请重新尝试')
            await session.send(h.image(buffer, 'image/jpeg'))
          },
        )

        if (this.loginTimer) this.loginTimer()
        let flag = true

        this.loginTimer = this.ctx.setInterval(async () => {
          if (!flag) return
          flag = false
          try {
            const loginContent = await this.ctx.ba.getLoginStatus(content.data.qrcode_key)
            if (loginContent.code !== 0) {
              this.loginTimer()
              return await session.send('登录失败请重试')
            }
            if (loginContent.data.code === 86038) {
              this.loginTimer()
              return await session.send('二维码已失效，请重新登录')
            }
            if (loginContent.data.code === 0) {
              const encryptedCookies = this.ctx.ba.encrypt(this.ctx.ba.getCookies())
              const encryptedRefreshToken = this.ctx.ba.encrypt(loginContent.data.refresh_token)
              await this.ctx.database.upsert('loginBili', [
                {
                  id: 1,
                  bili_cookies: encryptedCookies,
                  bili_refresh_token: encryptedRefreshToken,
                },
              ])
              this.loginTimer()
              const { code, msg } = await this.loadSubFromConfig(this.config.sub)
              if (code !== 0) this.ctx.logger.error(msg)
              this.ctx.ba.disposeNotifier()
              await session.send('登录成功')
              await session.execute('bili show')
              this.ctx.ba.enableRefreshCookiesDetect()
            }
          } finally {
            flag = true
          }
        }, 1000)
      })

    biliCom
      .subcommand('.list', '展示订阅对象')
      .usage('展示订阅对象')
      .example('bili list')
      .action(() => {
        return this.subShow()
      })

    // 添加更多命令...
  }

  private async checkIfLoginInfoIsLoaded() {
    const check = () => {
      const cookies = this.ctx.ba.getCookies()
      return cookies && cookies.length > 0
    }

    if (!check()) {
      this.ctx.logger.warn('未检测到登录信息，请使用 bili login 进行登录')
    }
  }

  private async loadSubFromConfig(subs: Config['sub']): Promise<Result> {
    try {
      for (const sub of subs) {
        const result = await this.subUserInBili(sub.uid)
        if (result.code !== 0) {
          return result
        }
      }
      return { code: 0, msg: '加载成功' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }

  private async subUserInBili(mid: string): Promise<Result> {
    const checkGroupIsReady = async (): Promise<Result> => {
      // 实现检查逻辑
      return { code: 0, msg: '检查完成' }
    }

    const getGroupDetailData = async (): Promise<Result> => {
      // 实现获取数据逻辑
      return { code: 0, msg: '获取完成' }
    }

    const groupReadyResult = await checkGroupIsReady()
    if (groupReadyResult.code !== 0) {
      return groupReadyResult
    }

    const groupDetailResult = await getGroupDetailData()
    if (groupDetailResult.code !== 0) {
      return groupDetailResult
    }

    return { code: 0, msg: '订阅成功' }
  }

  private subShow(): string {
    // 实现订阅展示逻辑
    return '订阅列表'
  }

  protected dispose() {
    if (this.loginTimer) {
      this.loginTimer()
    }
    if (this.dynamicJob) {
      this.dynamicJob.stop()
    }
  }
} 