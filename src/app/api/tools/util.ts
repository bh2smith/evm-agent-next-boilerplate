import { MetaTransaction, SignRequestData } from "near-safe";
import { getAddress, toHex, zeroAddress } from "viem";

export function signRequestFor({
  chainId,
  metaTransactions,
}: {
  chainId: number;
  metaTransactions: MetaTransaction[];
}): SignRequestData {
  return {
    method: "eth_sendTransaction",
    chainId,
    params: metaTransactions.map((mt) => ({
      from: zeroAddress,
      to: getAddress(mt.to),
      value: toHex(mt.value),
      data: toHex(mt.data),
    })),
  };
}
