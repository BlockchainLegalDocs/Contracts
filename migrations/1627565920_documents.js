const Documents = artifacts.require('Documents');

module.exports = function(_deployer) {
  // Use deployer to state migration tasks.
  Documents.deploy();
};
