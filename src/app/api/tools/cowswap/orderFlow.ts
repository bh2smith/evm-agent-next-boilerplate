import { SignRequestData } from "near-safe";
import {
  createOrder,
  isNativeAsset,
  ParsedQuoteRequest,
  sellTokenApprovalTx,
  setPresignatureTx,
} from "./util/protocol";
import { OrderBookApi } from "@cowprotocol/cow-sdk";
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
  const { sellAmount, feeAmount } = quoteResponse.quote;
  // Adjust the sellAmount to account for the fee.
  // cf: https://learn.cow.fi/tutorial/submit-order
  quoteResponse.quote.sellAmount = (
    BigInt(sellAmount) + BigInt(feeAmount)
  ).toString();
  // Post Unsigned Order to Orderbook (this might be spam if the user doesn't sign)
  const order = createOrder(quoteResponse);
  console.log("Built Order", order);

  const orderUid = await orderbook.sendOrder(order);
  console.log("Order Posted", orderbook.getOrderLink(orderUid));

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
