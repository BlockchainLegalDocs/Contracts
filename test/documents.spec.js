/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
const { assert } = require('chai');
const sha256 = require('sha256');

const Documents = artifacts.require('Documents');
const Observers = artifacts.require('Observers');

const { toBN } = web3.utils;

const ONE_ETHER = web3.utils.toWei(toBN(1));
const VOTERS_COUNT = 5;
const VOTERS_FEE_PERCENT = toBN('1');
const VOTERS_MAX_CASH_FEE_PERCENT = toBN('20');

function getDate(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return Math.floor(date.getTime() / 1000);
}

async function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

async function getGas(transInfo) {
  const tx = await web3.eth.getTransaction(transInfo.tx);
  const gasPrice = toBN(tx.gasPrice);
  const gasUsed = toBN(transInfo.receipt.gasUsed);
  return gasPrice.mul(gasUsed);
}

async function createSignedDoc({
  contractInstance,
  link,
  hash,
  employeeValue,
  employerValue,
  endTime,
  employer,
  employee,
}) {
  const LINK = link;
  const HASH = hash;
  const EMPLOYEE_VALUE = employeeValue;
  const EMPLOYER_VALUE = employerValue;
  const END_TIME = endTime;
  const EMPLOYER = employer;
  const EMPLOYEE = employee;

  await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
    value: EMPLOYER_VALUE,
    from: EMPLOYER,
  });

  await contractInstance.employeeSign(LINK, {
    from: EMPLOYEE,
    value: EMPLOYEE_VALUE,
  });
}

async function fillObservers({
  observerInstance,
  ownerAccountAddress,
  accounts,
  value = ONE_ETHER,
}) {
  const observers = [];

  for (let i = 10; i < 20; i += 1) {
    const currentAccount = accounts[i];
    await observerInstance.signup({
      from: currentAccount,
      value,
    });
    await observerInstance.verify(currentAccount, {
      from: ownerAccountAddress,
    });

    observers.push(currentAccount);
  }

  return observers;
}

