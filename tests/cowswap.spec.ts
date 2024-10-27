import { orderRequestFlow } from "@/src/app/api/tools/cowswap/orderFlow";
import { OrderQuoteSideKindSell } from "@cowprotocol/cow-sdk";

describe("CowSwap Plugin", () => {
  // This post an order to COW Orderbook.
  it.skip("orderRequestFlow", async () => {
    const chainId = 11155111;
    const quoteRequest = {
      sellToken: "0xb4f1737af37711e9a5890d9510c9bb60e170cb0d", // Sepolia DAI
      buyToken: "0x0625afb445c3b6b7b929342a04a22599fd5dbb59", // Sepolia COW
      receiver: "0x7fa8e8264985C7525Fc50F98aC1A9b3765405489", // Safe Associated with neareth-dev.testnet & DEFAULT_SAFE_NONCE
      from: "0x7fa8e8264985C7525Fc50F98aC1A9b3765405489",
      kind: OrderQuoteSideKindSell.SELL,
      sellAmountBeforeFee: "2000000000000000000",
    };
    console.log("Requesting Quote...")
    const signRequest = await orderRequestFlow({ chainId, quoteRequest });
    console.log(signRequest);
    console.log(
      `https://testnet.wallet.bitte.ai/sign-evm?evmTx=${encodeURI(JSON.stringify(signRequest))}`,
    );
  });
});
