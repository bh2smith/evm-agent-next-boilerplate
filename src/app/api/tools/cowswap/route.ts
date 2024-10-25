import { parseQuoteRequest } from "@/src/app/api/tools/cowswap/utils";
import { OrderBookApi, SigningScheme } from "@cowprotocol/cow-sdk";
import { type NextRequest, NextResponse } from "next/server";

// Refer to https://api.cow.fi/docs/#/ for Specifics on Quoting and Order posting.

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const parsedRequest = await parseQuoteRequest(req);
    console.log("POST Request for quote:", parsedRequest);
    const orderbook = new OrderBookApi({ chainId: parsedRequest.chainId });
    // We manually add PRESIGN (sinfe this is a safe);
    const quoteResponse = await orderbook.getQuote({
      ...parsedRequest.quoteRequest,
      signingScheme: SigningScheme.PRESIGN,
    });
    console.log("Received Quote", quoteResponse);

    // Post Unsigned Order to Orderbook (this might be spam if the user doesn't sign)
    const orderUid = await orderbook.sendOrder({
      ...quoteResponse.quote,
      signature: "0x",
      signingScheme: SigningScheme.PRESIGN,
    });
    
    console.log("Order Posted", orderUid);
    // TODO: Transform Quote into SignRequest: 
    // Encode setPresignature: https://etherscan.io/address/0x9008D19f58AAbD9eD0D60971565AA8510560ab41#code

    // TODO: Update Return Schema (OrderQuote, SignRequest).

    return NextResponse.json(quoteResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return NextResponse.json({ error }, { status: 400 });
  }
}
