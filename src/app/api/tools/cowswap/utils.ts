import * as fs from "fs";
import csv from "csv-parser";
import {
  Address,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseAbi,
  parseUnits,
} from "viem";
import { Network, setupAdapter } from "near-ca";
import { NextRequest } from "next/server";
import {
  OrderQuoteRequest,
  OrderQuoteSideKindSell,
} from "@cowprotocol/cow-sdk";
import { MetaTransaction } from "near-safe";

const MAX_APPROVAL = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935",
);
interface TokenInfo {
  address: Address;
  decimals: number;
}

type SymbolMapping = Record<string, TokenInfo>;
type BlockchainMapping = Record<number, SymbolMapping>;

const DuneNetworkMap: { [key: string]: number } = {
  ethereum: 1,
  gnosis: 100,
  arbitrum: 42161,
};

export async function loadTokenMapping(
  filePath: string,
): Promise<BlockchainMapping> {
  const mapping: BlockchainMapping = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const { blockchain, address, symbol, decimals } = row;
        const chainId = DuneNetworkMap[blockchain];
        // Ensure blockchain key exists in the mapping
        if (!mapping[chainId]) {
          mapping[chainId] = {};
        }

        // Map symbol to address and decimals
        mapping[chainId][symbol] = {
          address,
          decimals: parseInt(decimals, 10),
        };
      })
      .on("end", () => {
        console.log("CSV file successfully processed");
        resolve(mapping);
      })
      .on("error", (error: unknown) => {
        console.error("Error reading the CSV file:", error);
        reject(error);
      });
  });
}

// type DuneNetwork = "ethereum" | "gnosis" | "arbitrum";
let tokenMap: BlockchainMapping;

export async function getTokenDetails(
  chainId: number,
  symbolOrAddress: string,
): Promise<TokenInfo> {
  if (isAddress(symbolOrAddress)) {
    return {
      address: symbolOrAddress as Address,
      decimals: await getTokenDecimals(chainId, symbolOrAddress),
    };
  }
  console.log("Seeking TokenMap for Symbol -> Address conversion");
  // TODO. Load once and cache.
  // Token data comes from https://dune.com/queries/4055949
  //  curl -X GET https://api.dune.com/api/v1/query/4055949/results/csv -H "x-dune-api-key: $DUNE_API_KEY"  > tokens.csv
  if (!tokenMap) {
    // half-ass attempt to load to memory.
    tokenMap = await loadTokenMapping("./tokenlist.csv");
  }
  return tokenMap[chainId][symbolOrAddress];
}

// Function to request token decimals
async function getTokenDecimals(
  chainId: number,
  tokenAddress: string,
): Promise<number> {
  const client = Network.fromChainId(chainId).client;
  try {
    const decimals = await client.readContract({
      address: getAddress(tokenAddress),
      abi: erc20Abi,
      functionName: "decimals",
    });

    return decimals as number;
  } catch (error: unknown) {
    throw new Error(`Error fetching token decimals: ${error}`);
  }
}

export interface QuoteRequestBody {
  sellToken: Address;
  buyToken: Address;
  sellAmountBeforeFee: string;
  kind: "buy" | "sell";
  receiver: Address;
  from: Address;
  chainId: number;
}

export interface ParsedQuoteRequest {
  quoteRequest: OrderQuoteRequest;
  chainId: number;
}

export async function parseQuoteRequest(
  req: NextRequest,
): Promise<ParsedQuoteRequest> {
  // TODO - Add Type Guard on Request (to determine better if it needs processing below.)
  const requestBody = await req.json();

  const { sellToken, buyToken, chainId, sellAmountBeforeFee, from } =
    requestBody;

  const [buyTokenData, sellTokenData] = await Promise.all([
    getTokenDetails(chainId, buyToken),
    getTokenDetails(chainId, sellToken),
  ]);

  let sender: Address = from;
  if (!isAddress(from)) {
    console.log(`Transforming near address ${from} to EVM address`);
    const adapter = await setupAdapter({
      accountId: from,
      mpcContractId: "v1.signer",
    });
    sender = adapter.address;
  }

  return {
    chainId,
    quoteRequest: {
      sellToken: sellTokenData.address,
      buyToken: buyTokenData.address,
      sellAmountBeforeFee: parseUnits(
        sellAmountBeforeFee,
        sellTokenData.decimals,
      ).toString(),
      kind: OrderQuoteSideKindSell.SELL,
      // TODO - change this when we want to enable alternate recipients.
      receiver: sender,
      from: sender,
    },
  };
}

export async function sellTokenApprovalTx(args: {
  from: string;
  sellToken: string;
  chainId: number;
  sellAmount: string;
}): Promise<MetaTransaction | null> {
  const { from, sellToken, chainId, sellAmount } = args;
  const GPv2VaultRelayer = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";

  const allowance = await checkAllowance(
    getAddress(from),
    getAddress(sellToken),
    GPv2VaultRelayer,
    chainId,
  );

  let approvalTransaction = null;

  if (allowance < BigInt(sellAmount)) {
    console.log(
      `Insufficient allowance. Required: ${sellAmount}, Approved: ${allowance}`,
    );

    // Step 2: Build an approval transaction
    approvalTransaction = {
      to: sellToken,
      value: "0x0",
      data: encodeFunctionData({
        abi: parseAbi([
          "function approve(address spender, uint256 amount) external",
        ]),
        functionName: "approve",
        args: [GPv2VaultRelayer, MAX_APPROVAL],
      }),
    };
  }
  return approvalTransaction;
}

// Helper function to check token allowance
async function checkAllowance(
  owner: Address,
  token: Address,
  spender: Address,
  chainId: number,
): Promise<bigint> {
  return Network.fromChainId(chainId).client.readContract({
    address: token,
    abi: parseAbi([
      "function allowance(address owner, address spender) external view returns (uint256)",
    ]),
    functionName: "allowance",
    args: [owner, spender],
  });
}
