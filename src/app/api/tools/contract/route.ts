import { NextRequest, NextResponse } from "next/server";
import { Address } from "viem";
import { MultiScan } from "./util";

const SCANNER = new MultiScan(process.env.SCAN_KEYS!);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.searchParams;

  console.log("contract/", search);
  try {
    // TODO: Don't use ! here
    const chainId = parseInt(search.get("chainId")!);
    const address = search.get("address")! as Address;
    const abi = await SCANNER.getContractAbi(chainId, address);
    return NextResponse.json(abi, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : `Unknown error occurred ${String(error)}`;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
