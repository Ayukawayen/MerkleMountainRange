'use strict';

const ContractMetadata = {
	networkVersion: 3,
	networkName: 'Ropsten',
	
	contracts:{
		mmr:{
			addr: '0xc2a290768fdd2f6afe727b39a558aed19b80028b',
			abi: [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"stateMutability":"nonpayable","type":"fallback"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"_peaks","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getBaseBlockNumber","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPeaks","outputs":[{"internalType":"bytes32[40]","name":"result","type":"bytes32[40]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getSize","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"mint","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tokenPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes32","name":"blockHash","type":"bytes32"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"},{"internalType":"uint256","name":"localBlockNumber","type":"uint256"},{"internalType":"bytes32[8]","name":"localPeaks","type":"bytes32[8]"}],"name":"verify","outputs":[{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"string","name":"tag","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes32","name":"blockHash","type":"bytes32"},{"internalType":"bytes32[]","name":"proof","type":"bytes32[]"},{"internalType":"uint256","name":"localBlockNumber","type":"uint256"},{"internalType":"bytes32[8]","name":"localPeaks","type":"bytes32[8]"}],"name":"verifyOnChain","outputs":[{"internalType":"bool","name":"isVerified","type":"bool"},{"internalType":"string","name":"tag","type":"string"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}],
		},
		bhl:{
			addr: '0x9d27eb6989406becda60b5ccc118bae24e5275d6',
			abi: [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"startBlockNumber","type":"uint256"},{"indexed":false,"internalType":"bytes32[]","name":"blockHashes","type":"bytes32[]"}],"name":"Blockhash","type":"event"},{"stateMutability":"nonpayable","type":"fallback"}],
		},
	},
};

var contracts = {};

async function enableEth() {
	window.web3 = new Web3(new Web3.providers.HttpProvider('https://nodes.mewapi.io/rpc/rop'));
	
	if(!window.ethereum) {
		window.web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/bf949720e1b14912bd2241b0592cfc2b'));
		contract = web3.eth.contract(ContractMetadata.abi).at(ContractMetadata.addr);
		return {};
	}
	
	ethereum.autoRefreshOnNetworkChange = false;
	try {
		await ethereum.enable();
	} catch (error) {
		return {error:error.message};
	}
	
	let networkVersion = await ethereum.request({ method: 'net_version' });
	if(networkVersion != ContractMetadata.networkVersion) {
		return {error:`Network error. Should be ${ContractMetadata.networkName}(${ContractMetadata.networkVersion}) test-net. You are using (${networkVersion})`};
	}
	
	window.web3 = new Web3(ethereum);
	
	for(let k in ContractMetadata.contracts) {
		contracts[k] = web3.eth.contract(ContractMetadata.contracts[k].abi).at(ContractMetadata.contracts[k].addr);
	}
	
	return {};
}

async function callAsync(inner, args) {
	args = args || [];
	
	return new Promise((resolve, reject) => {
		args.push((error, response) => {
			if(error) {
				reject(error);
				return;
			}
			resolve(response);
		});
		
		inner.apply(null, args);
	});
}
