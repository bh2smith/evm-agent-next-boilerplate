import { SignRequestData } from "near-safe";
import {
  createOrder,
  isNativeAsset,
  ParsedQuoteRequest,
  sellTokenApprovalTx,
  setPresignatureTx,
} from "./util/protocol";
import { OrderBookApi, SigningScheme } from "@cowprotocol/cow-sdk";
import { signRequestFor } from "../util";

export async function orderRequestFlow({
  chainId,
  quoteRequest,
}: ParsedQuoteRequest): Promise<SignRequestData> {
  if (isNativeAsset(quoteRequest.sellToken)) {
    // TODO: Integrate EthFlow
    throw new Error(
      `This agent does not currently support Native Asset Sell Orders.`,
    );
  }
  const orderbook = new OrderBookApi({ chainId });
  console.log(`Requesting quote for ${JSON.stringify(quoteRequest, null, 2)}`);
  const quoteResponse = await orderbook.getQuote(quoteRequest);
  console.log("Received quote", quoteResponse);

  // Post Unsigned Order to Orderbook (this might be spam if the user doesn't sign)
  const order = createOrder(quoteResponse);
  console.log("Built Order", order);

  const orderUid = await orderbook.sendOrder(order);
  console.log("Order Posted", orderUid);

  // User must approve the sellToken to trade.
  const approvalTx = await sellTokenApprovalTx({
    ...quoteRequest,
    chainId,
    sellAmount: quoteResponse.quote.sellAmount,
  });
  return signRequestFor({
    chainId,
    metaTransactions: [
      ...(approvalTx ? [approvalTx] : []),
      // Encode setPresignature (this is onchain confirmation of order signature.)
      setPresignatureTx(orderUid),
    ],
  });
}
