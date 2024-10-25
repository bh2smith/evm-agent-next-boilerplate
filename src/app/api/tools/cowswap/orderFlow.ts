import { SignRequestData } from "near-safe";
import { ParsedQuoteRequest } from "./utils";
import { OrderBookApi, SigningScheme } from "@cowprotocol/cow-sdk";
import { signRequestFor } from "../weth/utils";
import { encodeFunctionData, Hex, parseAbi } from "viem";

export async function orderRequestFlow({
  chainId,
  quoteRequest,
}: ParsedQuoteRequest): Promise<SignRequestData> {
  const orderbook = new OrderBookApi({ chainId });
  // We manually add PRESIGN (since this is a safe);
  const quoteResponse = await orderbook.getQuote({
    ...quoteRequest,
    signingScheme: SigningScheme.PRESIGN,
  });
  console.log("Received Quote", quoteResponse);

  // Post Unsigned Order to Orderbook (this might be spam if the user doesn't sign)
  const order = {
    ...quoteResponse.quote,
    signature: "0x",
    signingScheme: SigningScheme.PRESIGN,
    quoteId: quoteResponse.id,
    // Add from to PRESIGN: {"errorType":"MissingFrom","description":"From address must be specified for on-chain signature"}%
    from: quoteRequest.from,
    // Override the Fee amount because of {"errorType":"NonZeroFee","description":"Fee must be zero"}%
    feeAmount: "0",
  };
  console.log("Built Order", order);

  const orderUid = await orderbook.sendOrder(order);

  console.log("Order Posted", orderUid);

  // Encode setPresignature:
  return signRequestFor({
    chainId,
    to: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
    value: "0x0",
    data: encodeFunctionData({
      abi: parseAbi([
        "function setPreSignature(bytes calldata orderUid, bool signed) external",
      ]),
      functionName: "setPreSignature",
      args: [orderUid as Hex, true],
    }),
  });
}
