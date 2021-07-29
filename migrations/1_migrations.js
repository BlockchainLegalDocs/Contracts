const Migrations = artifacts.require('Migrations');

module.exports = function(_deployer) {
  // Use deployer to state migration tasks.
  _deployer.deploy(Migrations);
};
