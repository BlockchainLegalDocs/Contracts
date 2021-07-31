const Observers = artifacts.require('Observers');
const { assert } = require('chai');

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
    it('should throw error if callee is not owner', async () => {
      await contractInstance.signup({
        from: accounts[2],
        value: 2,
      });
      return assert.isRejected(contractInstance.verify(accounts[2], {
        from: accounts[1],
      }));
    });
    it('should not throw error if callee is not owner', async () => {
      await contractInstance.signup({
        from: accounts[1],
        value: 2,
      });
      return assert.isFulfilled(contractInstance.verify(accounts[1], {
        from: ownerAccountAddress,
      }));
    });
    it('should throw error if target observer hasn\'t signed up', async () => assert.isRejected(contractInstance.verify(accounts[1], {
      from: ownerAccountAddress,
    })));
    it('should verify observer', async () => {
      const VALUE = 2;
      const ACCOUNT = accounts[1];

      await contractInstance.signup({
        from: ACCOUNT,
        value: VALUE,
      });
      await contractInstance.verify(ACCOUNT, {
        from: ownerAccountAddress,
      });

      const observerItem = await contractInstance.observersList(ACCOUNT);
      const observersAddrList = await contractInstance.getObserversAddrList();

      assert.isTrue(observerItem.hasVerified);
      assert.isTrue(observersAddrList.includes(ACCOUNT));
    });
  });

  describe('changeLastVote', () => {
    it('should reject if callee is not the document contract', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      return assert.isRejected(contractInstance.changeLastVote(accounts[3], {
        from: accounts[2],
      }));
    });

    it('should reject if observer hasn\'t signed up', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      return assert.isRejected(contractInstance.changeLastVote(accounts[2], {
        from: DOC_CONTRACT_ADDRESS,
      }));
    });

    it('should change lastVote of the observer', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];
      const TARGET_OBSERVER = accounts[2];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      await contractInstance.signup({
        from: TARGET_OBSERVER,
        value: 2,
      });

      const NOW = Date.now();

      await contractInstance.changeLastVote(NOW, TARGET_OBSERVER, {
        from: DOC_CONTRACT_ADDRESS,
      });

      const observerItem = await contractInstance.observersList(TARGET_OBSERVER);

      assert.equal(observerItem.lastVote, NOW);
    });
  });

  describe('increaseObserverAmount', () => {
    it('should reject if callee is not the document contract', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      return assert.isRejected(contractInstance.increaseObserverAmount(1, accounts[3], {
        from: accounts[2],
      }));
    });

    it('should reject if observer hasn\'t signed up', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      return assert.isRejected(contractInstance.increaseObserverAmount(1, accounts[2], {
        from: DOC_CONTRACT_ADDRESS,
      }));
    });

    it('should increase amount of the observer', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];
      const TARGET_OBSERVER = accounts[2];

      const INITIAL_VALUE = 2;
      const PLUS_VALUE = 1;

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      await contractInstance.signup({
        from: TARGET_OBSERVER,
        value: INITIAL_VALUE,
      });

      await contractInstance.increaseObserverAmount(PLUS_VALUE, TARGET_OBSERVER, {
        from: DOC_CONTRACT_ADDRESS,
      });

      const observerItem = await contractInstance.observersList(TARGET_OBSERVER);

      assert.equal(observerItem.amount, PLUS_VALUE + INITIAL_VALUE);
    });
  });

  describe('settle', () => {
    it('should throw error if callee hasn\'t signed up');

    it('should throw error if not enough time passed from lastVote');

    it('should throw error if has already settled');

    it('should transfer amount to the callee on success');

    it('should set status of the callee to hasSettled on success');

    it('should remove callee address from observers on success');
  });
});
