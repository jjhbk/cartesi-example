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

set epoch_duration of Cartesi

`sunodo run --verbose --epoch-duration=100`

---

## Run in HostMode

change HTTP_ROLLUP_SERVER env var in package.json

`"start": "ROLLUP_HTTP_SERVER_URL=\"http://127.0.0.1:8080/host-runner\" node src/index.js"`

`sunodo run --no-backend`

open a second terminal

`yarn build && yarn start`

---

## Interacting with a frontend

`git clone https://github.com/prototyp3-dev/frontend-web-cartesi`
`cd frontend-web-cartesi`
`yarn && yarn codegen && yarn start`

---

## Building a Dapp with full functionality

---

### Boilerplate code

```javascript
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

---

### Add imports

```javascript
const { ethers, keccak256, toUtf8Bytes } = require("ethers");
const { gzip, ungzip } = require("node-gzip"); //compression/decompression
var { v4: uuidv4 } = require("uuid"); //generating unique ids
var viem = require("viem");
```

---

### Declaring Variables

```javascript
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

---

### Helper functions for compression

```javascript
const toBinString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(2).padStart(8, "0"), "");
```

---

### Handle Advance function template

```javascript
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

---

### Compress

```javascript
if (JSONpayload.method === "compress") {
  //compress function
  console.log("compressing....");
  let id = uuidv4();
  var compressed = await gzip(JSONpayload.data);
  compressedData.set(id, compressed);
  console.log("Compressed data is", id, compressed);

  console.log("binary data is:", toBinString(compressed));
  const result = JSON.stringify({ id: id, data: compressed });
  const hexresult = viem.stringToHex(result);
  advance_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: hexresult }),
  });
} else {
  console.log("method undefined");
  const result = JSON.stringify({
    error: String("method undefined:" + JSONpayload.method),
  });
  const hexresult = viem.stringToHex(result);
  await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      payload: hexresult,
    }),
  });
}
//{"method":"compress","data":"This is a Cartesi workshop with BIH"}
```

---

### Decompress

```javascript
else if (JSONpayload.method === "decompress") {
      console.log("decompressing....");
      const dataArr = compressedData.get(JSONpayload.id);
      var datbuf = await ungzip(dataArr);
      var originalDat = datbuf.toString();
      console.log("the original data is:", originalDat);
      const result = JSON.stringify({ originaldata: originalDat });
      const hexresult = viem.stringToHex(result);
      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });

      //{"method":"decompress","id":"000c7899-96bb-498b-8820-691d5e04ba33"}
    }
```

---

### Hash

```javascript
else if (JSONpayload.method === "hash") {
      console.log("hashing....");
      const hash = keccak256(toUtf8Bytes(JSONpayload.data));
      console.log("hash is:", hash);

      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hash }),
      });

      //{"method":"hash","data":"5447416f-98ab-4c3f-944b-f66ea3d3c261"}
    }
```

---

### Primes Helper function

```javascript
const getPrimes = (lower, higher) => {
  let primes = [];
  console.log(lower, higher);

  for (let i = lower; i <= higher; i++) {
    var flag = 0;
    // looping through 2 to ith for the primality test
    for (let j = 2; j < i; j++) {
      if (i % j == 0) {
        flag = 1;
        break;
      }
    }
    if (flag == 0 && i != 1) {
      console.log(i);
      primes.push(i);
    }
  }
  return primes;
};
```

---

### Find Primes

```javascript
else if (JSONpayload.method === "prime") {
      console.log("getting the prime numbers");
      const primes = getPrimes(
        parseInt(JSONpayload.lower),
        parseInt(JSONpayload.higher)
      );
      const result = JSON.stringify({ primes: primes });
      const hexresult = viem.stringToHex(result);
      console.log("primes are:", primes);
      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });

      //{"method":"prime","lower":"1500","higher":"1600"}
    }
