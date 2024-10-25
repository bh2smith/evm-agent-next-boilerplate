import dotenv from "dotenv";
dotenv.config();
import { MultiScan } from "@/src/app/api/tools/contract/util";

const scanner = new MultiScan(process.env.SCAN_KEYS!);
describe.skip("explorer scan", () => {
  it("fetchContractABI", async () => {
    const abi = await scanner.getContractAbi(
      100,
      "0x9008D19f58AAbD9eD0D60971565AA8510560ab41",
    );

    console.log("Got ABI", abi);
  });
});
