// XXX even though ethers is not used in the code below, it's very likely
// it will be used by any DApp, so we are already including it here
const { ethers, uuidV4, keccak256, toUtf8Bytes } = require("ethers");
var compressjs = require("compressjs");
var algorithm = compressjs.Huffman;
var { v4: uuidv4 } = require("uuid");
var viem = require("viem");
const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);
let compressedData = new Map();
var erc20abi = require("./erc20.json");
const erc20_contract_address = viem.getAddress(
  "0xd9145CCE52D386f254917e481eB44e9943F39138"
);
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
      var databuf = new Buffer(JSONpayload.data, "utf-8");
      var compressed = algorithm.compressFile(databuf);
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
      var datbuf = algorithm.decompressFile(dataArr);
      var originalDat = new Buffer(datbuf).toString("utf-8");
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

      //{"method":"decompress","id":"5447416f-98ab-4c3f-944b-f66ea3d3c261"}
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

      //{"method":"prime","lower":"150000","higher":"445645646546556"}
    } else if (JSONpayload.method === "faucet") {
      console.log("abi is", erc20abi);
      const call = viem.encodeFunctionData({
        abi: erc20abi,
        functionName: "transfer",
        args: [JSONpayload.value],
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
    } else {
      console.log("method undefined");
      const result = JSON.stringify({
        error: String("method undefined:" + JSONpayload.methos),
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
