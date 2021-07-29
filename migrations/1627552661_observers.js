const Observers = artifacts.require('Observers');

module.exports = function(_deployer) {
  // Use deployer to state migration tasks.
  Observers.deploy();
};
