const Observers = artifacts.require('Observers');
const Documents = artifacts.require('Documents');

module.exports = async function (_deployer) {
  await _deployer.deploy(Observers);
  // Kovan
  await _deployer.deploy(
    Documents,
    Observers.address,
  );

  const observerInstance = await Observers.deployed();
  await observerInstance.setDocumentContractAddress(Documents.address);
};
