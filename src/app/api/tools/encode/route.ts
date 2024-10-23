import { NextRequest, NextResponse } from "next/server";
import { encodeFunctionData, parseAbi } from "viem";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.searchParams;
  console.log("encode/", search);
  try {
    // TODO: Don't use ! here
    const functionName = search.get("functionName")!;
    const abiFragment = [search.get("abiFragment")!];
    const args = search.get("callParams")!.split(",");
    const txData = encodeFunctionData({
      abi: parseAbi(abiFragment),
      functionName,
      args
    });
    return NextResponse.json(txData, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : `Unknown error occurred ${String(error)}`;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
