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

contract MMRCore is MMRToken {
	/*
	function blockhash(uint blockNumber) internal view returns (bytes32) {
		return bytes32(blockNumber);
	}
	*/
	
	uint internal constant MAX_DEPTH = 40;
	uint internal constant VERIFY_COST = 6000;
	
	uint _packedData;
	bytes32[MAX_DEPTH] public _roots;
	
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
	function getRoots() public view returns (bytes32[MAX_DEPTH] memory result) {
		uint64 size = getSize();
		for(uint i=0;i<MAX_DEPTH;++i) {
			result[i] = isActive(i, size) ? _roots[i] : bytes32(0);
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
	function findOrder(uint offset, uint size) internal pure returns (uint order) {
		order = MAX_DEPTH;
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
		bytes32[MAX_DEPTH] memory roots;
		bytes32[MAX_DEPTH] memory originRoots;
		for(i=0; i<MAX_DEPTH; ++i) {
		    originRoots[i] = roots[i] = _roots[i];
		}
		
		for(i=0;i<l;++i) {
			advanceOne(roots, baseBlockNumber, size+i);
		}
		
		for(i=0; i<MAX_DEPTH; ++i) {
			if(roots[i] != originRoots[i]) {
				_roots[i] = roots[i];
			}
		}
		
		price = getAvgGasPrice(price, l);
		
		packData(price, baseBlockNumber, uint64(size+l));
		
		_mint(msg.sender, gas - gasleft());
	}
	
	function advanceOne(bytes32[MAX_DEPTH] memory roots, uint baseBlockNumber, uint size) internal view {
		bytes32 hash = blockhash(baseBlockNumber + size);

        uint i;
		for(i=0; i<MAX_DEPTH; ++i) {
			if(!isActive(i, size)) break;
			hash = getHash(roots[i], hash);
		}
		
		roots[i] = hash;
	}

	function verify(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localRoots) public view returns (bool) {
        require(tx.origin == msg.sender, "If you want call verify() from another contract, consider using verifyOnChain() instead.");
		
		return verifyInternal(blockNumber, blockHash, proof, localBlockNumber, localRoots);
	}
	function verifyOnChain(uint blockNumber, bytes32 blockHash, bytes32[] calldata proof, uint localBlockNumber, bytes32[8] calldata localRoots) external returns (bool) {
        _burn(msg.sender, VERIFY_COST);
		
		return verifyInternal(blockNumber, blockHash, proof, localBlockNumber, localRoots);
	}
	function verifyInternal(uint blockNumber, bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localRoots) internal view returns (bool) {
		if(blockNumber + 256 >= block.number) return blockHash == blockhash(blockNumber);
		
		if(blockHash == bytes32(0)) return false;
		
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint offset = blockNumber - baseBlockNumber;
		
		require(offset < size);
		
		uint order = findOrder(offset, size);
		uint localOrder = findOrder(offset, localBlockNumber - baseBlockNumber);
		
		if(order == localOrder) return verifyOrdered(offset, blockHash, proof, _roots[order], order);
		
		if(localOrder>=8) return verifyOrdered(offset, blockHash, proof, _roots[localOrder], localOrder);
		
		if(!verifyLocalRoots(localBlockNumber, localRoots)) return false;
		
		return verifyOrdered(offset, blockHash, proof, localRoots[localOrder], localOrder);
	}
	
	function verifyOrdered(uint offset, bytes32 blockHash, bytes32[] memory proof, bytes32 root, uint order) internal pure returns (bool) {
		if(order > proof.length) return false;
		
		for(uint i=0; i<order; ++i) {
			blockHash = offset&1>0 ? getHash(proof[i], blockHash) : getHash(blockHash, proof[i]);
			offset >>= 1;
		}
		
		return blockHash == root;
	}
	function verifyLocalRoots(uint localBlockNumber, bytes32[8] memory localPartialRoots) internal view returns (bool) {
		require(localBlockNumber + 256 >= block.number);
		
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		uint localSize = localBlockNumber - baseBlockNumber;
		require(localSize <= size);
		
		bytes32[MAX_DEPTH] memory roots;
		uint i;
		for(i=0; i<MAX_DEPTH; ++i) {
		    roots[i] = _roots[i];
		}

		bytes32[MAX_DEPTH] memory localRoots;
		for(i=0;i<8;++i) {
			localRoots[i] = localPartialRoots[i];
		}
		for(;i<MAX_DEPTH;++i) {
			localRoots[i] = isActive(i, localSize) ? roots[i] : bytes32(0);
		}
		
		uint l = size - localSize;
		for(i=0;i<l;++i) {
			advanceOne(localRoots, baseBlockNumber, localSize+i);
		}
		
		for(i=0;i<MAX_DEPTH;++i) {
			if(!isActive(i, size)) {
				roots[i] = bytes32(0);
			}
			if(localRoots[i] != roots[i]) return false;
		}

		return true;
	}
}

contract MMRProver is MMRCore {
	function generateProofMetadata(uint blockNumber) internal view returns (uint order, uint startBlockNumber, uint[] memory proofStartBlockNumbers, uint localBlockNumber, bytes32[8] memory localRoots) {
		(, uint64 baseBlockNumber, uint64 size) = unpackData();
		
		require(blockNumber >= baseBlockNumber);
		
		localBlockNumber = baseBlockNumber + size;
		
		require(blockNumber < localBlockNumber);
		
		uint offset = blockNumber - baseBlockNumber;
		
		order = findOrder(offset, size);
		
		startBlockNumber = baseBlockNumber + ( size>>(order+1)<<(order+1) );
		offset = blockNumber - startBlockNumber;
		
		proofStartBlockNumbers = new uint[](order);
		
		for(uint i=0; i<order; ++i) {
			proofStartBlockNumbers[i] = startBlockNumber + (((offset>>i)^1)<<i);
		}
		
		for(uint i=0;i<8;++i) {
			if(!isActive(i, size)) continue;
			localRoots[i] = _roots[i];
		}
	}
	
	function generateProof(uint blockNumber) public view returns (bytes32 blockHash, bytes32[] memory proof, uint localBlockNumber, bytes32[8] memory localRoots) {
		(uint order, uint startBlockNumber, uint[] memory proofStartBlockNumbers, uint t_localBlockNumber, bytes32[8] memory t_localRoots) = generateProofMetadata(blockNumber);
		localBlockNumber = t_localBlockNumber;
		localRoots = t_localRoots;
		
		require(startBlockNumber + 256 >= block.number);
		
		blockHash = blockhash(blockNumber);
		
		proof = new bytes32[](order);
		
		for(uint i=0; i<order; ++i) {
			proof[i] = generateRootHash(proofStartBlockNumbers[i], i);
		}
	}
	function generateRootHash(uint blockNumber, uint height) internal view returns (bytes32) {
		uint size = 1<<height;
		bytes32[] memory values = new bytes32[](size);
		
		for(uint i=0;i<size;++i) {
			values[i] = blockhash(blockNumber+i);
		}
		
		for(uint h=0;h<height;++h) {
			size >>= 1;
			for(uint i=0;i<size;++i) {
				values[i] = getHash(values[i*2], values[i*2+1]);
			}
		}
		
		return values[0];
	}
	
	function generateProofInfo(uint blockNumber) public view returns (uint[2][] memory proofBlockNumbers, uint localBlockNumber, bytes32[8] memory localRoots) {
		(uint order, , uint[] memory proofStartBlockNumbers, uint t_localBlockNumber, bytes32[8] memory t_localRoots) = generateProofMetadata(blockNumber);
		localBlockNumber = t_localBlockNumber;
		localRoots = t_localRoots;
		
		proofBlockNumbers = new uint[2][](order);
		
		for(uint i=0; i<order; ++i) {
			proofBlockNumbers[i][0] = proofStartBlockNumbers[i];
			proofBlockNumbers[i][1] = proofStartBlockNumbers[i] + (1<<i) - 1;
		}
	}
}

contract MMR is MMRProver {
}