```

---

### Mint ERC-721

#### deploy smart-contracts

`cd ../common-contracts`

`yarn && yarn build && yarn deploy`

code

```javascript
else if (JSONpayload.method === "mint") {
      console.log("minting erc721 token.....");

      // console.log("abi is", erc20abi);
      const call = viem.encodeFunctionData({
        abi: erc721abi,
        functionName: "mintTo",
        args: [data.metadata.msg_sender],
      });
      let voucher = {
        destination: erc721_contract_address, // dapp Address
        payload: call,
      };
      console.log(voucher);
      advance_req = await fetch(rollup_server + "/voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voucher),
      });
      console.log("starting a voucher");
      //{"method":"mint"}
    }
```

---

### Faucet

```javascript
else if (JSONpayload.method === "faucet") {
      console.log("sending erc20 tokens.....");
      if (DAPP_ADDRESS === "null") {
        console.log("Dapp address is not set");
        return "reject";
      }
      // console.log("abi is", erc20abi);
      const call = viem.encodeFunctionData({
        abi: erc20abi,
        functionName: "transfer",
        args: [data.metadata.msg_sender, BigInt(JSONpayload.value)],
      });
      let voucher = {
        destination: erc20_contract_address, // dapp Address
        payload: call,
      };
      console.log(voucher);
      advance_req = await fetch(rollup_server + "/voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voucher),
      });
      console.log("starting a voucher");
      //{"method":"faucet","value":"150000"}
    }
```

### Handle Inspect function

```javascript
async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  const payload = data.payload;
  let inspect_req;
  try {
    const payloadStr = viem.hexToString(data.payload);
    console.log("received inspect request with payload", payloadStr);
    const payloadArr = payloadStr.split("/");
    console.log(payloadArr);

    const result = JSON.stringify({
      value: toBinString(compressedData.get(payloadArr[1])),
    });
    const hexresult = viem.stringToHex(result);
    if (payloadArr[0] === "storage") {
      console.log(
        "fetching the stored value result",
        compressedData.get(payloadArr[1])
      );
      inspect_req = await fetch(rollup_server + "/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });
      console.log("Adding report with" + inspect_req.status);
      return "accept";
    }
  } catch (e) {
    console.log(`Adding report with binary value "${payload}",${e}`);
  }
  inspect_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });
  console.log("Adding report with" + inspect_req.status);
  return "accept";
}
```

---

### Inputs for different interactions

```
{"method":"compress","data":"This is a Cartesi workshop with BIH"}

{"method":"decompress","id":"000c7899-96bb-498b-8820-691d5e04ba33"}

{"method":"hash","data":"5447416f-98ab-4c3f-944b-f66ea3d3c261"}

{"method":"prime","lower":"1500","higher":"1600"}

{"method":"mint"}

{"method":"faucet","value":"150000"}
```

---

---

## Complete code

```javascript
// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
//@ts-nocheck
const { ethers, keccak256, toUtf8Bytes } = require("ethers");

const { gzip, ungzip } = require("node-gzip");
var { v4: uuidv4 } = require("uuid");
var viem = require("viem");
const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

var erc20abi = require("./contract");
var erc721abi = require("./erc721.json");
const erc20_contract_address = viem.getAddress(
  "0x2797a6a6D9D94633BA700b52Ad99337DdaFA3f52"
);
const erc721_contract_address = viem.getAddress(
  "0x68E3Ee84Bcb7543268D361Bb92D3bBB17e90b838"
);
const DAPP_ADDRESS_REALY = "0xF5DE34d6BbC0446E2a45719E718efEbaaE179daE";
let DAPP_ADDRESS = "null";
let compressedData = new Map();
const toBinString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(2).padStart(8, "0"), "");

