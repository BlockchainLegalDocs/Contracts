const Observers = artifacts.require('Observers');
const Documents = artifacts.require('Documents');

module.exports = async function (_deployer) {
  await _deployer.deploy(Observers);
  // Kovan
  const KOVAN_KEYHASH = '0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4';
  const KOVAN_FEE = '100000000000000000';
  const KOVAN_LINK_TOKEN = '0xa36085F69e2889c224210F603D836748e7dC0088';
  const KOVAN_VRF_COORDINATOR = '0xdD3782915140c8f3b190B5D67eAc6dc5760C46E9';
  await _deployer.deploy(
    Documents,
    Observers.address,
    KOVAN_KEYHASH,
    KOVAN_FEE,
    KOVAN_VRF_COORDINATOR,
    KOVAN_LINK_TOKEN,
  );

  const observerInstance = await Observers.deployed();
  await observerInstance.setDocumentContractAddress(Documents.address);
};
