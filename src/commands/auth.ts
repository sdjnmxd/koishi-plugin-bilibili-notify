import { Context, h } from 'koishi';
import { createLogger } from '../utils/logger';
import { DEFAULT_CONFIG } from '../constants';
import * as QRCode from 'qrcode';

export function registerAuthCommands(ctx: Context, bili: any) {
  const logger = createLogger(ctx, 'COMMAND');

  // 二维码登录
  bili.subcommand('.login', '二维码登录').action(async ({ session }) => {
    try {
      const loginService = ctx.get('loginService');
      if (!loginService) {
        return '登录服务未初始化';
      }

      // 获取二维码
      const result = await loginService.getLoginQRCode();

      // 生成二维码图片
      const qrBuffer = await QRCode.toBuffer(result.url, {
        width: 256,
        margin: 2,
      });

      // 发送二维码图片
      await session.send([
        '请使用哔哩哔哩手机客户端扫描二维码登录：',
        h('img', { src: `data:image/png;base64,${qrBuffer.toString('base64')}` }),
        '二维码有效期3分钟，请及时扫描',
      ]);

      // 开始轮询登录状态
      let pollCount = 0;
      const maxPolls = DEFAULT_CONFIG.LOGIN_POLL_TIMEOUT / 1000; // 转换为秒数
      let hasScanned = false; // 标记是否已扫码

      const pollTimer = setInterval(async () => {
        try {
          pollCount++;

          const checkResult = await loginService.pollQRCodeStatus(result.qrcode_key);

          if (checkResult.success) {
            clearInterval(pollTimer);
            await session.send('✅ 登录成功！');
            return;
          }

          // 检查是否超时
          if (pollCount >= maxPolls) {
            clearInterval(pollTimer);
            await session.send('❌ 二维码已过期，请重新获取');
            return;
          }

          // 根据具体的错误消息判断状态
          if (checkResult.message) {
            if (checkResult.message.includes('请使用哔哩哔哩客户端扫描二维码')) {
              // 86101: 未扫码状态，继续等待
              return;
            } else if (checkResult.message.includes('已扫码，请在手机上确认登录')) {
              // 86090: 已扫码未确认
              if (!hasScanned) {
                hasScanned = true;
                await session.send('📱 检测到扫码，请在手机上确认登录');
              }
              return;
            } else if (checkResult.message.includes('二维码已失效')) {
              // 86038: 二维码过期
              clearInterval(pollTimer);
              await session.send('❌ 二维码已失效，请重新获取');
              return;
            } else {
              // 其他错误
              clearInterval(pollTimer);
              await session.send(`❌ 登录失败: ${checkResult.message}`);
              return;
            }
          }
        } catch (error) {
          clearInterval(pollTimer);
          logger.error('轮询登录状态失败:', error);
          await session.send('❌ 登录检查失败，请重试');
        }
      }, 1000); // 每秒检查一次

      return '正在等待扫码...';
    } catch (error) {
      logger.error('二维码登录失败:', error);
      return '二维码登录失败，请稍后重试';
    }
  });

  // 查看登录状态
  bili.subcommand('.status', '查看登录状态').action(async () => {
    try {
      const loginService = ctx.get('loginService');
      if (!loginService) {
        return '登录服务未初始化';
      }

      const status = await loginService.getLoginStatus();
      if (status.isLoggedIn && status.userInfo) {
        return [
          '当前登录状态：已登录',
          `用户名：${status.userInfo.name}`,
          `UID：${status.userInfo.uid}`,
          `等级：${status.userInfo.level || '未知'}`,
        ].join('\n');
      } else {
        return '当前登录状态：未登录';
      }
    } catch (error) {
      logger.error('查看登录状态失败:', error);
      return '查看登录状态失败';
    }
  });

  // 刷新登录状态
  bili.subcommand('.refresh', '刷新登录状态').action(async () => {
    try {
      const loginService = ctx.get('loginService');
      if (!loginService) {
        return '登录服务未初始化';
      }

      const result = await loginService.refreshCookies();
      return result ? '登录状态刷新成功' : '刷新失败';
    } catch (error) {
      logger.error('刷新登录失败:', error);
      return '刷新登录失败';
    }
  });

  // 退出登录
  bili.subcommand('.logout', '退出登录').action(async () => {
    try {
      const loginService = ctx.get('loginService');
      if (!loginService) {
        return '登录服务未初始化';
      }

      await loginService.logout();
      return '已退出登录';
    } catch (error) {
      logger.error('退出登录失败:', error);
      return '退出登录失败';
    }
  });
}
