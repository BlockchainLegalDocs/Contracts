const Observers = artifacts.require('Observers');
const { assert } = require('chai');

const { toBN } = web3.utils;

const ONE_ETHER = web3.utils.toWei(toBN(1));
const VOTER_DAY_THRESHOLD = 90;

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
        value: ONE_ETHER,
      });
      try {
        await contractInstance.signup({
          from: accounts[1],
          value: ONE_ETHER,
        });
      } catch (e) {
        return assert.isTrue(true);
      }
      return assert.fail('No error is thrown!');
    });

    it('should sign up and set amount beside existence', async () => {
      const VALUE = ONE_ETHER;
      await contractInstance.signup({
        from: accounts[1],
        value: VALUE,
      });

      const observer = await contractInstance.observersList(accounts[1]);

      assert.equal(observer.amount, VALUE.toString());
      assert.isTrue(observer.exists);
    });
  });

  describe('verify', () => {
    it('should throw error if caller is not owner', async () => {
      await contractInstance.signup({
        from: accounts[2],
        value: ONE_ETHER,
      });
      return assert.isRejected(contractInstance.verify(accounts[2], {
        from: accounts[1],
      }));
    });
    it('should not throw error if caller is not owner', async () => {
      await contractInstance.signup({
        from: accounts[1],
        value: ONE_ETHER,
      });
      return assert.isFulfilled(contractInstance.verify(accounts[1], {
        from: ownerAccountAddress,
      }));
    });
    it('should throw error if target observer hasn\'t signed up', async () => assert.isRejected(contractInstance.verify(accounts[1], {
      from: ownerAccountAddress,
    })));
    it('should verify observer', async () => {
      const VALUE = ONE_ETHER;
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
    it('should reject if caller is not the document contract', async () => {
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

    it('should reject if observer hasn\'t been verified', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];
      const TARGET_OBSERVER = accounts[2];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      await contractInstance.signup({
        from: TARGET_OBSERVER,
        value: ONE_ETHER,
      });
      return assert.isRejected(contractInstance.changeLastVote(TARGET_OBSERVER, {
        from: DOC_CONTRACT_ADDRESS,
      }));
    });

    it('should change lastVote of the observer', async () => {
      const DOC_CONTRACT_ADDRESS = accounts[1];
      const TARGET_OBSERVER = accounts[2];

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      await contractInstance.signup({
        from: TARGET_OBSERVER,
        value: ONE_ETHER,
      });
      await contractInstance.verify(TARGET_OBSERVER, {
        from: ownerAccountAddress,
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
    it('should reject if caller is not the document contract', async () => {
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

      const INITIAL_VALUE = ONE_ETHER.mul(toBN('2'));
      const PLUS_VALUE = ONE_ETHER;

      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS);
      await contractInstance.signup({
        from: TARGET_OBSERVER,
        value: INITIAL_VALUE,
      });

      await contractInstance.increaseObserverAmount(PLUS_VALUE, TARGET_OBSERVER, {
        from: DOC_CONTRACT_ADDRESS,
      });

      const observerItem = await contractInstance.observersList(TARGET_OBSERVER);

      assert.equal(observerItem.amount, PLUS_VALUE.add(INITIAL_VALUE).toString());
    });
  });

  describe('settle', () => {
    it('should throw error if caller hasn\'t signed up', async () => assert.isRejected(contractInstance.settle({
      from: accounts[1],
    })));

    it('should throw error if not enough time passed from lastVote', async () => {
      const VOTER = accounts[1];
      const CONTRACT_ADDRESS = accounts[2];

      await contractInstance.signup({
        from: VOTER,
        value: ONE_ETHER,
      });
      await contractInstance.verify(VOTER, {
        from: ownerAccountAddress,
      });

      await contractInstance.setDocumentContractAddress(CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });

      const NOW = Math.floor(Date.now() / 1000);

      await contractInstance.changeLastVote(NOW, VOTER, {
        from: CONTRACT_ADDRESS,
      });

      return assert.isRejected(contractInstance.settle({
        from: VOTER,
      }));
    });

    it('should throw error if has already settled', async () => {
      const VOTER = accounts[1];
      const CONTRACT_ADDRESS = accounts[2];

      await contractInstance.signup({
        from: VOTER,
        value: ONE_ETHER,
      });
      await contractInstance.verify(VOTER, {
        from: ownerAccountAddress,
      });

      await contractInstance.setDocumentContractAddress(CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });

      const date = new Date();
      date.setDate(date.getDate() - VOTER_DAY_THRESHOLD - 10);
      const beforeThresholdDate = Math.floor(date.getTime() / 1000);

      await contractInstance.changeLastVote(beforeThresholdDate, VOTER, {
        from: CONTRACT_ADDRESS,
      });

      await contractInstance.settle({
        from: VOTER,
      });

      return assert.isRejected(contractInstance.settle({
        from: VOTER,
      }));
    });

    it('should transfer amount to the caller on success', async () => {
      const VOTER = accounts[1];
      const CONTRACT_ADDRESS = accounts[2];
      const VALUE = ONE_ETHER;

      await contractInstance.signup({
        from: VOTER,
        value: VALUE,
      });
      await contractInstance.verify(VOTER, {
        from: ownerAccountAddress,
      });

      await contractInstance.setDocumentContractAddress(CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });

      const date = new Date();
      date.setDate(date.getDate() - VOTER_DAY_THRESHOLD - 10);
      const beforeThresholdDate = Math.floor(date.getTime() / 1000);

      await contractInstance.changeLastVote(beforeThresholdDate, VOTER, {
        from: CONTRACT_ADDRESS,
      });

      const preSettleBalance = toBN(await web3.eth.getBalance(VOTER));

      const settlementInfo = await contractInstance.settle({
        from: VOTER,
      });
      const tx = await web3.eth.getTransaction(settlementInfo.tx);
      const gasPrice = toBN(tx.gasPrice);
      const gasUsed = toBN(settlementInfo.receipt.gasUsed);
      const gas = gasPrice.mul(gasUsed);

      assert.equal(
        await web3.eth.getBalance(VOTER),
        preSettleBalance.add(toBN(VALUE)).sub(gas).toString(),
      );
    });

    it('should set status of the caller to hasSettled on success', async () => {
      const VOTER = accounts[1];
      const CONTRACT_ADDRESS = accounts[2];
      const VALUE = ONE_ETHER;

      await contractInstance.signup({
        from: VOTER,
        value: VALUE,
      });
      await contractInstance.verify(VOTER, {
        from: ownerAccountAddress,
      });

      await contractInstance.setDocumentContractAddress(CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });

      const date = new Date();
      date.setDate(date.getDate() - VOTER_DAY_THRESHOLD - 10);
      const beforeThresholdDate = Math.floor(date.getTime() / 1000);

      await contractInstance.changeLastVote(beforeThresholdDate, VOTER, {
        from: CONTRACT_ADDRESS,
      });

      await contractInstance.settle({
        from: VOTER,
      });

      const observer = await contractInstance.observersList(VOTER);

      assert.isTrue(observer.hasSettled);
    });

    it('should remove caller address from observers on success', async () => {
      const VOTER = accounts[1];
      const CONTRACT_ADDRESS = accounts[2];
      const VALUE = ONE_ETHER;

      await contractInstance.signup({
        from: VOTER,
        value: VALUE,
      });
      await contractInstance.verify(VOTER, {
        from: ownerAccountAddress,
      });

      await contractInstance.setDocumentContractAddress(CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });

      const date = new Date();
      date.setDate(date.getDate() - VOTER_DAY_THRESHOLD - 10);
      const beforeThresholdDate = Math.floor(date.getTime() / 1000);

      await contractInstance.changeLastVote(beforeThresholdDate, VOTER, {
        from: CONTRACT_ADDRESS,
      });

      await contractInstance.settle({
        from: VOTER,
      });

      const observersAddrList = await contractInstance.getObserversAddrList();

      assert.isFalse(observersAddrList.includes(VOTER));
    });
  });

  describe('fireObserver', () => {
    it('should throw error if caller is not the owner', async () => assert.isRejected(contractInstance.fireObserver({
      from: accounts[1],
    })));

    it('should throw error if caller hasn\'t signed up', async () => assert.isRejected(contractInstance.fireObserver(accounts[1], {
      from: ownerAccountAddress,
    })));

    it('should throw error if the caller has not been verified', async () => {
      const TARGET = accounts[1];

      await contractInstance.signup({
        from: TARGET,
        value: ONE_ETHER,
      });
      return assert.isRejected(contractInstance.fireObserver(TARGET, {
        from: ownerAccountAddress,
      }));
    });

    it('should set isFired of the caller to true', async () => {
      const TARGET = accounts[1];
      const DOC_CONTRACT_ADDRESS = accounts[2];

      await contractInstance.signup({
        from: TARGET,
        value: ONE_ETHER,
      });
      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });
      await contractInstance.verify(TARGET, {
        from: ownerAccountAddress,
      });
      await contractInstance.fireObserver(TARGET, {
        from: ownerAccountAddress,
      });

      const observer = await contractInstance.observersList(TARGET);

      assert.isTrue(observer.isFired);
    });

    it('should set the amount to zero', async () => {
      const TARGET = accounts[1];

      await contractInstance.signup({
        from: TARGET,
        value: ONE_ETHER,
      });
      await contractInstance.verify(TARGET, {
        from: ownerAccountAddress,
      });
      await contractInstance.fireObserver(TARGET, {
        from: ownerAccountAddress,
      });

      const observer = await contractInstance.observersList(TARGET);

      assert.equal(observer.amount, 0);
    });

    it('should remove the caller from observer address list', async () => {
      const TARGET = accounts[1];
      const DOC_CONTRACT_ADDRESS = accounts[2];

      await contractInstance.signup({
        from: TARGET,
        value: ONE_ETHER,
      });
      await contractInstance.setDocumentContractAddress(DOC_CONTRACT_ADDRESS, {
        from: ownerAccountAddress,
      });
      await contractInstance.verify(TARGET, {
        from: ownerAccountAddress,
      });
      await contractInstance.fireObserver(TARGET, {
        from: ownerAccountAddress,
      });

      const observersAddrList = await contractInstance.getObserversAddrList();

      assert.isFalse(observersAddrList.includes(TARGET));
    });
  });
});
