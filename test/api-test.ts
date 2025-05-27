import { Context } from 'koishi';
import { BilibiliApiService } from '../src/services/bilibili/BilibiliApiService';
import { createLogger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// 模拟Koishi上下文
function createTestContext(): Context {
  const mockHttp = {
    get: async (url: string, options?: any) => {
      console.log(`\n🌐 [HTTP GET] ${url}`);
      console.log('📋 [Request Headers]:');
      console.log(JSON.stringify(options?.headers || {}, null, 2));

      // 这里需要实际的HTTP请求，你可以使用axios或其他HTTP库
      const axios = require('axios');
      try {
        const startTime = Date.now();
        const response = await axios.get(url, {
          ...options,
          timeout: 10000, // 10秒超时
          validateStatus: () => true, // 接受所有状态码
        });
        const endTime = Date.now();

        console.log(`⏱️  [Response Time] ${endTime - startTime}ms`);
        console.log(`📊 [Response Status] ${response.status} ${response.statusText}`);
        console.log('📋 [Response Headers]:');
        console.log(JSON.stringify(response.headers, null, 2));
        console.log('📄 [Response Data]:');
        console.log(JSON.stringify(response.data, null, 2));

        return response.data;
      } catch (error) {
        console.error(`❌ [HTTP Error] ${error.message}`);
        if (error.response) {
          console.error(`📊 [Error Status] ${error.response.status}`);
          console.error(`📄 [Error Data] ${JSON.stringify(error.response.data, null, 2)}`);
        }
        throw error;
      }
    },
    post: async (url: string, data?: any, options?: any) => {
      console.log(`\n🌐 [HTTP POST] ${url}`);
      console.log('📋 [Request Data]:');
      console.log(JSON.stringify(data, null, 2));
      console.log('📋 [Request Headers]:');
      console.log(JSON.stringify(options?.headers || {}, null, 2));

      const axios = require('axios');
      try {
        const startTime = Date.now();
        const response = await axios.post(url, data, {
          ...options,
          timeout: 10000,
          validateStatus: () => true,
        });
        const endTime = Date.now();

        console.log(`⏱️  [Response Time] ${endTime - startTime}ms`);
        console.log(`📊 [Response Status] ${response.status} ${response.statusText}`);
        console.log('📋 [Response Headers]:');
        console.log(JSON.stringify(response.headers, null, 2));
        console.log('📄 [Response Data]:');
        console.log(JSON.stringify(response.data, null, 2));

        return response.data;
      } catch (error) {
        console.error(`❌ [HTTP Error] ${error.message}`);
        if (error.response) {
          console.error(`📊 [Error Status] ${error.response.status}`);
          console.error(`📄 [Error Data] ${JSON.stringify(error.response.data, null, 2)}`);
        }
        throw error;
      }
    },
  };

  const mockScope = {
    isActive: true,
  };

  const mockConfig = {
    customUserAgents: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0`,
  };

  return {
    http: mockHttp,
    scope: mockScope,
    config: mockConfig,
    logger: (name: string) => ({
      info: (...args: any[]) => console.log(`[${name}]`, ...args),
      warn: (...args: any[]) => console.warn(`[${name}]`, ...args),
      error: (...args: any[]) => console.error(`[${name}]`, ...args),
      debug: (...args: any[]) => console.debug(`[${name}]`, ...args),
      success: (...args: any[]) => console.log(`[${name}] ✅`, ...args),
    }),
  } as any;
}

// 加载登录态配置
function loadLoginConfig() {
  // 修复路径，确保指向项目根目录的test-login.json
  const configPath = path.resolve(process.cwd(), 'test-login.json');

  if (!fs.existsSync(configPath)) {
    console.error('❌ 找不到 test-login.json 文件，请先创建并填入登录信息');
    console.error(`📁 查找路径: ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  if (config.bili_cookies === '请将数据库中的bili_cookies字段内容粘贴到这里') {
    console.error('❌ 请先在 test-login.json 中填入真实的登录信息');
    process.exit(1);
  }

  return config;
}

// 分析cookies内容
function analyzeCookies(cookies: string) {
  console.log('🔍 分析Cookies内容:');
  const cookiePairs = cookies.split(';').map(c => c.trim());
  const cookieMap: Record<string, string> = {};

  cookiePairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      cookieMap[key.trim()] = value.trim();
    }
  });

  const requiredCookies = ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5'];

  requiredCookies.forEach(key => {
    if (cookieMap[key]) {
      console.log(`  ✅ ${key}: ${cookieMap[key].substring(0, 20)}...`);
    } else {
      console.log(`  ❌ ${key}: 缺失`);
    }
  });

  console.log(`  📊 总共 ${Object.keys(cookieMap).length} 个cookie字段`);
  console.log(`  📋 所有字段: ${Object.keys(cookieMap).join(', ')}`);
}

