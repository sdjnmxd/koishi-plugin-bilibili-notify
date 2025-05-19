import { Context, Service } from 'koishi'
import { createHash } from 'crypto'
import { Result } from '../../core/types'

export interface Config {
  userAgent: string
  key: string
}

export default class BiliAPI extends Service {
  static inject = ['database']
  
  private config: Config
  private cookies: string[] = []
  private refreshToken: string = ''
  private notifier: any

  constructor(ctx: Context, config: Config) {
    super(ctx, 'ba')
    this.config = config
    this.init()
  }

  private async init() {
    await this.loadLoginInfo()
  }

  private async loadLoginInfo() {
    const loginInfo = await this.ctx.database.get('loginBili', { id: 1 })
    if (loginInfo && loginInfo.length > 0) {
      this.cookies = this.decrypt(loginInfo[0].bili_cookies)
      this.refreshToken = this.decrypt(loginInfo[0].bili_refresh_token)
    }
  }

  private encrypt(text: string): string {
    const cipher = createHash('sha256')
    return cipher.update(text).digest('hex')
  }

  private decrypt(text: string): string {
    // 这里应该实现解密逻辑
    return text
  }

  getCookies(): string[] {
    return this.cookies
  }

  async getLoginQRCode(): Promise<Result> {
    try {
      const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
        headers: {
          'User-Agent': this.config.userAgent
        }
      })
      const data = await response.json()
      return {
        code: data.code,
        msg: data.message
      }
    } catch (e) {
      return {
        code: -1,
        msg: e.message
      }
    }
  }

  async getLoginStatus(qrcodeKey: string): Promise<Result> {
    try {
      const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`, {
        headers: {
          'User-Agent': this.config.userAgent
        }
      })
      const data = await response.json()
      return {
        code: data.code,
        msg: data.message
      }
    } catch (e) {
      return {
        code: -1,
        msg: e.message
      }
    }
  }

  async getUserInfo(uid: string): Promise<Result> {
    try {
      const response = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Cookie': this.cookies.join('; ')
        }
      })
      const data = await response.json()
      return {
        code: data.code,
        msg: data.message
      }
    } catch (e) {
      return {
        code: -1,
        msg: e.message
      }
    }
  }

  async getDynamicList(uid: string): Promise<Result> {
    try {
      const response = await fetch(`https://api.bilibili.com/x/dynamic/feed/draw/doc_list?uid=${uid}`, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Cookie': this.cookies.join('; ')
        }
      })
      const data = await response.json()
      return {
        code: data.code,
        msg: data.message
      }
    } catch (e) {
      return {
        code: -1,
        msg: e.message
      }
    }
  }

  async getLiveRoomInfo(roomId: string): Promise<Result> {
    try {
      const response = await fetch(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Cookie': this.cookies.join('; ')
        }
      })
      const data = await response.json()
      return {
        code: data.code,
        msg: data.message
      }
    } catch (e) {
      return {
        code: -1,
        msg: e.message
      }
    }
  }

  disposeNotifier() {
    if (this.notifier) {
      this.notifier.dispose()
    }
  }

  enableRefreshCookiesDetect() {
    // 实现cookie刷新检测逻辑
  }
} 