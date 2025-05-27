import { Context, Service } from 'koishi';
import { LiveType, LiveUsers } from '../../core/types';
import { BLiveClient } from 'blive-message-listener';

export default class BLive extends Service {
  static inject = ['ba'];
  
  private clients: Map<string, BLiveClient> = new Map();

  constructor(ctx: Context) {
    super(ctx, 'bl');
  }

  async startLiveListener(roomId: string, callback: (type: LiveType, data: any) => void) {
    if (this.clients.has(roomId)) {
      return;
    }

    const client = new BLiveClient(roomId);
    this.clients.set(roomId, client);

    client.on('LIVE', (data) => {
      callback('start', data);
    });

    client.on('PREPARING', (data) => {
      callback('end', data);
    });

    client.on('GUARD_BUY', (data) => {
      callback('guard', data);
    });

    await client.start();
  }

  async stopLiveListener(roomId: string) {
    const client = this.clients.get(roomId);
    if (client) {
      await client.stop();
      this.clients.delete(roomId);
    }
  }

  async getLiveUsers(roomId: string): Promise<LiveUsers[]> {
    try {
      const response = await fetch(`https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${roomId}`, {
        headers: {
          'User-Agent': this.ctx.ba.getUserAgent(),
          'Cookie': this.ctx.ba.getCookies().join('; '),
        },
      });
      const data = await response.json();
      if (data.code === 0) {
        return data.data.anchor_info;
      }
      return [];
    } catch (e) {
      this.logger.error('获取直播间用户信息失败', e);
      return [];
    }
  }

  protected dispose() {
    for (const [roomId, client] of this.clients) {
      client.stop();
    }
    this.clients.clear();
  }
} 
