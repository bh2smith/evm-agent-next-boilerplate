
import { validateInput } from "@/src/app/api/tools/validate";
import { zeroAddress } from "viem";
import {Input, parsers} from "@/src/app/api/tools/erc20/route";


describe("field validation", () => {
  it("ERC20 Input success", async () => {
    const search = new URLSearchParams(`chainId=123&amount=0.45&address=${zeroAddress}&recipient=${zeroAddress}`)
    const input = validateInput<Input>(search, parsers);
    expect(input).toStrictEqual({chainId: 123, amount: 0.45, address: zeroAddress, recipient: zeroAddress});
  });
  it("ERC20 Input fail", async () => {
    const search = new URLSearchParams(`amount=0.45&address=${zeroAddress}&recipient=${zeroAddress}`);
    expect(() => validateInput<Input>(search, parsers)).toThrow("Missing required field: chainId");
    search.set("chainId", "poop");
    expect(() => validateInput<Input>(search, parsers)).toThrow("Invalid Integer field chainId: Not a number");
    search.set("chainId","1");
    search.set("recipient", "0x12")
    expect(() => validateInput<Input>(search, parsers)).toThrow("Invalid Address field recipient: 0x12");
  });
});
