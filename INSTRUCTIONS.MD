# cartesi-example

Cartesi DApp example
This example is an effort to showcase how to use different components of Cartesi.
It will have following functionalities.

1. Data compression
2. Data decompression
3. Finding primes
4. Data Hashing
5. Minting-NFTs
6. Faucet

## Requirements

---

1. [docker-desktop](https://www.docker.com/products/docker-desktop/)
2. [sunodo](https://docs.sunodo.io/)
3. [forge](https://book.getfoundry.sh/reference/forge/forge-install)
4. [Qemu](https://github.com/multiarch/qemu-user-static)
5. yarn
6. npm
7. curl

## Initialize

---

`sunodo --help`

`sunodo create <app name> --template javascript | typescript | go`

## Build

---

`sunodo build`

## Run

`sunodo run `

run with complete logs

`sunodo run --verbose`

---

## Run in HostMode

change HTTP_ROLLUP_SERVER env var in package.json

`"start": "ROLLUP_HTTP_SERVER_URL=\"http://127.0.0.1:8080/host-runner\" node src/index.js"`

`sunodo run --no-backend`

open a second terminal

`yarn build && yarn start`

## Interacting with a frontend

`git clone https://github.com/prototyp3-dev/frontend-web-cartesi`
`cd frontend-web-cartesi`
`yarn && yarn codegen && yarn start`

## Building a Dapp with full functionality

### Boilerplate code

```typescript
// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));
  return "accept";
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: finish["status"] }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
```

### Add imports

```typescript
const { ethers, keccak256, toUtf8Bytes } = require("ethers");
const { gzip, ungzip } = require("node-gzip"); //compression/decompression
var { v4: uuidv4 } = require("uuid"); //generating unique ids
var viem = require("viem");
```

### Declaring Variables

```typescript
const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL; //address of the rollup-server
var erc20abi = require("./contract"); //abi of erc20 smart contract on L1
var erc721abi = require("./erc721.json"); //abi of erc721 smart contract on L1
const erc20_contract_address = viem.getAddress(
  "0x2797a6a6D9D94633BA700b52Ad99337DdaFA3f52"
);
const erc721_contract_address = viem.getAddress(
  "0x68E3Ee84Bcb7543268D361Bb92D3bBB17e90b838"
);
const DAPP_ADDRESS_REALY = "0xF5DE34d6BbC0446E2a45719E718efEbaaE179daE"; //L1 contract which relays the deployed DApp smart contract address
let DAPP_ADDRESS = "null";
let compressedData = new Map();
```

### Helper functions for compression

```typescript
const toBinString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(2).padStart(8, "0"), "");
```

### Handle Advance function template

```typescript
async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));
  const payload = data.payload;
  let JSONpayload = {};
  //Check if json input and parse
  try {
    //Setting DApp address
    if (
      String(data.metadata.msg_sender).toLowerCase() ===
      DAPP_ADDRESS_REALY.toLowerCase()
    ) {
      console.log("setting Dapp address:", payload);
      DAPP_ADDRESS = payload;
    }

    const payloadStr = viem.hexToString(payload);
    JSONpayload = JSON.parse(payloadStr);
    console.log(`received request ${JSON.stringify(JSONpayload)}`);
  } catch (e) {
    //Not a json input
    console.log(`Adding notice with binary value "${payload}"`);
    await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: payload }),
    });
    return "reject";
  }

  let advance_req;

  //Application Code
  try {
    // main code goes here
  } catch (e) {
    console.log("error is:", e);
    await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: viem.stringToHex(JSON.stringify({ error: e })),
      }),
    });
    return "reject";
  }
  const json = await advance_req.json();
  console.log(
    "Received  status " +
      advance_req.status +
      " with body " +
      JSON.stringify(json)
  );
  return "accept";
}
```
