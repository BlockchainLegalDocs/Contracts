const Documents = artifacts.require('Documents');
const Observers = artifacts.require('Observers');
const { assert } = require('chai');

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
    it('should throw error if docLink already exists');

    it('should throw error if zero amount of wei is sent');

    it('should add docLink\'s properties');
  });

  describe('employeeSign', () => {
    it('should throw error if the value is less than employee amount');

    it('should set the employee address on the doc struct');
  });

  describe('oneWayCancel', () => {
    it('should throw error if doc doesn\'t exist');

    it('should throw error if caller is neither employer nor employee');

    it('should throw error if voting has already been started');

    it('should withdraw money to employer\'s account if the caller is the employee');

    it('should withdraw money to employee\'s account if the caller is the employer');
  });

  describe('twoWayCancel', () => {
    it('should throw error if doc doesn\'t exist');

    it('should throw error if caller is neither employer nor employee');

    it('should throw error if voting has already been started');

    it('should not withdraw money if only employee has signed it');

    it('should not withdraw money if only employer has signed it');

    it('should withdraw money to each other\'s account if both side has signed it');
  });

  describe('requestVoting', () => {
    it('should throw error if doc doesn\'t exist');

    it('should throw error if caller is neither employer nor employee');

    it('should throw error if endTime hasn\'t arrived yet');

    it('should throw error if voting has already been requested');

    it('should set vote\'s properties');

    it('should pick the voters randomly');
  });

  describe('vote', () => {
    it('should throw error if doc doesn\'t exist');

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
    it('should throw error if doc doesn\'t exist');

    it('should throw error if voting end time hasn\'t arrived');
  });
});
