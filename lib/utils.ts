import { ArbGasInfo__factory } from "@arbitrum/sdk/dist/lib/abi/factories/ArbGasInfo__factory";
import { ArbRetryableTx__factory } from "@arbitrum/sdk/dist/lib/abi/factories/ArbRetryableTx__factory";

import {
  ARB_GAS_INFO,
  ARB_RETRYABLE_TX_ADDRESS,
} from "@arbitrum/sdk/dist/lib/dataEntities/constants";
import { getEnv } from "./getEnv";
import { BigNumber } from "ethers";
import axios from "axios";

/**
 * Call precompiles to get info about gas price and gas estimation for the TX execution.
 *
 * @param createdAtBlockNumber
 * @param txData
 * @returns
 */
export async function getGasInfo(
  createdAtBlockNumber: number,
  ticketId: string
): Promise<{ l2GasPrice: BigNumber; l2GasPriceAtCreation: BigNumber; redeemEstimate: BigNumber }> {
  const { l2Provider } = await getEnv();

  // connect precompiles
  const arbGasInfo = ArbGasInfo__factory.connect(ARB_GAS_INFO, l2Provider);
  const retryablePrecompile = ArbRetryableTx__factory.connect(ARB_RETRYABLE_TX_ADDRESS, l2Provider);

  // get current gas price
  const gasComponents = await arbGasInfo.callStatic.getPricesInWei();
  const l2GasPrice = gasComponents[5];

  // get gas price when retryable was created
  const gasComponentsAtCreation = await arbGasInfo.callStatic.getPricesInWei({
    blockTag: createdAtBlockNumber,
  });
  const l2GasPriceAtCreation = gasComponentsAtCreation[5];

  // get gas estimation for redeem
  const redeemEstimate = await retryablePrecompile.estimateGas.redeem(ticketId);

  return { l2GasPrice, l2GasPriceAtCreation, redeemEstimate };
}

export async function decodeCalldata(txData: string): Promise<string | undefined> {
  let decodeFunctionName = undefined;

  try {
    // 0x + 4bytes
    const functionSig = txData.substring(0, 10);
    const url = `https://sig.eth.samczsun.com/api/v1/signatures?function=${functionSig}`;
    const response = await axios.get(url);
    decodeFunctionName = response.data.result.function[functionSig][0].name;
  } catch {}

  return decodeFunctionName;
}

/**
 * Send ping to healthchecks.io
 * @param pingUrl
 */
export async function sendHealthCheck(pingUrl: string): Promise<void> {
  try {
    await axios.get(pingUrl);
  } catch {}
}