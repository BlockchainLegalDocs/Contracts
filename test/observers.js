const Observers = artifacts.require('Observers');
const { assert } = require('chai');

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */

contract('Observers', (accounts) => {
  const ownerAccountAddress = accounts[0];

  let contractInstance;
  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(() => Observers.new()
    .then((instance) => {
      contractInstance = instance;
    }));

  it('should deploy contract successfully', async () => {
    assert.isOk(contractInstance);
  });

  describe('owner', () => {
    it('should have set owner successfully', async () => {
      const owner = await contractInstance.owner();
      return assert.equal(owner, ownerAccountAddress);
    });
  });

  describe('setDocumentContractAddress', () => {
    it('should set document contract address successfully', async () => {
      await contractInstance.setDocumentContractAddress(accounts[1]);

      const newContractAddress = await contractInstance.documentContractAddr();
      return assert.equal(newContractAddress, accounts[1]);
    });
  });

  describe('signup', () => {
    it('should throw error if no ether is sent', async () => {
      try {
        await contractInstance.signup({
          from: accounts[1],
          value: 0,
        });
      } catch (e) {
        return assert.isTrue(true);
      }
      return assert.fail('No error is thrown!');
    });

    it('should throw error if sender already signed up', async () => {
      await contractInstance.signup({
        from: accounts[1],
        value: 1,
      });
      try {
        await contractInstance.signup({
          from: accounts[1],
          value: 1,
        });
      } catch (e) {
        return assert.isTrue(true);
      }
      return assert.fail('No error is thrown!');
    });

    it('should sign up and set amount beside existence', async () => {
      const VALUE = 10;
      await contractInstance.signup({
        from: accounts[1],
        value: VALUE,
      });

      const observer = await contractInstance.observersList(accounts[1]);

      assert.equal(observer.amount, VALUE);
      assert.isTrue(observer.exists);
    });
  });

  describe('verify', () => {
    it('should throw error if callee is not owner', async () => assert.isFulfilled(contractInstance.verify({
      from: accounts[0],
    })));
  });
});
