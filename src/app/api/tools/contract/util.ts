import { Abi, Address, Chain, isAddress } from "viem";

import * as chains from "viem/chains";

type NetworkMap = { [key: number]: Chain };

/// Dynamically generate network map accessible by chainId.
function createNetworkMap(supportedNetworks: Chain[]): NetworkMap {
  const networkMap: NetworkMap = {};
  supportedNetworks.forEach((network) => {
    networkMap[network.id] = network;
  });

  return networkMap;
}
// We support all networks exported by viem
const SUPPORTED_NETWORKS = createNetworkMap(Object.values(chains));

function networkForChainId(chainId: number): Chain {
  const chain = SUPPORTED_NETWORKS[chainId];
  if (!chain) {
    throw new Error(
      `Network with chainId ${chainId} is not supported.
      Please reach out to the developers of https://github.com/Mintbase/near-ca`,
    );
  }
  return chain;
}

type ScanKeys = { [key: number]: string };

export class MultiScan {
  private keys: ScanKeys;
  constructor(keyString: string) {
    this.keys = JSON.parse(keyString);
  }

  // Function to fetch the contract ABI from Etherscan
  async getContractAbi(
    chainId: number,
    contractAddress: Address,
  ): Promise<Abi | null> {
    console.log("Request:", chainId, isAddress(contractAddress, {strict: false}))
    try {
      const url = this.scanUrl(chainId, contractAddress);
      const response = await fetch(url);
      const data = await response.json();
      const { status, result } = data;
      const abi: Abi = JSON.parse(result);
      if (status === "1") {
        return abi;
      } else {
        console.error("Error fetching contract ABI:", result);
        return null;
      }
    } catch (error) {
      console.error("Error fetching contract ABI:", error);
      return null;
    }
  }

  scanUrl(chainId: number, address: Address): string {
    const chain = networkForChainId(chainId);
    const scanBase = chain.blockExplorers?.default.apiUrl;
    if (!scanBase) {
      console.error(`No scanAPI found for chainId ${chainId}: ${chain}`);
    }
    return `${scanBase}?module=contract&action=getabi&address=${address}&apikey=${this.keys[chainId]}`;
  }
}
