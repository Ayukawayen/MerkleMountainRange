pragma solidity >=0.6.0;

import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v3.1.0/contracts/token/ERC20/ERC20.sol";

contract MMRToken is ERC20 {
    constructor () public ERC20("MerkleMoutainRange Token", "MMR") {
        _setupDecimals(0);
    }
	
	function mint() public payable {
		uint amount = msg.value / tokenPrice();
		_mint(msg.sender, amount);
	}
	function tokenPrice() virtual public view returns (uint) {}
	
	function withdraw(uint amount) public {
		uint value = address(this).balance / totalSupply() * amount;
		_burn(msg.sender, amount);
		msg.sender.transfer(value);
	}
}

contract MMRStorage is MMRToken {
	uint internal constant MAX_DEPTH = 40;
	
	uint _packedData;
	bytes32[MAX_DEPTH] public _peaks;
	
	function unpackData() internal view returns (uint gasPrice, uint64 baseBlockNumber, uint64 size) {
		uint data = _packedData;
		size = uint64(data);
		baseBlockNumber = uint64(data>>64);
		gasPrice = data>>128;
	}
	function packData(uint gasPrice, uint64 baseBlockNumber, uint64 size) internal {
		_packedData = gasPrice<<128 | uint(baseBlockNumber)<<64 | size;
	}
	
	function getBaseBlockNumber() public view returns (uint64) {
		(, uint64 baseBlockNumber, ) = unpackData();
		return baseBlockNumber;
	}
	function getSize() public view returns (uint64) {
		(, , uint64 size) = unpackData();
		return size;
	}
	function getGasPrice() internal view returns (uint) {
		(uint price, , ) = unpackData();
		return price;
	}
	function getPeaks() public view returns (bytes32[MAX_DEPTH] memory result) {
		uint64 size = getSize();
		for(uint i=0;i<MAX_DEPTH;++i) {
			result[i] = isActive(i, size) ? _peaks[i] : bytes32(0);
		}
	}
	
	constructor() public {
		uint64 baseBlockNumber = block.number>256 ? uint64(block.number)-256 : 0;
		
		packData(tx.gasprice, baseBlockNumber, 0);

		advance();
	}
	fallback() external {
		advance();
	}
	
	
	function getHash(bytes32 data0, bytes32 data1) internal pure returns (bytes32) {
		return keccak256(abi.encodePacked(data0, data1));
	}
	function isActive(uint depth, uint size) internal pure returns (bool) {
		return (size & (1<<depth) )>0;
	}
	function findOrder(uint offset, uint size) internal pure returns (uint) {
		uint order = MAX_DEPTH;
		for(; order>0; --order) {
			if((size & (1<<order))>0 && (offset & (1<<order))<=0 ) return order;
		}
		return order;
	}
	
	function tokenPrice() public override view returns (uint) {
		return (getGasPrice()<<1) + 1e9;
	}
	
	function getAvgGasPrice(uint originPrice, uint l) internal view returns (uint) {
		return (originPrice*256 + tx.gasprice*l)/(256+l);
	}
	
	function advance() internal {
	    uint gas = gasleft();
		
		(uint price, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint l = block.number - (baseBlockNumber + size);
	    if(l == 0) return;
		
		if(l > 256) {
			//TODO
		}
		
		require( (size+l >> MAX_DEPTH) <= 0);
		
		
		uint i;
		bytes32[MAX_DEPTH] memory peaks;
		bytes32[MAX_DEPTH] memory originPeaks;
		for(i=0; i<MAX_DEPTH; ++i) {
		    originPeaks[i] = peaks[i] = _peaks[i];
		}
		
		for(i=0;i<l;++i) {
			advanceOne(peaks, baseBlockNumber, size+i);
		}
		
		for(i=0; i<MAX_DEPTH; ++i) {
			if(peaks[i] != originPeaks[i]) {
				_peaks[i] = peaks[i];
			}
		}
		
		price = getAvgGasPrice(price, l);
		
		packData(price, baseBlockNumber, uint64(size+l));
		
		_mint(msg.sender, gas - gasleft());
	}
	
	function advanceOne(bytes32[MAX_DEPTH] memory peaks, uint baseBlockNumber, uint size) internal view {
		bytes32 hash = blockhash(baseBlockNumber + size);

        uint i;
		for(i=0; i<MAX_DEPTH; ++i) {
			if(!isActive(i, size)) break;
			hash = getHash(peaks[i], hash);
		}
		
		peaks[i] = hash;
	}
}

contract MMRVerify is MMRStorage {
	uint internal constant VERIFY_COST = 6000;
	
	function getVerifyCost() public pure returns (uint) {
		return VERIFY_COST;
	}
	
	function verify(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localPeaks) public view returns (bool) {
        require(tx.origin == msg.sender, "If you want call verify() from another contract, consider using verifyOnChain() instead.");
		
		return verifyInternal(blockNumber, blockHash, proof, localBlockNumber, localPeaks);
	}
	function verifyOnChain(uint blockNumber, bytes32 blockHash, bytes32[] calldata proof, uint localBlockNumber, bytes32[8] calldata localPeaks) external returns (bool) {
        _burn(msg.sender, VERIFY_COST);
		
		return verifyInternal(blockNumber, blockHash, proof, localBlockNumber, localPeaks);
	}
	function verifyInternal(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localPeaks) internal view returns (bool) {
		if(blockNumber + 256 >= block.number) return blockHash == blockhash(blockNumber);
		
		if(blockHash == bytes32(0)) return false;
		
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint offset = blockNumber - baseBlockNumber;
		
		require(offset < size, "blockNumber larger than the largest stored number");
		
		uint localSize = localBlockNumber - baseBlockNumber;
		uint localOrder = findOrder(offset, localSize);
		
		if(localSize == size) return verifyOrdered(offset, blockHash, proof, _peaks[localOrder], localOrder);
		
		(bool isLocalPeaksVerified, bytes32 orderdPeak) = verifyLocalPeaks(localBlockNumber, localPeaks, localOrder);
		
		if(!isLocalPeaksVerified) return false;
		
		return verifyOrdered(offset, blockHash, proof, orderdPeak, localOrder);
	}
	
	function verifyOrdered(uint offset, bytes32 blockHash, bytes32[] memory proof, bytes32 peak, uint order) internal pure returns (bool) {
		if(order > proof.length) return false;
		
		for(uint i=0; i<order; ++i) {
			blockHash = offset&1>0 ? getHash(proof[i], blockHash) : getHash(blockHash, proof[i]);
			offset >>= 1;
		}
		
		return blockHash == peak;
	}
	function verifyLocalPeaks(uint localBlockNumber, bytes32[8] memory localPartialPeaks, uint localOrder) internal view returns (bool, bytes32) {
		require(localBlockNumber + 256 >= block.number, "localBlockNumber smaller than (current block.number-256), can't rebuild peaks.");
		
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint localSize = localBlockNumber - baseBlockNumber;
		require(localSize <= size, "localBlockNumber larger than stored blockNumber");
		
		bytes32[MAX_DEPTH] memory peaks;
		uint i;
		for(i=0; i<MAX_DEPTH; ++i) {
		    peaks[i] = _peaks[i];
		}

		bytes32[MAX_DEPTH] memory localPeaks;
		for(i=0;i<8;++i) {
			localPeaks[i] = localPartialPeaks[i];
		}
		for(;i<MAX_DEPTH;++i) {
			localPeaks[i] = peaks[i];
		}
		
		for(uint s=localSize;s<size;++s) {
			advanceOne(localPeaks, baseBlockNumber, s);
		}
		
		for(i=0;i<MAX_DEPTH;++i) {
			if(!isActive(i, size)) continue;
			if(localPeaks[i] != peaks[i]) return (false, bytes32(0));
		}

		return (true, localPeaks[localOrder]);
	}
}

contract MMRTaggedVerify is MMRVerify {
	function taggedVerify(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localPeaks) public view returns (bool isVerified, string memory tag) {
        require(tx.origin == msg.sender, "If you want call verify() from another contract, consider using verifyOnChain() instead.");
		
		return taggedVerifyInternal(blockNumber, blockHash, proof, localBlockNumber, localPeaks);
	}
	function taggedVerifyOnChain(uint blockNumber, bytes32 blockHash, bytes32[] calldata proof, uint localBlockNumber, bytes32[8] calldata localPeaks) external returns (bool isVerified, string memory tag) {
        _burn(msg.sender, VERIFY_COST);
		
		return taggedVerifyInternal(blockNumber, blockHash, proof, localBlockNumber, localPeaks);
	}
	function taggedVerifyInternal(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localPeaks) internal view returns (bool isVerified, string memory tag) {
		if(blockNumber + 256 >= block.number) return (blockHash == blockhash(blockNumber), "recent_256");
		
		if(blockHash == bytes32(0)) return (false, "hash_is_zero");
		
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint offset = blockNumber - baseBlockNumber;
		
		require(offset < size, "blockNumber larger than the largest stored number");
		
		uint localSize = localBlockNumber - baseBlockNumber;
		uint localOrder = findOrder(offset, localSize);
		
		if(localSize == size) return (verifyOrdered(offset, blockHash, proof, _peaks[localOrder], localOrder), "localBlockNumber_equals_storedBlockNumber");
		
		(bool isLocalPeaksVerified, bytes32 orderdPeak) = verifyLocalPeaks(localBlockNumber, localPeaks, localOrder);
		
		if(!isLocalPeaksVerified) return (false, "localPeaks_not_verified");
		
		return (verifyOrdered(offset, blockHash, proof, orderdPeak, localOrder), "localPeaks_is_verified");
	}
}

contract MMR is MMRTaggedVerify {
}
