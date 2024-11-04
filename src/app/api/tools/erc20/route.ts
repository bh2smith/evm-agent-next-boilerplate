import { NextRequest, NextResponse } from "next/server";
import { Address, encodeFunctionData, erc20Abi } from "viem";
import { signRequestFor } from "../util";
import { readContract } from "viem/actions";
import { Network } from "near-ca";
import { parseUnits } from "viem/utils";
import {
  addressField,
  FieldParser,
  floatField,
  numberField,
  validateInput,
} from "../validate";
import { getClient } from "near-safe";

// Declare Route Input
interface Input {
  chainId: number;
  amount: number;
  token: Address;
  recipient: Address;
}

const parsers: FieldParser<Input> = {
  chainId: numberField,
  amount: floatField,
  token: addressField,
  recipient: addressField,
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.searchParams;
  console.log("erc20/", search);
  try {
    const { chainId, amount, token, recipient } = validateInput<Input>(
      search,
      parsers,
    );
    const decimals = await readContract(getClient(chainId), {
      address: token,
      functionName: "decimals",
      abi: erc20Abi,
    });
    const signRequest = signRequestFor({
      chainId,
      metaTransactions: [
        {
          to: token,
          value: "0x",
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [recipient, parseUnits(amount.toString(), decimals)],
          }),
        },
      ],
    });
    return NextResponse.json(signRequest, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : `Unknown error occurred ${String(error)}`;
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
