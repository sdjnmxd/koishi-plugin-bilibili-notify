import { Context } from 'koishi';
import { DynamicDetector } from '../core/dynamic/DynamicDetector';
import { LiveListener } from '../core/live/LiveListener';

export function registerServiceCommands(ctx: Context, bili: any) {
  // 服务状态
  bili.subcommand('.info', '查看服务状态').action(() => {
    const dynamicDetector = ctx.get('dynamicDetector') as DynamicDetector;
    const liveListener = ctx.get('liveListener') as LiveListener;

    if (!dynamicDetector || !liveListener) {
      return '服务未初始化';
    }

    const dynamicStatus = dynamicDetector.status;
    const liveStatus = liveListener.status;

    return `服务状态:
🔄 动态检测: ${dynamicStatus.isRunning ? '运行中' : '已停止'}
📺 直播监听: ${liveStatus.isRunning ? '运行中' : '已停止'} (${liveStatus.roomCount}个房间)`;
  });

  // 启动服务
  bili.subcommand('.start', '启动监听服务').action(async () => {
    return await startServices(ctx);
  });

  // 停止服务
  bili.subcommand('.stop', '停止监听服务').action(async () => {
    return await stopServices(ctx);
  });

  // 重启服务
  bili.subcommand('.restart', '重启监听服务').action(async ({ session }) => {
    // 先发送重启开始消息
    await session.send('🔄 正在重启服务...');

    // 停止服务
    const stopResult = await stopServices(ctx);
    await session.send(stopResult);

    // 等待一秒钟确保服务完全停止
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 重新启动服务
    const startResult = await startServices(ctx);

    return `🔄 重启完成！\n\n${startResult}`;
  });
}

// 启动服务的通用函数
async function startServices(ctx: Context): Promise<string> {
  const dynamicDetector = ctx.get('dynamicDetector') as DynamicDetector;
  const liveListener = ctx.get('liveListener') as LiveListener;

  if (!dynamicDetector || !liveListener) {
    return '服务未初始化';
  }

  const dynamicResult = await dynamicDetector.startDetection();
  const liveResult = await liveListener.startListening();

  const messages = [];
  if (dynamicResult.success) {
    messages.push('✅ 动态检测已启动');
  } else {
    messages.push(`❌ 动态检测启动失败: ${dynamicResult.error}`);
  }

  if (liveResult.success) {
    messages.push('✅ 直播监听已启动');
  } else {
    messages.push(`❌ 直播监听启动失败: ${liveResult.error}`);
  }

  return messages.join('\n');
}

// 停止服务的通用函数
async function stopServices(ctx: Context): Promise<string> {
  const dynamicDetector = ctx.get('dynamicDetector') as DynamicDetector;
  const liveListener = ctx.get('liveListener') as LiveListener;

  if (!dynamicDetector || !liveListener) {
    return '服务未初始化';
  }

  const dynamicResult = await dynamicDetector.stopDetection();
  const liveResult = await liveListener.stopListening();

  const messages = [];
  if (dynamicResult.success) {
    messages.push('✅ 动态检测已停止');
  } else {
    messages.push(`❌ 动态检测停止失败: ${dynamicResult.error}`);
  }

  if (liveResult.success) {
    messages.push('✅ 直播监听已停止');
  } else {
    messages.push(`❌ 直播监听停止失败: ${liveResult.error}`);
  }

  return messages.join('\n');
}