const getPrimes = (lower, higher) => {
  let primes = [];
  console.log(lower, higher);

  for (let i = lower; i <= higher; i++) {
    var flag = 0;
    // looping through 2 to ith for the primality test
    for (let j = 2; j < i; j++) {
      if (i % j == 0) {
        flag = 1;
        break;
      }
    }
    if (flag == 0 && i != 1) {
      console.log(i);
      primes.push(i);
    }
  }
  return primes;
};

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));
  const payload = data.payload;
  let JSONpayload = {};
  try {
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
  try {
    if (JSONpayload.method === "compress") {
      console.log("compressing....");
      let id = uuidv4();
      var compressed = await gzip(JSONpayload.data);
      compressedData.set(id, compressed);
      console.log("Compressed data is", id, compressed);

      console.log("binary data is:", toBinString(compressed));
      const result = JSON.stringify({ id: id, data: compressed });
      const hexresult = viem.stringToHex(result);
      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });

      //{"method":"compress","data":"My name is jathin jagannath goud"}
    } else if (JSONpayload.method === "decompress") {
      console.log("decompressing....");
      const dataArr = compressedData.get(JSONpayload.id);
      var datbuf = await ungzip(dataArr);
      var originalDat = datbuf.toString();
      console.log("the original data is:", originalDat);
      const result = JSON.stringify({ originaldata: originalDat });
      const hexresult = viem.stringToHex(result);
      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });

      //{"method":"decompress","id":"000c7899-96bb-498b-8820-691d5e04ba33"}
    } else if (JSONpayload.method === "hash") {
      console.log("hashing....");
      const hash = keccak256(toUtf8Bytes(JSONpayload.data));
      console.log("hash is:", hash);

      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hash }),
      });

      //{"method":"hash","data":"5447416f-98ab-4c3f-944b-f66ea3d3c261"}
    } else if (JSONpayload.method === "prime") {
      console.log("getting the prime numbers");
      const primes = getPrimes(
        parseInt(JSONpayload.lower),
        parseInt(JSONpayload.higher)
      );
      const result = JSON.stringify({ primes: primes });
      const hexresult = viem.stringToHex(result);
      console.log("primes are:", primes);
      advance_req = await fetch(rollup_server + "/notice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });

      //{"method":"prime","lower":"1500","higher":"1600"}
    } else if (JSONpayload.method === "mint") {
      console.log("minting erc721 token.....");

      // console.log("abi is", erc20abi);
      const call = viem.encodeFunctionData({
        abi: erc721abi,
        functionName: "mintTo",
        args: [data.metadata.msg_sender],
      });
      let voucher = {
        destination: erc721_contract_address, // dapp Address
        payload: call,
      };
      console.log(voucher);
      advance_req = await fetch(rollup_server + "/voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voucher),
      });
      console.log("starting a voucher");
      //{"method":"mint"}
    } else if (JSONpayload.method === "faucet") {
      console.log("sending erc20 tokens.....");
      if (DAPP_ADDRESS === "null") {
        console.log("Dapp address is not set");
        return "reject";
      }
      // console.log("abi is", erc20abi);
      const call = viem.encodeFunctionData({
        abi: erc20abi,
        functionName: "transfer",
        args: [data.metadata.msg_sender, BigInt(JSONpayload.value)],
      });
      let voucher = {
        destination: erc20_contract_address, // dapp Address
        payload: call,
      };
      console.log(voucher);
      advance_req = await fetch(rollup_server + "/voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voucher),
      });
      console.log("starting a voucher");
      //{"method":"faucet","value":"150000"}
    } else {
      console.log("method undefined");
      const result = JSON.stringify({
        error: String("method undefined:" + JSONpayload.method),
      });
      const hexresult = viem.stringToHex(result);
      await fetch(rollup_server + "/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          payload: hexresult,
        }),
      });
    }
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

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  const payload = data.payload;
  let inspect_req;
  try {
    const payloadStr = viem.hexToString(data.payload);
    console.log("received inspect request with payload", payloadStr);
    const payloadArr = payloadStr.split("/");
    console.log(payloadArr);

    const result = JSON.stringify({
      value: toBinString(compressedData.get(payloadArr[1])),
    });
    const hexresult = viem.stringToHex(result);
    if (payloadArr[0] === "storage") {
      console.log(
        "fetching the stored value result",
        compressedData.get(payloadArr[1])
      );
      inspect_req = await fetch(rollup_server + "/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload: hexresult }),
      });
      console.log("Adding report with" + inspect_req.status);
      return "accept";
    }
  } catch (e) {
    console.log(`Adding report with binary value "${payload}",${e}`);
  }
  inspect_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload }),
  });
  console.log("Adding report with" + inspect_req.status);
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
