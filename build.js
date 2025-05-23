const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 清理输出目录
function clean() {
  console.log('🧹 清理输出目录...');
  if (fs.existsSync('lib')) {
    fs.rmSync('lib', { recursive: true, force: true });
  }
  
  // 清理 TypeScript 增量编译缓存
  if (fs.existsSync('tsconfig.tsbuildinfo')) {
    fs.unlinkSync('tsconfig.tsbuildinfo');
    console.log('🗑️  清理 TypeScript 缓存文件...');
  }
}

// 编译 TypeScript
function compileTypeScript() {
  console.log('🔨 编译 TypeScript...');
  
  // 编译前再次确保清理缓存文件
  if (fs.existsSync('tsconfig.tsbuildinfo')) {
    fs.unlinkSync('tsconfig.tsbuildinfo');
  }
  
  execSync('npx tsc', { stdio: 'inherit' });
}

// 复制静态资源
function copyAssets() {
  console.log('📁 复制静态资源...');
  
  const assetDirs = ['font', 'img', 'page'];
  
  assetDirs.forEach(dir => {
    const srcPath = path.join('src', dir);
    const destPath = path.join('lib', dir);
    
    if (fs.existsSync(srcPath)) {
      console.log(`  复制 ${srcPath} -> ${destPath}`);
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      console.log(`  ⚠️  ${srcPath} 不存在，跳过`);
    }
  });
}

// 主构建函数
function build() {
  try {
    clean();
    compileTypeScript();
    copyAssets();
    console.log('✅ 构建完成！');
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  build();
}

module.exports = { build, clean, compileTypeScript, copyAssets }; 