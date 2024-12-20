import { orderRequestFlow } from "@/src/app/api/tools/cowswap/orderFlow";
import {
  applySlippage,
  createOrder,
  generateAppData,
  isNativeAsset,
  NATIVE_ASSET,
  parseQuoteRequest,
  sellTokenApprovalTx,
  setPresignatureTx,
} from "@/src/app/api/tools/cowswap/util/protocol";
import {
  BuyTokenDestination,
  OrderBookApi,
  OrderKind,
  OrderQuoteResponse,
  OrderQuoteSideKindSell,
  SellTokenSource,
  SigningScheme,
} from "@cowprotocol/cow-sdk";
import { NextRequest } from "next/server";
import { checksumAddress, zeroAddress } from "viem";
import { loadTokenMapping } from "@/src/app/api/tools/cowswap/util/tokens";

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

  it("applySlippage", async () => {
    const amounts = { buyAmount: "1000", sellAmount: "1000" };
    expect(
      applySlippage({ kind: OrderKind.BUY, ...amounts }, 50),
    ).toStrictEqual({
      sellAmount: "1005",
    });
    expect(
      applySlippage({ kind: OrderKind.SELL, ...amounts }, 50),
    ).toStrictEqual({
      buyAmount: "995",
    });

    const smallAmounts = { buyAmount: "100", sellAmount: "100" };
    expect(
      applySlippage({ kind: OrderKind.BUY, ...smallAmounts }, 100),
    ).toStrictEqual({
      sellAmount: "101",
    });
    expect(
      applySlippage({ kind: OrderKind.SELL, ...smallAmounts }, 100),
    ).toStrictEqual({
      buyAmount: "99",
    });
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

  it("sellTokenApprovalTx: null - already approved", async () => {
    // already approved
    expect(
      await sellTokenApprovalTx({
        from: DEPLOYED_SAFE,
        sellToken: SEPOLIA_DAI,
        sellAmount: "100",
        chainId,
      }),
    ).toStrictEqual(null);
  });

  it("sellTokenApprovalTx: not null - not approved", async () => {
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
  });

  it("sellTokenApprovalTx: throws - not a token", async () => {
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

  it("loadTokenMapping", async () => {
    const tokenMap = await loadTokenMapping(
      "src/app/api/tools/cowswap/util/tokenlist.csv",
    );
    console.log(tokenMap[11155111]);
  });

  it("parseQuoteRequest", async () => {
    const request = new NextRequest("https://fake-url.xyz", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mb-metadata": JSON.stringify({
          accountId: "neareth-dev.testnet",
        }),
      },
      body: JSON.stringify(quoteRequest),
    });
    expect(await parseQuoteRequest(request)).toStrictEqual({
      chainId: 11155111,
      quoteRequest: {
        buyToken: "0x0625afb445c3b6b7b929342a04a22599fd5dbb59",
        from: "0x5E1E315D96BD81c8f65c576CFD6E793aa091b480",
        kind: "sell",
        receiver: "0x5E1E315D96BD81c8f65c576CFD6E793aa091b480",
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

  it("AppData", async () => {
    const orderbook = new OrderBookApi({ chainId });
    // cf: https://v1.docs.cow.fi/cow-sdk/order-meta-data-appdata
    // TODO: Uncomment to Post Agent App Data.
    // const appCode = "Bitte Protocol";
    // const referrer = "0x8d99F8b2710e6A3B94d9bf465A98E5273069aCBd";
    // const appData = await generateAppData(appCode, referrer);
    // await orderbook.uploadAppData(hash, data);
    const appData = await generateAppData(
      "bh2smith.eth",
      "0x8d99F8b2710e6A3B94d9bf465A98E5273069aCBd",
    );
    expect(appData.hash).toBe(
      "0x1d4141fcce380de6ac7f245cde17caa00fd6ae732f486a65a8fb2fb3eb6b10e7",
    );

    const exists = await orderbook
      .getAppData(appData.hash)
      .then(() => {
        // If successful, `data` will be the resolved value from `getAppData`.
        return true;
      })
      .catch((error) => {
        console.error("Error fetching app data:", error.message);
        return false; // Or any default value to indicate the data does not exist
      });
    expect(exists).toBe(true);
  });
});
