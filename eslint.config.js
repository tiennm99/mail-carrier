import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        GmailApp: 'readonly',
        PropertiesService: 'readonly',
        UrlFetchApp: 'readonly',
      },
    },
    rules: { 'jsdoc/no-undefined-types': 'off' },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
    },
  },
];
