import { validateInput } from "@/src/app/api/tools/validate";
import { zeroAddress } from "viem";
import { Input, parsers } from "@/src/app/api/tools/erc20/route";

describe("field validation", () => {
  it("ERC20 Input success", async () => {
    const search = new URLSearchParams(
      `chainId=123&amount=0.45&token=${zeroAddress}&recipient=${zeroAddress}`,
    );
    const input = validateInput<Input>(search, parsers);
    expect(input).toStrictEqual({
      chainId: 123,
      amount: 0.45,
      token: zeroAddress,
      recipient: zeroAddress,
    });
  });
  it("ERC20 Input fail", async () => {
    const search = new URLSearchParams(
      `amount=0.45&token=${zeroAddress}&recipient=${zeroAddress}`,
    );
    expect(() => validateInput<Input>(search, parsers)).toThrow(
      "Missing required field: chainId",
    );
    search.set("chainId", "poop");
    expect(() => validateInput<Input>(search, parsers)).toThrow(
      "Invalid Integer field chainId: Not a number",
    );
    search.set("chainId", "1");
    search.set("recipient", "0x12");
    expect(() => validateInput<Input>(search, parsers)).toThrow(
      "Invalid Address field recipient: 0x12",
    );

    const search2 = new URLSearchParams(
      "chainId=11155111&amount=0.069&recipient=0xDcf56F5a8Cc380f63b6396Dbddd0aE9fa605BeeE&token=0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    );
    const input = validateInput<Input>(search2, parsers);
    expect(input).toStrictEqual({
      chainId: 11155111,
      amount: 0.069,
      token: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
      recipient: "0xDcf56F5a8Cc380f63b6396Dbddd0aE9fa605BeeE",
    });
  });
});
