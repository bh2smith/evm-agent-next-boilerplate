import { parseQuoteRequest } from "@/src/app/api/tools/cowswap/utils";
import { type NextRequest, NextResponse } from "next/server";

const COW_API = "https://api.cow.fi";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const requestBody = await parseQuoteRequest(req);
    console.log("POST Request for quote:", requestBody);

    const response = await fetch(
      `${COW_API}/${requestBody.network}/api/v1/quote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
    );


    
    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ message }, { status: response.status });
    }
    // TODO: Maybe cow-sdk exports types for this:
    //  https://github.com/cowprotocol/cow-sdk
    const quote = await response.json();

    // TODO: Post Unsigned Quote to Orderbook.

    // TODO: Transform Quote into SignRequest

    // TODO: Update Return Schema (OrderQuote, SignRequest).

    return NextResponse.json(quote);
  } catch (error: unknown) {
    const message = error instanceof Error? error.message: String(error)
    console.error(message)
    return NextResponse.json({ error }, { status: 400 });
  }
}
