const { assert } = require('chai');
const sha256 = require('sha256');

const Documents = artifacts.require('Documents');
const Observers = artifacts.require('Observers');

const { toBN } = web3.utils;

const ONE_ETHER = web3.utils.toWei(toBN(1));

async function getGas(transInfo) {
  const tx = await web3.eth.getTransaction(transInfo.tx);
  const gasPrice = toBN(tx.gasPrice);
  const gasUsed = toBN(transInfo.receipt.gasUsed);
  return gasPrice.mul(gasUsed);
}

contract('Documents', (accounts) => {
  const observersContractAddress = Observers.address;
  const ownerAccountAddress = accounts[0];

  let contractInstance;
  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(() => Documents.new(observersContractAddress)
    .then((instance) => {
      contractInstance = instance;
    }));

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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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

    it.skip('should throw error if voting has already been started', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;

      const date = new Date();
      const END_TIME = Math.floor(date.setDate(date.getDate() - 2) / 1000);

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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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

    it.skip('should throw error if voting has already been started', async () => {
      const LINK = 'https://google.com';
      const HASH = `0x${sha256('hey')}`;
      const EMPLOYEE_VALUE = ONE_ETHER.mul(toBN(2));
      const EMPLOYER_VALUE = ONE_ETHER;

      const date = new Date();
      const END_TIME = Math.floor(date.setDate(date.getDate() - 2) / 1000);

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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const END_TIME = Date.now();
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
      const date = new Date();
      const END_TIME = date.setDate(date.getDate() - 1);
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
      const date = new Date();
      const END_TIME = date.setDate(date.getDate() + 10);
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

    it.skip('should throw error if voting has already been requested');

    it.skip('should set vote\'s properties');

    it.skip('should pick the voters randomly');
  });

  describe('vote', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.vote('some-link', 1, {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it('should throw error if observers does not exist');

    it('should throw error if observers has already voted');

    it('should change last vote of observers');

    it('should submit vote');

    it('should increase voteResult if vote is fot Employee');

    it('should decrease voteResult if vote is fot Employer');

    it('should not finish voting if it is not the last vote');

    it('should finish voting and distribute fee on last vote if employer won');

    it('should finish voting and distribute fee on last vote if employee won');

    it('should finish voting and distribute fee on last vote if none of sides won');

    it('should finish voting and distribute voters fee if the fee is less than threshold');

    it('should finish voting and distribute voters fee and increase their amount if the fee is more than threshold');
  });

  describe('finishVotingDueTime', () => {
    it('should throw error if doc doesn\'t exist', async () => assert.isRejected(contractInstance.finishVotingDueTime('some-link', {
      from: accounts[1],
      value: ONE_ETHER,
    })));

    it.skip('should throw error if voting end time hasn\'t arrived');
  });
});