// 主测试函数
async function runApiTests() {
  console.log('🚀 开始B站API测试...\n');
  console.log('='.repeat(80));

  // 创建测试上下文
  const ctx = createTestContext();
  const apiService = new BilibiliApiService(ctx);

  // 加载登录配置
  const loginConfig = loadLoginConfig();
  console.log('✅ 登录配置加载成功');
  console.log(`📝 Cookies长度: ${loginConfig.bili_cookies.length}`);
  console.log(`📝 RefreshToken长度: ${loginConfig.bili_refresh_token.length}`);

  // 分析cookies
  analyzeCookies(loginConfig.bili_cookies);
  console.log('');

  // 设置cookies
  apiService.setCookies(loginConfig.bili_cookies);
  console.log('✅ Cookies已设置到API服务');

  // 显示User-Agent信息
  const uaInfo = apiService.getCurrentUserAgentInfo();
  console.log(`🌐 当前User-Agent (${uaInfo.index}/${uaInfo.total}):`);
  console.log(`   ${uaInfo.current}`);
  console.log('');

  console.log('='.repeat(80));

  // 测试1: 检查登录状态
  console.log('🔍 测试1: 检查登录状态');
  console.log('-'.repeat(40));
  try {
    const loginStatus = await apiService.getLoginStatus();
    console.log(`\n📊 [API结果] success: ${loginStatus.success}`);
    if (loginStatus.success) {
      console.log('✅ 登录状态检查成功');
      console.log(`📝 登录状态: ${loginStatus.data?.isLogin ? '已登录' : '未登录'}`);
      if (loginStatus.data?.isLogin) {
        console.log(`📝 用户信息: ${loginStatus.data.uname} (UID: ${loginStatus.data.uid})`);
        console.log(`📝 用户等级: ${loginStatus.data.level}`);
        console.log(`📝 头像: ${loginStatus.data.face}`);
      }
    } else {
      console.log('❌ 登录状态检查失败:', loginStatus.error);
    }
  } catch (error) {
    console.error('❌ 登录状态检查异常:', error.message);
    console.error('📄 错误堆栈:', error.stack);
  }
  console.log('\n' + '='.repeat(80));

  // 测试2: 获取用户信息 (使用你提到的UID 134880)
  console.log('🔍 测试2: 获取用户信息 (UID: 134880)');
  console.log('-'.repeat(40));
  try {
    const userInfo = await apiService.getUserInfo('134880');
    console.log(`\n📊 [API结果] success: ${userInfo.success}`);
    if (userInfo.success) {
      console.log('✅ 用户信息获取成功');
      console.log(`📝 用户名: ${userInfo.data?.name}`);
      console.log(`📝 粉丝数: ${userInfo.data?.follower}`);
      console.log(`📝 关注数: ${userInfo.data?.following}`);
      console.log(`📝 头像: ${userInfo.data?.face}`);
      console.log(`📝 签名: ${userInfo.data?.sign}`);
    } else {
      console.log('❌ 用户信息获取失败:', userInfo.error);
    }
  } catch (error) {
    console.error('❌ 用户信息获取异常:', error.message);
    console.error('📄 错误堆栈:', error.stack);
  }
  console.log('\n' + '='.repeat(80));

  // 测试3: 获取直播间信息
  console.log('🔍 测试3: 获取直播间信息');
  console.log('-'.repeat(40));
  try {
    const roomIdResult = await apiService.getRoomIdByUid('134880');
    console.log(`\n📊 [获取直播间ID] success: ${roomIdResult.success}`);
    if (roomIdResult.success && roomIdResult.data) {
      console.log(`✅ 直播间ID获取成功: ${roomIdResult.data}`);

      // 获取直播间详细信息
      const liveInfo = await apiService.getLiveRoomInfo(roomIdResult.data);
      console.log(`📊 [获取直播间信息] success: ${liveInfo.success}`);
      if (liveInfo.success) {
        console.log('✅ 直播间信息获取成功');
        console.log(`📝 直播状态: ${liveInfo.data?.live_status === 1 ? '直播中' : '未开播'}`);
        console.log(`📝 直播标题: ${liveInfo.data?.title}`);
        console.log(`📝 在线人数: ${liveInfo.data?.online}`);
        console.log(`📝 封面: ${liveInfo.data?.cover}`);
      } else {
        console.log('❌ 直播间信息获取失败:', liveInfo.error);
      }
    } else {
      console.log('❌ 直播间ID获取失败:', roomIdResult.error);
    }
  } catch (error) {
    console.error('❌ 直播间信息获取异常:', error.message);
    console.error('📄 错误堆栈:', error.stack);
  }
  console.log('\n' + '='.repeat(80));
  //
  // // 测试4: 获取用户动态
  // console.log('🔍 测试4: 获取用户动态');
  // console.log('-' .repeat(40));
  // try {
  //   const dynamics = await apiService.getUserDynamics('134880');
  //   console.log(`\n📊 [API结果] success: ${dynamics.success}`);
  //   if (dynamics.success) {
  //     console.log('✅ 用户动态获取成功');
  //     console.log(`📝 动态数量: ${dynamics.data?.length || 0}`);
  //     if (dynamics.data && dynamics.data.length > 0) {
  //       console.log(`📝 最新动态ID: ${dynamics.data[0].id_str}`);
  //       console.log(`📝 最新动态类型: ${dynamics.data[0].type}`);
  //       console.log(`📝 动态时间: ${new Date(dynamics.data[0].timestamp * 1000).toLocaleString()}`);
  //     }
  //   } else {
  //     console.log('❌ 用户动态获取失败:', dynamics.error);
  //   }
  // } catch (error) {
  //   console.error('❌ 用户动态获取异常:', error.message);
  //   console.error('📄 错误堆栈:', error.stack);
  // }
  // console.log('\n' + '=' .repeat(80));
  //
  // // 测试5: 搜索用户
  // console.log('🔍 测试5: 搜索用户 (关键词: "老番茄")');
  // console.log('-' .repeat(40));
  // try {
  //   const searchResult = await apiService.searchUser('老番茄');
  //   console.log(`\n📊 [API结果] success: ${searchResult.success}`);
  //   if (searchResult.success) {
  //     console.log('✅ 用户搜索成功');
  //     console.log(`📝 搜索结果数量: ${searchResult.data?.length || 0}`);
  //     if (searchResult.data && searchResult.data.length > 0) {
  //       console.log(`📝 第一个结果: ${searchResult.data[0].name} (UID: ${searchResult.data[0].uid})`);
  //       console.log(`📝 粉丝数: ${searchResult.data[0].follower}`);
  //     }
  //   } else {
  //     console.log('❌ 用户搜索失败:', searchResult.error);
  //   }
  // } catch (error) {
  //   console.error('❌ 用户搜索异常:', error.message);
  //   console.error('📄 错误堆栈:', error.stack);
  // }
  console.log('\n' + '='.repeat(80));

  // 测试获取用户信息
  console.log('\n🔍 测试获取用户信息...');
  const userInfoResult = await apiService.getUserInfo('3546897566403155');

  // 添加详细的 API 响应日志
  if (userInfoResult.success && userInfoResult.data) {
    console.log('📊 [API结果] success:', userInfoResult.success);
    console.log('✅ 用户信息获取成功');
    console.log('📝 用户名:', userInfoResult.data.name);
    console.log('📝 粉丝数:', userInfoResult.data.follower);
    console.log('📝 关注数:', userInfoResult.data.following);
    console.log('📝 头像:', userInfoResult.data.face);
    console.log('📝 签名:', userInfoResult.data.sign);

    // 添加完整的响应数据日志
    console.log('\n🔍 完整用户信息数据:');
    console.log(JSON.stringify(userInfoResult.data, null, 2));
  } else {
    console.log('❌ 用户信息获取失败:', userInfoResult.error);
  }

  console.log('\n' + '='.repeat(80));

  console.log('🎉 API测试完成！');
  console.log('='.repeat(80));
}

// 运行测试
if (require.main === module) {
  runApiTests().catch(error => {
    console.error('💥 测试运行失败:', error);
    console.error('📄 错误堆栈:', error.stack);
    process.exit(1);
  });
}

export { runApiTests };
