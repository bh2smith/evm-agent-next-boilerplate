import { parseQuoteRequest } from "@/src/app/api/tools/cowswap/util/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { orderRequestFlow } from "./orderFlow";

// Refer to https://api.cow.fi/docs/#/ for Specifics on Quoting and Order posting.

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const parsedRequest = await parseQuoteRequest(req);
    console.log("POST Request for quote:", parsedRequest);
    const signRequest = await orderRequestFlow(parsedRequest);
    // TODO: Update Return Schema (OrderQuote, SignRequest).
    return NextResponse.json(signRequest);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return NextResponse.json({ error }, { status: 400 });
  }
}
