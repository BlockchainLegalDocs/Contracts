// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.6;

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
    }
    
    address immutable private owner;
    address immutable private documentContractAddr;
    mapping (address => Observer) observersList;
    address[] observersAddrList;
    
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
    
    constructor(address documentContract) {
        owner = msg.sender;
        documentContractAddr = documentContract;
    }
    
    function signup () external payable {
        if(msg.value < 1) revert InsufficientValue();
        if(observersList[msg.sender].exists) revert AlreadySignedUp();
        
        observersList[msg.sender].amount = msg.value;
        observersList[msg.sender].exists = true;
        observersAddrList.push(msg.sender);
    }
    
    function verify() external requireOwner requireSignUp(msg.sender) {
        observersList[msg.sender].hasVerified = true;
    }
    
    function changeLastVote(uint time, address observer) external requireDocContract requireSignUp(observer) {
        observersList[observer].lastVote = time;
    }
    
    function settle() external requireSignUp(msg.sender) {
        if(observersList[msg.sender].lastVote + 90 days >= block.timestamp) revert SettleTimeNotArrived();

        payable(msg.sender).transfer(observersList[msg.sender].amount);
    }
}