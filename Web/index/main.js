'use strict';

window.addEventListener('load', onLoaded);

let nodeInputBlockNumber = document.querySelector('#blockNumber >input');

let baseBlockNumber;
let size;
let roots;

async function onLoaded() {
	let response = await enableEth();
	if(response.error) {
		alert(response.error);
		return;
	}
	
	baseBlockNumber = web3.toDecimal(await callAsync(contract.getBaseBlockNumber.call));
	size = web3.toDecimal(await callAsync(contract.getSize.call));
	
	nodeInputBlockNumber.min = baseBlockNumber;
	nodeInputBlockNumber.max = baseBlockNumber+size-1;
	
	document.querySelector('#localBlockNumber1 >input').value = baseBlockNumber+size;
	
	roots = await callAsync(contract.getRoots.call);
	document.querySelector('#localRoots1 >textarea').value = JSON.stringify(roots.slice(0,8));
	
	refreshStateText();
	
	
	nodeInputBlockNumber.addEventListener('change', onBlockNumberChange);
	nodeInputBlockNumber.value = nodeInputBlockNumber.max;

	
	document.querySelector('#genarate1').addEventListener('click', onGenerate1Click);
	document.querySelector('#verify1').addEventListener('click', onVerify1Click);
}

function refreshStateText() {
	let text = `baseBlockNumber: ${baseBlockNumber}; size: ${size}\r\n`;
	let n = baseBlockNumber + size;
	
	for(let i=0;i<32;++i) {
		if(roots[i] == 0) continue;
		
		n -= 1<<i;
		
		text += `roots[${i}]${i>9?'':' '}, hash of Block[${n}-${n+(1<<i)-1}]: ${roots[i]}\r\n`;
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
	
	contract.generateProofInfo.call(blockNumber, async (err, response)=>{
		let length = response[0].length;
		let totalBlockHash = 1<<length;
		let countBlockHash = 1;
		let proof = [];
		for(let i=0; i<length; ++i) {
			proof[i] = await generateRoot(web3.toDecimal(response[0][i][0]), i);
			countBlockHash += 1<<i;
			document.querySelector('#proof1 >textarea').value = `Loading... (${countBlockHash}/${totalBlockHash})`;
		}
		document.querySelector('#proof1 >textarea').value = JSON.stringify(proof);
	});
}

let blockhashes = {};

async function generateRoot(blockNumber, height) {
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
		response = await callAsync(contract.verify.call, [
			document.querySelector(`#blockNumber >input`).value,
			document.querySelector(`#blockHash${num} >input`).value,
			JSON.parse(document.querySelector(`#proof${num} >textarea`).value),
			document.querySelector(`#localBlockNumber${num} >input`).value,
			JSON.parse(document.querySelector(`#localRoots${num} >textarea`).value),
		]);
	} catch (error) {
		response = error.message;
	}
	
	document.querySelector(`#verifyResult${num}`).textContent = response;
}
