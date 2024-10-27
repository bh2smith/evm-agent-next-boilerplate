import { orderRequestFlow } from "@/src/app/api/tools/cowswap/orderFlow";
import {
  createOrder,
  isNativeAsset,
  NATIVE_ASSET,
  parseQuoteRequest,
  sellTokenApprovalTx,
  setPresignatureTx,
} from "@/src/app/api/tools/cowswap/util/protocol";
import {
  BuyTokenDestination,
  OrderKind,
  OrderQuoteResponse,
  OrderQuoteSideKindSell,
  SellTokenSource,
  SigningScheme,
} from "@cowprotocol/cow-sdk";
import { NextRequest } from "next/server";
import { checksumAddress, zeroAddress } from "viem";

const SEPOLIA_DAI = "0xb4f1737af37711e9a5890d9510c9bb60e170cb0d";
const SEPOLIA_COW = "0x0625afb445c3b6b7b929342a04a22599fd5dbb59";
// Safe Associated with neareth-dev.testnet & DEFAULT_SAFE_NONCE
const DEPLOYED_SAFE = "0x7fa8e8264985C7525Fc50F98aC1A9b3765405489";

const chainId = 11155111;
const quoteRequest = {
  chainId,
  sellToken: SEPOLIA_DAI,
  buyToken: SEPOLIA_COW,
  receiver: DEPLOYED_SAFE,
  from: DEPLOYED_SAFE,
  kind: OrderQuoteSideKindSell.SELL,
  sellAmountBeforeFee: "2000000000000000000",
};
describe("CowSwap Plugin", () => {
  // This post an order to COW Orderbook.
  it.skip("orderRequestFlow", async () => {
    console.log("Requesting Quote...");
    const signRequest = await orderRequestFlow({ chainId, quoteRequest });
    console.log(signRequest);
    console.log(
      `https://testnet.wallet.bitte.ai/sign-evm?evmTx=${encodeURI(JSON.stringify(signRequest))}`,
    );
  });
  it("isNativeAsset", () => {
    expect(isNativeAsset("word")).toBe(false);
    expect(isNativeAsset(NATIVE_ASSET)).toBe(true);
    expect(isNativeAsset(NATIVE_ASSET.toLowerCase())).toBe(true);
    expect(isNativeAsset(checksumAddress(NATIVE_ASSET))).toBe(true);
    expect(isNativeAsset("0xb4f1737af37711e9a5890d9510c9bb60e170cb0d")).toBe(
      false,
    );
  });

  it("sellTokenApprovalTx", async () => {
    // already approved
    expect(
      await sellTokenApprovalTx({
        from: DEPLOYED_SAFE,
        sellToken: SEPOLIA_DAI,
        sellAmount: "100",
        chainId,
      }),
    ).toStrictEqual(null);
    // Not approved
    expect(
      await sellTokenApprovalTx({
        from: zeroAddress, // Will never be approved
        sellToken: SEPOLIA_COW,
        sellAmount: "100",
        chainId,
      }),
    ).toStrictEqual({
      to: "0x0625afb445c3b6b7b929342a04a22599fd5dbb59",
      value: "0x0",
      data: "0x095ea7b3000000000000000000000000c92e8bdf79f0507f65a392b0ab4667716bfe0110ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    });
    // Not a token.
    await expect(
      sellTokenApprovalTx({
        from: DEPLOYED_SAFE,
        sellToken: zeroAddress, // Not a token
        sellAmount: "100",
        chainId,
      }),
    ).rejects.toThrow();
  });

  it("setPresignatureTx", () => {
    const invalidOrderUid = "fart";
    expect(() => setPresignatureTx(invalidOrderUid)).toThrow(
      `Invalid OrderUid (not hex): ${invalidOrderUid}`,
    );

    expect(setPresignatureTx("0x12")).toStrictEqual({
      to: "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
      value: "0x0",
      data: "0xec6cb13f0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000011200000000000000000000000000000000000000000000000000000000000000",
    });
  });

  it("parseQuoteRequest", async () => {
    const request = new NextRequest("https://fake-url.xyz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(quoteRequest),
    });
    expect(await parseQuoteRequest(request)).toStrictEqual({
      chainId: 11155111,
      quoteRequest: {
        buyToken: "0x0625afb445c3b6b7b929342a04a22599fd5dbb59",
        from: "0x7fa8e8264985C7525Fc50F98aC1A9b3765405489",
        kind: "sell",
        receiver: "0x7fa8e8264985C7525Fc50F98aC1A9b3765405489",
        sellAmountBeforeFee: "2000000000000000000000000000000000000",
        sellToken: "0xb4f1737af37711e9a5890d9510c9bb60e170cb0d",
        signingScheme: "presign",
      },
    });
  });

  it("parseQuoteRequest", () => {
    const commonFields = {
      sellToken: "0xb4f1737af37711e9a5890d9510c9bb60e170cb0d",
      buyToken: "0x0625afb445c3b6b7b929342a04a22599fd5dbb59",
      receiver: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
      sellAmount: "1911566262405367520",
      buyAmount: "1580230386982546854",
      validTo: 1730022042,
      appData:
        "0x0000000000000000000000000000000000000000000000000000000000000000",

      partiallyFillable: false,
    };

    const quoteResponse: OrderQuoteResponse = {
      quote: {
        ...commonFields,
        feeAmount: "88433737594632480",
        kind: OrderKind.SELL,
        sellTokenBalance: SellTokenSource.ERC20,
        buyTokenBalance: BuyTokenDestination.ERC20,
        signingScheme: SigningScheme.PRESIGN,
      },
      from: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
      expiration: "2024-10-27T09:12:42.738162481Z",
      id: 470630,
      verified: true,
    };
    expect(createOrder(quoteResponse)).toStrictEqual({
      ...commonFields,
      quoteId: 470630,
      from: "0x7fa8e8264985c7525fc50f98ac1a9b3765405489",
      feeAmount: "0",
      kind: "sell",
      sellTokenBalance: "erc20",
      buyTokenBalance: "erc20",
      signature: "0x",
      signingScheme: "presign",
      validTo: 1730022042,
    });
  });
});
