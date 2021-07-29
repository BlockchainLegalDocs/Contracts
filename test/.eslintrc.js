module.exports = {
  globals: {
    assert: true,
    contract: true,
  },
  extends: [
    'plugin:mocha/recommended',
  ],
  plugins: ['mocha'],
  rules: {
    'mocha/no-mocha-arrows': 'off',
  },
};