contract('Documents', (accounts) => {
  const ownerAccountAddress = accounts[0];

  let contractInstance;
  let observerInstance;
  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(async () => {
    observerInstance = await Observers.new();
    contractInstance = await Documents.new(observerInstance.address);
    await observerInstance.setDocumentContractAddress(contractInstance.address, {
      from: ownerAccountAddress,
    });

    // To avoid down time!!!
    await sleep(500);
  });

  it('should deploy contract successfully', () => {
    assert.isOk(contractInstance);
  });

  describe('owner', () => {
    it('should have set owner successfully', async () => {
      const owner = await contractInstance.owner();
      return assert.equal(owner, ownerAccountAddress);
    });
  });

  describe('add', () => {
    it('should throw error if docLink already exists', async () => {
      const LINK = 'https://google.com';
      await contractInstance.add(LINK, `0x${sha256('hey')}`, ONE_ETHER, Date.now(), {
        value: ONE_ETHER,
        from: accounts[1],
      });

      return assert.isRejected(contractInstance.add(LINK, `0x${sha256('hey')}`, ONE_ETHER, Date.now(), {
        value: ONE_ETHER,
        from: accounts[1],
      }));
    });

    it('should throw error if zero amount of wei is sent', () => {
      const LINK = 'https://google.com';

      return assert.isRejected(contractInstance.add(LINK, `0x${sha256('hey')}`, ONE_ETHER, Date.now(), {
        value: 0,
        from: accounts[1],
      }));
    });

    it('should add docLink\'s properties', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const USER = accounts[1];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: USER,
      });

      const doc = await contractInstance.documentList(LINK);

      assert.isTrue(doc.exists);
      assert.equal(doc.hash, HASH);

      assert.equal(doc.employerAmount.toString(), EMPLOYER_VALUE.toString());
      assert.equal(doc.employer, USER);
      assert.equal(doc.employeeAmount.toString(), EMPLOYEE_VALUE.toString());

      assert.equal(doc.endTime, END_TIME);
    });
  });

  describe('employeeSign', () => {
    it('should throw error if doc does not exist', async () => assert.isRejected(contractInstance.employeeSign('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if the value is more than employee amount', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE.add(toBN('100')),
      }));
    });

    it('should throw error if the value is less than employee amount', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE.sub(toBN('100')),
      }));
    });

    it('should set the employee address on the doc struct', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const doc = await contractInstance.documentList(LINK);

      assert.equal(doc.employee, EMPLOYEE);
    });
  });

  describe('oneWayCancel', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.oneWayCancel('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if caller is neither employer nor employee', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const CALLER = accounts[3];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      return assert.isRejected(contractInstance.oneWayCancel(LINK, {
        from: CALLER,
      }));
    });

    it('should throw error if voting has already been started', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;

      const END_TIME = getDate(-2);

      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.oneWayCancel(LINK, {
        from: EMPLOYER,
      }));
    });

    it('should withdraw money to employer\'s account if the caller is the employee', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      const transInfo = await contractInstance.oneWayCancel(LINK, {
        from: EMPLOYEE,
      });
      const gas = await getGas(transInfo);

      const finalEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const finalEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      assert.equal(
        finalEmployerBalance.toString(),
        prevEmployerBalance.add(EMPLOYEE_VALUE).add(EMPLOYER_VALUE).toString(),
      );

      assert.equal(
        finalEmployeeBalance.toString(),
        prevEmployeeBalance.sub(gas).toString(),
      );
    });

    it('should withdraw money to employee\'s account if the caller is the employer', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      const transInfo = await contractInstance.oneWayCancel(LINK, {
        from: EMPLOYER,
      });
      const gas = await getGas(transInfo);

      const finalEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const finalEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      assert.equal(
        finalEmployeeBalance.toString(),
        prevEmployeeBalance.add(EMPLOYEE_VALUE).add(EMPLOYER_VALUE).toString(),
      );

      assert.equal(
        finalEmployerBalance.toString(),
        prevEmployerBalance.sub(gas).toString(),
      );
    });

    it('should throw error if already settled', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await contractInstance.oneWayCancel(LINK, {
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.oneWayCancel(LINK, {
        from: EMPLOYEE,
      }));
    });
  });

  describe('twoWayCancel', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.twoWayCancel('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if caller is neither employer nor employee', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const CALLER = accounts[3];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      return assert.isRejected(contractInstance.twoWayCancel(LINK, {
        from: CALLER,
      }));
    });

    it('should throw error if voting has already been started', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;

      const END_TIME = getDate(-2);

      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await fillObservers({
        observerInstance,
        accounts,
        ownerAccountAddress,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.twoWayCancel(LINK, {
        from: EMPLOYER,
      }));
    });

    it('should not withdraw money if only employee has signed it', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      const transInfo = await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYER,
      });
      const gas = await getGas(transInfo);

      const finalEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const finalEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      assert.equal(
        finalEmployeeBalance.toString(),
        prevEmployeeBalance.toString(),
      );

      assert.equal(
        finalEmployerBalance.toString(),
        prevEmployerBalance.sub(gas).toString(),
      );
    });

    it('should not withdraw money if only employer has signed it', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      const transInfo = await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYEE,
      });
      const gas = await getGas(transInfo);

      const finalEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const finalEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      assert.equal(
        finalEmployerBalance.toString(),
        prevEmployerBalance.toString(),
      );

      assert.equal(
        finalEmployeeBalance.toString(),
        prevEmployeeBalance.sub(gas).toString(),
      );
    });

    it('should withdraw money to each other\'s account if both side has signed it', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      const employeeTransInfo = await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYEE,
      });
      const employerTransInfo = await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYER,
      });
      const employerGasUsed = await getGas(employerTransInfo);
      const employeeGasUsed = await getGas(employeeTransInfo);

      const finalEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));
      const finalEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));

      assert.equal(
        finalEmployeeBalance.toString(),
        prevEmployeeBalance.add(EMPLOYEE_VALUE).sub(employeeGasUsed).toString(),
      );

      assert.equal(
        finalEmployerBalance.toString(),
        prevEmployerBalance.add(EMPLOYER_VALUE).sub(employerGasUsed).toString(),
      );
    });

    it('should throw error if already settled', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate();
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYEE,
      });
      await contractInstance.twoWayCancel(LINK, {
        from: EMPLOYER,
      });

      return assert.isRejected(contractInstance.twoWayCancel(LINK, {
        from: EMPLOYER,
      }));
    });
  });

  describe('requestVoting', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.employeeSign('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if caller is neither employer nor employee', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate(-1);
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const CALLER = accounts[3];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      return assert.isRejected(contractInstance.requestVoting(LINK, {
        from: CALLER,
      }));
    });

    it('should throw error if endTime hasn\'t arrived yet', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate(10);
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      return assert.isRejected(contractInstance.requestVoting(LINK, {
        from: EMPLOYEE,
      }));
    });

    it('should throw error if voting has already been requested', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate(-2);
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYEE,
      });

      return assert.isRejected(contractInstance.requestVoting(LINK));
    });

    it('should set vote\'s properties', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;
      const END_TIME = getDate(-2);
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await contractInstance.add(LINK, HASH, EMPLOYEE_VALUE, END_TIME, {
        value: EMPLOYER_VALUE,
        from: EMPLOYER,
      });

      await contractInstance.employeeSign(LINK, {
        from: EMPLOYEE,
        value: EMPLOYEE_VALUE,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYEE,
      });

      const votingProps = await contractInstance.votingProps(LINK);

      assert.isTrue(
        votingProps.hasRequestedForVoting,
      );

      assert.equal(votingProps.endVotingTime.toString(), getDate(30));
    });

    it('should pick the voters randomly', async () => {
      const FIRST_LINK = 'https://google.com';
      const SECOND_LINK = 'https://pmzi.dev';
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];

      await createSignedDoc({
        link: FIRST_LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await createSignedDoc({
        link: SECOND_LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(FIRST_LINK, {
        from: EMPLOYEE,
      });

      await sleep(1000);

      await contractInstance.requestVoting(SECOND_LINK, {
        from: EMPLOYEE,
      });

      const firstVoters = await contractInstance.getDocObservers(FIRST_LINK);
      const secondVoters = await contractInstance.getDocObservers(SECOND_LINK);

      assert.equal(firstVoters.length, VOTERS_COUNT);
      assert.equal(secondVoters.length, VOTERS_COUNT);
      assert.notDeepEqual(firstVoters, secondVoters);
    });
  });

  describe('vote', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.vote('some-link', 1, {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if observers does not exist', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      const allObservers = await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);

      const nonObservers = allObservers.filter((obs) => !observers.includes(obs));

      const nonObserver = nonObservers[0];

      return assert.isRejected(contractInstance.vote(LINK, 1, {
        from: nonObserver,
      }));
    });

    it('should throw error if observers has already voted', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      await contractInstance.vote(LINK, 1, {
        from: targetObserver,
      });

      return assert.isRejected(contractInstance.vote(LINK, 1, {
        from: targetObserver,
      }));
    });

    it('should change last vote of observers', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      const timestamp = getDate();

      await contractInstance.vote(LINK, 1, {
        from: targetObserver,
      });

      const observerProps = await observerInstance.observersList(targetObserver);

      assert.equal(
        observerProps.lastVote,
        timestamp,
      );
    });

    it('should submit vote', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      const VOTE = 1;

      await contractInstance.vote(LINK, VOTE, {
        from: targetObserver,
      });

      const observerProps = await contractInstance.observers(LINK, targetObserver);
      const votingProps = await contractInstance.votingProps(LINK);

      assert.equal(
        observerProps.vote,
        VOTE,
      );
      assert.isTrue(
        observerProps.hasVoted,
      );
      assert.equal(
        votingProps.voteCount,
        1,
      );
    });

    it('should increase voteResult if vote is fot Employee', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      const VOTE = 1;

      await contractInstance.vote(LINK, VOTE, {
        from: targetObserver,
      });

      const votingProps = await contractInstance.votingProps(LINK);

      assert.equal(
        votingProps.votingResult,
        -1,
      );
    });

    it('should decrease voteResult if vote is fot Employer', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      const VOTE = 0;

      await contractInstance.vote(LINK, VOTE, {
        from: targetObserver,
      });

      const votingProps = await contractInstance.votingProps(LINK);

      assert.equal(
        votingProps.votingResult,
        1,
      );
    });

    it('should not finish voting if it is not the last vote', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: ONE_ETHER.mul(toBN(2)),
        employerValue: ONE_ETHER,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const targetObserver = observers[0];

      const VOTE = 1;

      await contractInstance.vote(LINK, VOTE, {
        from: targetObserver,
      });

      const docInfo = await contractInstance.documentList(LINK);

      assert.isFalse(
        docInfo.hasSettled,
      );
    });

    it('should finish voting and distribute fee on last vote if employer won', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';
      const EMPLOYER_VALUE = ONE_ETHER;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: EMPLOYEE_VALUE,
        employerValue: EMPLOYER_VALUE,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));
      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));

      const observers = await contractInstance.getDocObservers(LINK);

      const VOTE = 0;

      for (const observer of observers) {
        await contractInstance.vote(LINK, VOTE, {
          from: observer,
        });
      }

      const employeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));
      const employerBalance = toBN(await web3.eth.getBalance(EMPLOYER));

      assert.equal(
        prevEmployerBalance.add(EMPLOYEE_VALUE).add(EMPLOYER_VALUE).sub(
          EMPLOYEE_VALUE.add(EMPLOYER_VALUE).mul(VOTERS_FEE_PERCENT).div(toBN('100')),
        ).toString(),
        employerBalance.toString(),
      );

      assert.equal(
        prevEmployeeBalance.toString(),
        employeeBalance.toString(),
      );
    });

    it('should finish voting and distribute fee on last vote if employee won', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';
      const EMPLOYER_VALUE = ONE_ETHER;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: EMPLOYEE_VALUE,
        employerValue: EMPLOYER_VALUE,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const prevEmployeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));
      const prevEmployerBalance = toBN(await web3.eth.getBalance(EMPLOYER));

      const observers = await contractInstance.getDocObservers(LINK);

      const VOTE = 1;

      for (const observer of observers) {
        await contractInstance.vote(LINK, VOTE, {
          from: observer,
        });
      }

      const employeeBalance = toBN(await web3.eth.getBalance(EMPLOYEE));
      const employerBalance = toBN(await web3.eth.getBalance(EMPLOYER));

      assert.equal(
        prevEmployeeBalance.add(EMPLOYEE_VALUE).add(EMPLOYER_VALUE).sub(
          EMPLOYEE_VALUE.add(EMPLOYER_VALUE).mul(VOTERS_FEE_PERCENT).div(toBN('100')),
        ).toString(),
        employeeBalance.toString(),
      );

      assert.equal(
        prevEmployerBalance.toString(),
        employerBalance.toString(),
      );
    });

    it('should finish voting and distribute voters fee if the fee is less than threshold', async () => {
      const EMPLOYER = accounts[1];
      const EMPLOYEE = accounts[2];
      const LINK = 'https://google.com';
      const EMPLOYER_VALUE = ONE_ETHER;
      const EMPLOYEE_VALUE = ONE_ETHER;

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: EMPLOYEE_VALUE,
        employerValue: EMPLOYER_VALUE,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
        value: ONE_ETHER,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const observersBalances = [];
      const observersAmounts = [];

      const VOTE = 1;

      for (const observer of observers) {
        const observerBalance = toBN(await web3.eth.getBalance(observer));
        const observerProps = await observerInstance.observersList(observer);
        const observerAmount = observerProps.amount;

        const info = await contractInstance.vote(LINK, VOTE, {
          from: observer,
        });

        const gas = await getGas(info);

        observersBalances.push(observerBalance.sub(gas));
        observersAmounts.push(observerAmount);
      }

      for (let i = 0; i < observers.length; i += 1) {
        const observer = observers[i];
        const observerFinalBalance = toBN(await web3.eth.getBalance(observer));
        const observerFinalProps = await observerInstance.observersList(observer);
        const observerFinalAmount = observerFinalProps.amount;

        const observerPrevBalance = observersBalances[i];
        const observerPrevAmount = observersAmounts[i];

        assert.equal(
          observerFinalBalance.toString(),
          observerPrevBalance.add(
            EMPLOYEE_VALUE.add(EMPLOYER_VALUE)
              .mul(VOTERS_FEE_PERCENT)
              .div(toBN(100))
              .div(toBN(VOTERS_COUNT)),
          ).toString(),
        );

        assert.equal(
          observerPrevAmount.toString(),
          observerFinalAmount.toString(),
        );
      }
    });

    it('should finish voting and distribute voters fee and increase their amount if the fee is more than threshold', async () => {
      const EMPLOYER = accounts[5];
      const EMPLOYEE = accounts[6];
      const LINK = 'https://google.com';
      const EMPLOYER_VALUE = ONE_ETHER.mul(toBN(100));
      const EMPLOYEE_VALUE = ONE_ETHER;
      const OBSERVER_VALUE = ONE_ETHER;

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: EMPLOYEE_VALUE,
        employerValue: EMPLOYER_VALUE,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
        value: OBSERVER_VALUE,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYER,
      });

      const observers = await contractInstance.getDocObservers(LINK);
      const observersBalances = [];
      const observersAmounts = [];

      const VOTE = 1;

      for (const observer of observers) {
        const observerBalance = toBN(await web3.eth.getBalance(observer));
        const observerProps = await observerInstance.observersList(observer);
        const observerAmount = observerProps.amount;

        const info = await contractInstance.vote(LINK, VOTE, {
          from: observer,
        });

        const gas = await getGas(info);

        observersBalances.push(observerBalance.sub(gas));
        observersAmounts.push(observerAmount);
      }

      for (let i = 0; i < observers.length; i += 1) {
        const observer = observers[i];
        const observerFinalBalance = toBN(await web3.eth.getBalance(observer));
        const observerFinalProps = await observerInstance.observersList(observer);
        const observerFinalAmount = observerFinalProps.amount;

        const observerPrevBalance = observersBalances[i];
        const observerPrevAmount = observersAmounts[i];

        const valueToBeAddedToBalance = OBSERVER_VALUE
          .mul(VOTERS_MAX_CASH_FEE_PERCENT)
          .div(toBN(100));

        assert.equal(
          observerFinalBalance.toString(),
          observerPrevBalance.add(
            valueToBeAddedToBalance,
          ).toString(),
        );

        assert.equal(
          observerPrevAmount.add(
            EMPLOYEE_VALUE
              .add(EMPLOYER_VALUE)
              .mul(VOTERS_FEE_PERCENT)
              .div(toBN(VOTERS_COUNT))
              .div(toBN(100))
              .sub(valueToBeAddedToBalance),
          ).toString(),
          observerFinalAmount
            .toString(),
        );
      }
    });
  });

  describe('finishVotingDueTime', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.finishVotingDueTime('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if voting end time hasn\'t arrived', async () => {
      const EMPLOYER = accounts[5];
      const EMPLOYEE = accounts[6];
      const LINK = 'https://google.com';
      const EMPLOYER_VALUE = ONE_ETHER.mul(toBN(100));
      const EMPLOYEE_VALUE = ONE_ETHER;
      const OBSERVER_VALUE = ONE_ETHER;

      await createSignedDoc({
        link: LINK,
        hash: `0x${sha256('hey')}`,
        employee: EMPLOYEE,
        employer: EMPLOYER,
        employeeValue: EMPLOYEE_VALUE,
        employerValue: EMPLOYER_VALUE,
        endTime: getDate(-2),
        contractInstance,
      });

      await fillObservers({
        ownerAccountAddress,
        accounts,
        observerInstance,
        value: OBSERVER_VALUE,
      });

      await contractInstance.requestVoting(LINK, {
        from: EMPLOYEE,
      });

      return assert.isRejected(contractInstance.finishVotingDueTime(LINK, {
        from: EMPLOYEE,
      }));
    });
  });
});
