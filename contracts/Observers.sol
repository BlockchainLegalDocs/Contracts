// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.4;

error InsufficientValue();
error AlreadySignedUp();
error AccessDenied();
error DoesntExists();
error SettleTimeNotArrived();

contract Observers {
    struct Observer {
        uint amount;
        uint lastVote;
        bool hasVerified;
        bool hasSettled;
        bool exists;
        bool isFired;
    }
    
    address immutable public owner;
    address public documentContractAddr;
    mapping (address => Observer) public observersList;
    address[] public observersAddrList;
    
    modifier requireOwner() {
        if(msg.sender != owner) revert AccessDenied();
        _;
    }
    
    modifier requireDocContract() {
        if(msg.sender != documentContractAddr) revert AccessDenied();
        _;
    }
    
    modifier requireSignUp(address observer) {
        if(!observersList[observer].exists) revert DoesntExists();
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function getObserversAddrList() external view returns (address[] memory) {
        return observersAddrList;
    }
    
    function setDocumentContractAddress(address newDocContractAddr) public requireOwner {
        documentContractAddr = newDocContractAddr;
    }
    
    function signup() external payable {
        if(msg.value < 1) revert InsufficientValue();
        if(observersList[msg.sender].exists) revert AlreadySignedUp();
        
        observersList[msg.sender].amount = msg.value;
        observersList[msg.sender].exists = true;
    }
    
    function verify() external requireOwner requireSignUp(msg.sender) {
        observersList[msg.sender].hasVerified = true;
        observersAddrList.push(msg.sender);
    }
    
    function changeLastVote(uint time, address observer) external requireDocContract requireSignUp(observer) {
        observersList[observer].lastVote = time;
    }
    
    function increaseObserverAmount(uint amount, address observer) external requireDocContract requireSignUp(observer) {
        observersList[observer].amount += amount;
    }
    
    function settle() external requireSignUp(msg.sender) {
        if(observersList[msg.sender].lastVote + 90 days >= block.timestamp) revert SettleTimeNotArrived();

        payable(msg.sender).transfer(observersList[msg.sender].amount);
    }
    
    function fireObserver(address observer) external requireOwner requireSignUp(observer) {
        observersList[observer].isFired = true;
        observersList[observer].amount = 0;

        removeObserverAddress(observer);
    }

    function findObserverAddressIndex(address value) private view returns(uint) {
        uint i = 0;
        while (observersAddrList[i] != value) {
            i++;
        }
        return i;
    }

    function removeObserverAddress(address value) private {
        uint i = findObserverAddressIndex(value);
        removeObserverAddressByIndex(i);
    }

    function removeObserverAddressByIndex(uint index) private {
        if (index >= observersAddrList.length) return;

        for (uint i = index; i<observersAddrList.length-1; i++){
            observersAddrList[i] = observersAddrList[i+1];
        }
        observersAddrList.pop();
    }
}