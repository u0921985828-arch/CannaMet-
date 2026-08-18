// ESLint 9 usa configuración plana. `.eslintrc.json` ya no se lee.
// `no-floating-promises` necesita tipos: de ahí `projectService`.
const expo = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = [
  ...expo,
  prettierConfig,
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'src/types/database.ts',
      'eslint.config.js',
      // Deno, no React Native: otro runtime y otras globales.
      'supabase/functions/',
    ],
  },
  {
    // Scripts de build: corren en Node, no en el móvil.
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
