pragma solidity >=0.6.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.1.0/contracts/token/ERC20/IERC20.sol";

interface MMR is IERC20 {
	function mint() external payable;
	function tokenPrice() external view returns (uint);
	function verifyOnChain(uint blockNumber, bytes32 blockHash, bytes32[] calldata proof, uint localBlockNumber, bytes32[8] calldata localRoots) external returns (bool);
}

contract Bounty {
	uint internal constant VERIFY_COST = 6000;
	
	MMR _mmr;
    constructor (address addr) public payable {
        _mmr = MMR(addr);
    }
	
	function challengeWithToken(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localRoots1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localRoots2) public {
		_mmr.transferFrom(msg.sender, address(this), VERIFY_COST*2);
		
		challenge(blockNumber, blockHash1, proof1, localBlockNumber1, localRoots1, blockHash2, proof2, localBlockNumber2, localRoots2);
	}
	function challengeWithEth(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localRoots1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localRoots2) public payable {
		uint amount = _mmr.tokenPrice()*VERIFY_COST*2;
		require(msg.value >= amount);
		
		if(msg.value > amount) {
			msg.sender.transfer(msg.value - amount);
		}
		
		_mmr.mint{value:amount}();
		
		challenge(blockNumber, blockHash1, proof1, localBlockNumber1, localRoots1, blockHash2, proof2, localBlockNumber2, localRoots2);
	}
	
	function challenge(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localRoots1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localRoots2) internal {
		require(blockHash1 != bytes32(0));
		require(blockHash2 != bytes32(0));
		
		//require(blockHash1 != blockHash2);
		
		require(_mmr.verifyOnChain(blockNumber, blockHash1, proof1, localBlockNumber1, localRoots1));
		require(_mmr.verifyOnChain(blockNumber, blockHash2, proof2, localBlockNumber2, localRoots2));
		
		msg.sender.transfer(address(this).balance);
	}
}
