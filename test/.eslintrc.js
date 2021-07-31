module.exports = {
  globals: {
    assert: true,
    contract: true,
    web3: true,
  },
  extends: [
    'plugin:mocha/recommended',
  ],
  plugins: ['mocha'],
  rules: {
    'mocha/no-mocha-arrows': 'off',
  },
};
