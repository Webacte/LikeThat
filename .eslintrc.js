module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  globals: {
    chrome: 'readonly'
  },
  rules: {
    // Règles de style
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    
    // Règles de qualité
    'no-unused-vars': 'warn',
    'no-console': 'off', // Autorisé pour le débogage
    'no-debugger': 'warn',
    'no-alert': 'warn',
    
    // Règles de sécurité
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // Règles de performance
    'no-loop-func': 'error',
    'no-inner-declarations': 'error'
  }
};


