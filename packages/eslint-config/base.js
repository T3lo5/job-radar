export default [
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', '*.config.js', '*.config.ts', '.turbo/**'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
];
