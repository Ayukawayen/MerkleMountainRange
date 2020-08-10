'use strict';

window.addEventListener('load', onLoaded);

let nodeInputBlockNumber = document.querySelector('#blockNumber >input');

let baseBlockNumber;
let size;
let peaks;
let blockhashes = {};

async function onLoaded() {
	let response = await enableEth();
	if(response.error) {
		alert(response.error);
		return;
	}
	
	loadLoggedBlockhashes();
	
	baseBlockNumber = web3.toDecimal(await callAsync(contracts.mmr.getBaseBlockNumber.call));
	size = web3.toDecimal(await callAsync(contracts.mmr.getSize.call));
	
	nodeInputBlockNumber.min = baseBlockNumber;
	nodeInputBlockNumber.max = baseBlockNumber+size-1;
	
	document.querySelector('#localBlockNumber1 >input').value = baseBlockNumber+size;
	
	peaks = await callAsync(contracts.mmr.getPeaks.call);
	document.querySelector('#localPeaks1 >textarea').value = JSON.stringify(peaks.slice(0,8));
	
	refreshStateText();
	
	
	nodeInputBlockNumber.addEventListener('change', onBlockNumberChange);
	nodeInputBlockNumber.value = nodeInputBlockNumber.max;

	
	document.querySelector('#genarate1').addEventListener('click', onGenerate1Click);
	document.querySelector('#verify1').addEventListener('click', onVerify1Click);
}

async function loadLoggedBlockhashes(contract) {
	return new Promise((resolve, reject) => {
		contracts.bhl.Blockhash({}, {fromBlock:ContractMetadata.contracts.bhl.created, toBlock:'latest', }).get(function(error, response) {
			if(error) {
				reject(error);
				return;
			}
			
			response.forEach((item)=>{
				let startBlockNumber = web3.toDecimal(item.args.startBlockNumber);
				
				item.args.blockHashes.forEach((hash,i)=>{
					blockhashes[startBlockNumber+i] = hash;
				});
			});
			
			resolve();
		});
	});
}

function refreshStateText() {
	let text = `baseBlockNumber: ${baseBlockNumber}; size: ${size}\r\n`;
	let n = baseBlockNumber + size;
	
	for(let i=0;i<32;++i) {
		if(peaks[i] == 0) continue;
		
		n -= 1<<i;
		
		text += `peaks[${i}]${i>9?'':' '}, hash of Block[${n}-${n+(1<<i)-1}]: ${peaks[i]}\r\n`;
	}
	document.querySelector('#state >pre').textContent = text;
}

async function onBlockNumberChange(ev) {
}

async function onGenerate1Click(ev) {
	document.querySelector('#blockHash1 >input').value = 'Loading...';
	document.querySelector('#proof1 >textarea').value = 'Loading...';
	
	let blockNumber = nodeInputBlockNumber.value;
	
	web3.eth.getBlock(blockNumber, (err, response)=>{
		document.querySelector('#blockHash1 >input').value = response.hash;
	});
	
	let startBlockNumbers = generateProofStartBlockNumbers(blockNumber, size);
	let length = startBlockNumbers.length;
	let totalBlockHash = 1<<length;
	let countBlockHash = 1;
	let proof = [];
	for(let i=0; i<length; ++i) {
		proof[i] = await generatePeak(startBlockNumbers[i], i);
		countBlockHash += 1<<i;
		document.querySelector('#proof1 >textarea').value = `Loading... (${countBlockHash}/${totalBlockHash})`;
	}
	document.querySelector('#proof1 >textarea').value = JSON.stringify(proof);
}

function generateProofStartBlockNumbers(blockNumber, localSize) {
	let offset = blockNumber - baseBlockNumber;
	let order;
	for(order=30; order>0; --order) {
		if((localSize & (1<<order))>0 && (offset & (1<<order))<=0 ) break;
	}

	let startBlockNumber = baseBlockNumber + ( localSize>>(order+1)<<(order+1) );
	offset = blockNumber - startBlockNumber;
	
	let result = [];
	
	for(let i=0; i<order; ++i) {
		result[i] = startBlockNumber + (((offset>>i)^1)<<i);
	}
	
	return result;
}

async function generatePeak(blockNumber, height) {
	let size = 1<<height;
	let values = [];
	
	for(let i=0;i<size;i+=2) {
		if(blockhashes[blockNumber+i] && blockhashes[blockNumber+i+1]) {
			values[i] = blockhashes[blockNumber+i];
			values[i+1] = blockhashes[blockNumber+i+1];
			continue;
		}
		
		let block = await callAsync(web3.eth.getBlock, [blockNumber+i+1]);
		blockhashes[blockNumber+i] = values[i] = block.parentHash;
		blockhashes[blockNumber+i+1] = values[i+1] = block.hash;
	}
	
	for(let h=0;h<height;++h) {
		size >>= 1;
		for(let i=0;i<size;++i) {
			values[i] = getHash(values[i*2], values[i*2+1]);
		}
	}
	
	return values[0];
}
function getHash(hexa, hexb) {
	return web3.sha3(hexa + hexb.substr(2), {encoding:'hex'});
}

async function onVerify1Click(ev) {
	await onVerifyClick(1);
}
async function onVerify2Click(ev) {
	await onVerifyClick(2);
}

async function onVerifyClick(num) {
	document.querySelector(`#verifyResult${num}`).textContent = '...';
	
	let response;
	try {
		response = await callAsync(contracts.mmr.verify.call, [
			document.querySelector(`#blockNumber >input`).value,
			document.querySelector(`#blockHash${num} >input`).value,
			JSON.parse(document.querySelector(`#proof${num} >textarea`).value),
			document.querySelector(`#localBlockNumber${num} >input`).value,
			JSON.parse(document.querySelector(`#localPeaks${num} >textarea`).value),
		]);
	} catch (error) {
		response = error.message;
	}
	document.querySelector(`#verifyResult${num}`).textContent = response[0];
}
