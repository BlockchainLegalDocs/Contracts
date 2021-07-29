// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.6;

import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

error InsufficientValue();
error AccessDenied();
error AlreadyExists();
error DoesntExist();
error EndTimeNotArrived();
error AlreadySettled();
error ObserverNotFound();
error ObserverAlreadyVoted();
error AlreadyRequestedForVoting();
error NotEnoughLinkForGas();
error VotingEndTimeNotArrived();
error VotingStarted();

struct Observer {
    uint amount;
    uint lastVote;
    bool hasVerified;
    bool hasSettled;
    bool exists;
    bool isFired;
}

interface ObserverContract {
    function getObserversAddrList() external view returns (address[] memory);
    function observersList(address)  external view returns (Observer memory);
    function increaseObserverAmount(uint amount, address observer) external;
    function changeLastVote(uint time, address observer) external;
}

contract Documents is VRFConsumerBase {
    enum WithrawType {
        Employee,
        Employer,
        Even
    }
    
    enum ObserverVote {
        Employer,
        Employee
    }
    
    struct ObserverResult {
        ObserverVote vote;
        bool exists;
        bool hasVoted;
    }
    
    struct VotingProps {
        bool hasRequestedForVoting;
        uint endVotingTime;
        int8 votingResult;
        uint voteCount;
    }
    
    struct Document {
        bytes32 hash;
        address employer;
        address employee;
        uint employeeAmount;
        uint employerAmount;
        uint endTime;
        bool exists;
        
        bool hasSettled;
        WithrawType withrawType;
        
        bool hasEmployerCanceled;
        bool hasEmployeeCanceled;
    }
    
    mapping (string => Document) public documentList;
    mapping (string => mapping(address => ObserverResult)) public observers;
    mapping (string => address[]) public observerAddresses;
    mapping (string => VotingProps) public votingProps;
    
    address immutable private owner;
    address immutable private observerContractAddr;

    uint8 constant private votersCount = 5;
    uint8 constant private votersFeePercent = 1;
    uint8 constant private votersMaxCashFeePercent = 20;

    bytes32 constant private sKeyHash = 0x2ed0feb3e7fd2022120aa84fab1945545a9f2ffc9076fd6156fa96eaff4c1311;
    uint256 constant private sFee = 100000000000000000;
    mapping(bytes32 => string) private sRollersDocs;
    uint256 private constant ROLL_IN_PROGRESS = 42;
    
    modifier requireOwner() {
        if(msg.sender != owner) revert AccessDenied();
        _;
    }
    
    modifier requiredEmployerOrEmployee(string calldata docLink){
        if(msg.sender != documentList[docLink].employee || msg.sender != documentList[docLink].employer) revert AccessDenied();
        _;
    }
    
    modifier requiredDoc(string calldata docLink) {
        if(!documentList[docLink].exists) revert DoesntExist();
        _;
    }
    
    constructor(address newObserverContractAddr) VRFConsumerBase(
        0xb3dCcb4Cf7a26f6cf6B120Cf5A73875B7BBc655B,
        0x01BE23585060835E02B77ef475b0Cc51aA1e0709
    ) {
        owner = msg.sender;
        observerContractAddr = newObserverContractAddr;
    }
    
    // Getters
    
    function hasSettled(string calldata docLink) external view requiredDoc(docLink) returns (bool) {
        return documentList[docLink].hasSettled;
    }
    
    // Initial Sigings
    
    function add(string calldata docLink, bytes32 hash, uint employerAmount, uint endTime) external payable {
        if(documentList[docLink].exists) revert AlreadyExists();
        if(msg.value == 0) revert InsufficientValue();
        
        documentList[docLink].exists = true;
        documentList[docLink].hash = hash;
        
        documentList[docLink].employerAmount = employerAmount;
        documentList[docLink].employer = msg.sender;
        documentList[docLink].employeeAmount = msg.value;
        
        documentList[docLink].endTime = endTime;
    }
    
    function eployeeSign(string calldata docLink) external payable requiredDoc(docLink) {
        if(msg.value < documentList[docLink].employeeAmount) revert InsufficientValue();
        
        documentList[docLink].employee = msg.sender;
    }
    
    // Withraw Functions
    
    function withraw(WithrawType withrawType, string calldata docLink) private {
        if(documentList[docLink].hasSettled) revert AlreadySettled();
        
        if(withrawType == WithrawType.Employee) {
            payable(documentList[docLink].employee).transfer(documentList[docLink].employerAmount + documentList[docLink].employeeAmount);
        } else if (withrawType == WithrawType.Employer){
            payable(documentList[docLink].employer).transfer(documentList[docLink].employerAmount + documentList[docLink].employeeAmount);
        }else {
            payable(documentList[docLink].employer).transfer(documentList[docLink].employerAmount);
            payable(documentList[docLink].employee).transfer(documentList[docLink].employeeAmount);
        }
        
        documentList[docLink].hasSettled = true;
        documentList[docLink].withrawType = withrawType;
    }
    
    // Cancellation Methods
    
    function oneWayCacnel(string calldata docLink) external requiredDoc(docLink) requiredEmployerOrEmployee(docLink) {
        if(votingProps[docLink].hasRequestedForVoting) revert VotingStarted();
        
        if(msg.sender == documentList[docLink].employer) {
            withraw(WithrawType.Employee, docLink);
        } else {
            withraw(WithrawType.Employer, docLink);
        }
    }
    
    function twoWayCacnel(string calldata docLink) external requiredDoc(docLink) requiredEmployerOrEmployee(docLink) {
        if(votingProps[docLink].hasRequestedForVoting) revert VotingStarted();
        
        if(msg.sender == documentList[docLink].employer) {
            documentList[docLink].hasEmployerCanceled = true;
        } else {
            documentList[docLink].hasEmployeeCanceled = true;
        }
        
        if(documentList[docLink].hasEmployeeCanceled && documentList[docLink].hasEmployerCanceled) {
            withraw(WithrawType.Even, docLink);
        }
    }
    
    // Voting system
    
    function requestVoting(string calldata docLink) external requiredDoc(docLink) requiredEmployerOrEmployee(docLink) {
        if(block.timestamp < documentList[docLink].endTime) revert EndTimeNotArrived();
        if(votingProps[docLink].hasRequestedForVoting) revert AlreadyRequestedForVoting();
        
        votingProps[docLink].hasRequestedForVoting = true;
        
        rollDice(docLink);
    }
    
    function vote(string calldata docLink, ObserverVote voteValue) external requiredDoc(docLink) {
        if(!observers[docLink][msg.sender].exists) revert ObserverNotFound();
        if(!observers[docLink][msg.sender].hasVoted) revert ObserverAlreadyVoted();
        
        ObserverContract(observerContractAddr).changeLastVote(block.timestamp, msg.sender);
        
        observers[docLink][msg.sender].vote = voteValue;
        observers[docLink][msg.sender].hasVoted = true;
        votingProps[docLink].voteCount += 1;
        
        if(voteValue == ObserverVote.Employee) {
            votingProps[docLink].votingResult -= 1;
        } else {
            votingProps[docLink].votingResult += 1;
        }
        
        
        if(votingProps[docLink].voteCount == votersCount) {
            finishVoting(docLink);
        }
    }
    
    function finishVotingDueTime(string calldata docLink) external requiredDoc(docLink) requiredEmployerOrEmployee(docLink)  {
        if(block.timestamp < votingProps[docLink].endVotingTime) revert VotingEndTimeNotArrived();
        
        finishVoting(docLink);
    }
    
    function finishVoting(string calldata docLink) private {
        distributeVotersFee(docLink);
        
        documentList[docLink].employeeAmount -= documentList[docLink].employeeAmount * votersFeePercent / 100;
        documentList[docLink].employerAmount -= documentList[docLink].employerAmount * votersFeePercent / 100;
        
        if(votingProps[docLink].votingResult < 0) {
            withraw(WithrawType.Employee, docLink);
        } else if(votingProps[docLink].votingResult > 0) {
            withraw(WithrawType.Employer, docLink);
        } else {
            withraw(WithrawType.Even, docLink);
        }
    }
    
    function distributeVotersFee(string calldata docLink) private {
        uint eachVotersFeeAmount = (documentList[docLink].employerAmount + documentList[docLink].employeeAmount) * votersFeePercent / 100 / votersCount;
        for(uint i =0;i<observerAddresses[docLink].length;i++){
            address currentObserverAddress = observerAddresses[docLink][i];
            uint currentVoterAmount = ObserverContract(observerContractAddr).observersList(currentObserverAddress).amount;
            
            if(eachVotersFeeAmount < currentVoterAmount * votersMaxCashFeePercent / 100) {
                payable(currentObserverAddress).transfer(eachVotersFeeAmount);
            } else {
                payable(currentObserverAddress).transfer(currentVoterAmount * votersMaxCashFeePercent / 100);
            }
        }
    }
    
    // VRF - Random Number generators
    
    function rollDice(string calldata docLink) public returns (bytes32 requestId) {
        if(LINK.balanceOf(address(this)) < sFee) revert NotEnoughLinkForGas();
        
        requestId = requestRandomness(sKeyHash, sFee);
        sRollersDocs[requestId] = docLink;
    }
    
    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        address[] memory observersList = ObserverContract(observerContractAddr).getObserversAddrList();
        uint observersCount = observersList.length;

        for (uint256 i = 0; i < votersCount; i++) {
            uint randomNumber = uint256(keccak256(abi.encode(randomness, i)));
            uint randomNormalizedNumber = (randomNumber % observersCount) + 1;
            
            string memory docLink = sRollersDocs[requestId];
            address randomObserverAddress = observersList[randomNormalizedNumber];
            observers[docLink][randomObserverAddress].exists = true;
            observerAddresses[docLink].push(randomObserverAddress);
        }
    }
}