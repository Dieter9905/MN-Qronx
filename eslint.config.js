import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import unusedImports from 'eslint-plugin-unused-imports'
import react from 'eslint-plugin-react'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'

export default [
  { ignores: ['dist', 'backend', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { 'jsx-a11y': {} },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
      'jsx-a11y': jsxA11y,
      react: react,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      // Các rule mới rất gắt của plugin v7 (compiler-style) gắn cờ 550+ chỗ
      // setState trong effect là mô hình load-dữ-liệu có chủ ý của app; tắt
      // từng nhóm này, giữ lại hai luật nền có thật (rules-of-hooks + deps).
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/component-start-effect': 'off',
      'react-refresh/only-export-components': 'off',
      // ESLint core (nhánh 9.39) không đánh dấu sử dụng biến khi biến chỉ được
      // dùng trong JSX element/attribute name — rule này khôi phục: <Modal/>,
      // <Avatar/>, <Icon/> được coi là tham chiếu thật.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      // Xoá import/let eslint phát hiện không được dùng (tự --fix được)
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', { args: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]
