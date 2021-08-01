// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.6;

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

contract Documents {
    enum WithdrawType {
        Employee,
        Employer,
        Revert
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
        WithdrawType withdrawType;
        
        bool hasEmployerCanceled;
        bool hasEmployeeCanceled;
    }
    
    mapping (string => Document) public documentList;
    mapping (string => mapping(address => ObserverResult)) public observers;
    mapping (string => address[]) public observerAddresses;
    mapping (string => VotingProps) public votingProps;
    
    address immutable public owner;
    address immutable private observerContractAddr;

    uint8 constant private votersCount = 5;
    uint8 constant private votersFeePercent = 1;
    uint8 constant private votersMaxCashFeePercent = 20;

    modifier requireOwner() {
        if(msg.sender != owner) revert AccessDenied();
        _;
    }
    
    modifier requireEmployerOrEmployee(string calldata docLink){
        if(msg.sender != documentList[docLink].employee && msg.sender != documentList[docLink].employer) revert AccessDenied();
        _;
    }
    
    modifier requireDoc(string calldata docLink) {
        if(!documentList[docLink].exists) revert DoesntExist();
        _;
    }
    
    constructor(address newObserverContractAddr) {
        owner = msg.sender;
        observerContractAddr = newObserverContractAddr;
    }
    
    // Getters
    
    function hasSettled(string calldata docLink) external view requireDoc(docLink) returns (bool) {
        return documentList[docLink].hasSettled;
    }

    function getDocObservers(string calldata docLink) external view returns (address[] memory) {
        return observerAddresses[docLink];
    }
    
    // Initial Sigings
    
    function add(string calldata docLink, bytes32 hash, uint employeeAmount, uint endTime) external payable {
        if(documentList[docLink].exists) revert AlreadyExists();
        if(msg.value == 0) revert InsufficientValue();
        
        documentList[docLink].exists = true;
        documentList[docLink].hash = hash;
        
        documentList[docLink].employerAmount = msg.value;
        documentList[docLink].employer = msg.sender;
        documentList[docLink].employeeAmount = employeeAmount;
        
        documentList[docLink].endTime = endTime;
    }
    
    function employeeSign(string calldata docLink) external payable requireDoc(docLink) {
        if(msg.value != documentList[docLink].employeeAmount) revert InsufficientValue();
        
        documentList[docLink].employee = msg.sender;
    }
    
    // Withraw Functions
    
    function withdraw(WithdrawType withdrawType, string calldata docLink) private {
        if(documentList[docLink].hasSettled) revert AlreadySettled();
        
        if(withdrawType == WithdrawType.Employee) {
            payable(documentList[docLink].employee).transfer(documentList[docLink].employerAmount + documentList[docLink].employeeAmount);
        } else if (withdrawType == WithdrawType.Employer){
            payable(documentList[docLink].employer).transfer(documentList[docLink].employerAmount + documentList[docLink].employeeAmount);
        }else {
            payable(documentList[docLink].employer).transfer(documentList[docLink].employerAmount);
            payable(documentList[docLink].employee).transfer(documentList[docLink].employeeAmount);
        }
        
        documentList[docLink].hasSettled = true;
        documentList[docLink].withdrawType = withdrawType;
    }
    
    // Cancellation Methods
    
    function oneWayCancel(string calldata docLink) external requireDoc(docLink) requireEmployerOrEmployee(docLink) {
        if(votingProps[docLink].hasRequestedForVoting) revert VotingStarted();
        
        if(msg.sender == documentList[docLink].employer) {
            withdraw(WithdrawType.Employee, docLink);
        } else {
            withdraw(WithdrawType.Employer, docLink);
        }
    }
    
    function twoWayCancel(string calldata docLink) external requireDoc(docLink) requireEmployerOrEmployee(docLink) {
        if(votingProps[docLink].hasRequestedForVoting) revert VotingStarted();
        
        if(msg.sender == documentList[docLink].employer) {
            documentList[docLink].hasEmployerCanceled = true;
        } else {
            documentList[docLink].hasEmployeeCanceled = true;
        }
        
        if(documentList[docLink].hasEmployeeCanceled && documentList[docLink].hasEmployerCanceled) {
            withdraw(WithdrawType.Revert, docLink);
        }
    }
    
    // Voting system
    
    function requestVoting(string calldata docLink) external requireDoc(docLink) requireEmployerOrEmployee(docLink) {
        if(block.timestamp < documentList[docLink].endTime) revert EndTimeNotArrived();
        if(votingProps[docLink].hasRequestedForVoting) revert AlreadyRequestedForVoting();
        
        votingProps[docLink].hasRequestedForVoting = true;
        votingProps[docLink].endVotingTime = block.timestamp + 30 days;
        
        pickRandomObservers(docLink);
    }
    
    function vote(string calldata docLink, ObserverVote voteValue) external requireDoc(docLink) {
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
    
    function finishVotingDueTime(string calldata docLink) external requireDoc(docLink) requireEmployerOrEmployee(docLink)  {
        if(block.timestamp < votingProps[docLink].endVotingTime) revert VotingEndTimeNotArrived();
        
        finishVoting(docLink);
    }
    
    function finishVoting(string calldata docLink) private {
        distributeVotersFee(docLink);
        
        documentList[docLink].employeeAmount -= documentList[docLink].employeeAmount * votersFeePercent / 100;
        documentList[docLink].employerAmount -= documentList[docLink].employerAmount * votersFeePercent / 100;
        
        if(votingProps[docLink].votingResult < 0) {
            withdraw(WithdrawType.Employee, docLink);
        } else if(votingProps[docLink].votingResult > 0) {
            withdraw(WithdrawType.Employer, docLink);
        } else {
            withdraw(WithdrawType.Revert, docLink);
        }
    }
    
    function distributeVotersFee(string calldata docLink) private {
        uint eachVotersFeeAmount = (documentList[docLink].employerAmount + documentList[docLink].employeeAmount) * votersFeePercent / 100 / votersCount;
        for(uint i =0;i<observerAddresses[docLink].length;i++){
            address currentObserverAddress = observerAddresses[docLink][i];
            uint currentVoterAmount = ObserverContract(observerContractAddr).observersList(currentObserverAddress).amount;
            
            uint voterMaxFee = currentVoterAmount * votersMaxCashFeePercent / 100;

            if(eachVotersFeeAmount < voterMaxFee) {
                payable(currentObserverAddress).transfer(eachVotersFeeAmount);
            } else {
                payable(currentObserverAddress).transfer(voterMaxFee);
                ObserverContract(observerContractAddr).increaseObserverAmount(eachVotersFeeAmount - voterMaxFee, currentObserverAddress);
            }
        }
    }
    
    // Random Number generators
    
    function pickRandomObservers(string calldata docLink) private {
        address[] memory observersList = ObserverContract(observerContractAddr).getObserversAddrList();
        uint observersCount = observersList.length;
        uint votersCountLimit = votersCount;

        for (uint256 i = 0; i < votersCountLimit; i++) {
            uint randomNumber = uint256(keccak256(abi.encode(block.timestamp, block.difficulty, i)));
            uint randomNormalizedNumber = (randomNumber % observersCount);
            address randomObserverAddress = observersList[randomNormalizedNumber];

            if(observers[docLink][randomObserverAddress].exists) {
                votersCountLimit++;
            }else {
                observers[docLink][randomObserverAddress].exists = true;
                observerAddresses[docLink].push(randomObserverAddress);
            }
        }
    }
}