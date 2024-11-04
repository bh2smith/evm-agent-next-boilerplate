import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";
import { Address, erc20Abi, getAddress, isAddress } from "viem";
import { getClient } from "near-safe";

interface TokenInfo {
  address: Address;
  decimals: number;
}

type SymbolMapping = Record<string, TokenInfo>;
type ChainId = number;
type BlockchainMapping = Record<ChainId, SymbolMapping>;

const DuneNetworkMap: { [key: string]: number } = {
  ethereum: 1,
  gnosis: 100,
  arbitrum: 42161,
  sepolia: 11155111,
};

export async function loadTokenMapping(
  filePath: string,
): Promise<BlockchainMapping> {
  const mapping: BlockchainMapping = {};
  console.log("Loading token mapping from:", filePath);

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
    tokenMap = await loadTokenMapping("src/app/api/tools/cowswap/util/tokenlist.csv");
  }
  return tokenMap[chainId][symbolOrAddress];
}

// Function to request token decimals
async function getTokenDecimals(
  chainId: number,
  tokenAddress: string,
): Promise<number> {
  const client = getClient(chainId);
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
