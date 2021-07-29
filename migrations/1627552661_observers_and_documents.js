const Observers = artifacts.require('Observers');
const Documents = artifacts.require('Documents');

module.exports = async function(_deployer) {
  await _deployer.deploy(Observers);
  await _deployer.deploy(Documents, Observers.address);

  console.log(Observers.address, 'pouya');

  const observerInstance = await Observers.deployed();
  await observerInstance.setDocumentContractAddress(Documents.address);
};
