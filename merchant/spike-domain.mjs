import { createPublicClient, http, keccak256, encodeAbiParameters, toBytes } from "viem";

const RPC = "https://rpc.testnet.whitechain.io";
const USDT = "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7";

const client = createPublicClient({ transport: http(RPC) });

const abi = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "DOMAIN_SEPARATOR", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
];

const [name, symbol, decimals, onchainSep] = await Promise.all([
  client.readContract({ address: USDT, abi, functionName: "name" }),
  client.readContract({ address: USDT, abi, functionName: "symbol" }),
  client.readContract({ address: USDT, abi, functionName: "decimals" }),
  client.readContract({ address: USDT, abi, functionName: "DOMAIN_SEPARATOR" }),
]);

console.log("name:", name, "| symbol:", symbol, "| decimals:", decimals);
console.log("onchain DOMAIN_SEPARATOR:", onchainSep);

const TYPE_HASH = keccak256(toBytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));

function domainSeparator(nameStr, version) {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }, { type: "address" }],
      [TYPE_HASH, keccak256(toBytes(nameStr)), keccak256(toBytes(version)), 1874n, USDT]
    )
  );
}

for (const v of ["1", "2"]) {
  const sep = domainSeparator(name, v);
  console.log(`computed (version=${v}):`, sep, sep === onchainSep ? "<== MATCH" : "");
}

const code = await client.getCode({ address: USDT });
console.log("proxy bytecode length:", code ? code.length : 0, "| EIP-1967 impl slot probe follows");
const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const raw = await client.request({ method: "eth_getStorageAt", params: [USDT, implSlot, "latest"] });
console.log("EIP-1967 implementation slot:", raw);
