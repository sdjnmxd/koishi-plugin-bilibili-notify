module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // 基本规则
    'no-console': 'off',
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
    'no-unused-vars': 'off', // 关闭基础规则
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-duplicate-imports': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'eol-last': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.spec.ts'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    {
      files: ['*.config.js', '*.config.ts', '.eslintrc.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'lib/',
    'coverage/',
    '*.min.js',
    '*.old',
    '*.bak',
  ],
};
