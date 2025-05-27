const { execSync } = require('child_process');
const path = require('path');

console.log('🔧 编译TypeScript测试文件...');
try {
  // 编译测试文件
  execSync(
    'npx tsc test/api-test.ts --outDir test-build --moduleResolution node --target es2020 --module commonjs --esModuleInterop true --allowSyntheticDefaultImports true --skipLibCheck true',
    { stdio: 'inherit' },
  );

  console.log('✅ 编译完成，开始运行测试...\n');

  // 运行测试
  execSync('node test-build/test/api-test.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ 测试运行失败:', error.message);
  process.exit(1);
}
