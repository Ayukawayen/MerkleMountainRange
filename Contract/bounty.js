pragma solidity >=0.6.0;

interface MMR {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
	function mint() external payable;
	function tokenPrice() external view returns (uint);
	function verifyOnChain(uint blockNumber, bytes32 blockHash, bytes32[] calldata proof, uint localBlockNumber, bytes32[8] calldata localPeaks) external returns (bool);
}

contract Bounty {
	uint internal constant VERIFY_COST = 6000;
	
	MMR _mmr;
	address payable _owner;
	uint _createTime;
	
    constructor (address addr) public payable {
        _mmr = MMR(addr);
		_owner = msg.sender;
		_createTime = block.timestamp;
    }
    receive() external payable {
    }
	function destruct() public {
		require(block.timestamp > _createTime + 60 days);
		
		selfdestruct(_owner);
	}
	
	function challengeWithToken(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localPeaks1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localPeaks2) public {
		_mmr.transferFrom(msg.sender, address(this), VERIFY_COST*2);
		
		challenge(blockNumber, blockHash1, proof1, localBlockNumber1, localPeaks1, blockHash2, proof2, localBlockNumber2, localPeaks2);
	}
	function challengeWithEth(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localPeaks1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localPeaks2) public payable {
		uint amount = _mmr.tokenPrice()*VERIFY_COST*2;
		require(msg.value >= amount);
		
		if(msg.value > amount) {
			msg.sender.transfer(msg.value - amount);
		}
		
		_mmr.mint{value:amount}();
		
		challenge(blockNumber, blockHash1, proof1, localBlockNumber1, localPeaks1, blockHash2, proof2, localBlockNumber2, localPeaks2);
	}
	
	function challenge(uint blockNumber, bytes32 blockHash1, bytes32[] memory proof1, uint localBlockNumber1, bytes32[8] memory localPeaks1, bytes32 blockHash2, bytes32[] memory proof2, uint localBlockNumber2, bytes32[8] memory localPeaks2) internal {
		require(blockHash1 != bytes32(0), "blockHash1 is ZERO");
		require(blockHash2 != bytes32(0), "blockHash2 is ZERO");
		
		require(blockHash1 != blockHash2, "blockHash1 and blockHash2 are equal");
		
		require(_mmr.verifyOnChain(blockNumber, blockHash1, proof1, localBlockNumber1, localPeaks1), "blockHash1 not verified");
		require(_mmr.verifyOnChain(blockNumber, blockHash2, proof2, localBlockNumber2, localPeaks2), "blockHash2 not verified");
		
		msg.sender.transfer(address(this).balance);
	}
}
