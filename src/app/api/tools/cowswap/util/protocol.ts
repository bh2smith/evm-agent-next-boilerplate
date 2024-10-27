import {
  Address,
  encodeFunctionData,
  getAddress,
  isAddress,
  isHex,
  parseAbi,
  parseUnits,
} from "viem";
import { Network, setupAdapter } from "near-ca";
import { NextRequest } from "next/server";
import {
  OrderQuoteRequest,
  OrderQuoteResponse,
  OrderQuoteSideKindSell,
  SigningScheme,
} from "@cowprotocol/cow-sdk";
import { MetaTransaction } from "near-safe";
import { getTokenDetails } from "./tokens";

const MAX_APPROVAL = BigInt(
  "115792089237316195423570985008687907853269984665640564039457584007913129639935",
);

// CoW (and many other Dex Protocols use this to represent native asset).
const NATIVE_ASSET = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const GPV2SettlementContract = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
const GPv2VaultRelayer = "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";

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

export function setPresignatureTx(orderUid: string): MetaTransaction {
  if (!isHex(orderUid)) {
    throw new Error(`Invalid OrderUid (not hex) ${orderUid}`);
  }
  return {
    to: GPV2SettlementContract,
    value: "0x0",
    data: encodeFunctionData({
      abi: parseAbi([
        "function setPreSignature(bytes calldata orderUid, bool signed) external",
      ]),
      functionName: "setPreSignature",
      args: [orderUid, true],
    }),
  };
}

export async function sellTokenApprovalTx(args: {
  from: string;
  sellToken: string;
  chainId: number;
  sellAmount: string;
}): Promise<MetaTransaction | null> {
  const { from, sellToken, chainId, sellAmount } = args;

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

export function isNativeAsset(token: string): boolean {
  return token.toLowerCase() === NATIVE_ASSET.toLowerCase();
}

export function createOrder(args: {
  quoteResponse: OrderQuoteResponse;
  quoteRequest: OrderQuoteRequest;
}) {
  const order = {
    ...args.quoteResponse.quote,
    signature: "0x",
    signingScheme: SigningScheme.PRESIGN,
    quoteId: args.quoteResponse.id,
    // Add from to PRESIGN: {"errorType":"MissingFrom","description":"From address must be specified for on-chain signature"}%
    from: args.quoteRequest.from,
    // TODO: Orders are expiring presumably because of this.
    // Override the Fee amount because of {"errorType":"NonZeroFee","description":"Fee must be zero"}%
    feeAmount: "0",
  };
  console.log("Built Order", order);
  return order;
}
