import {
    getL1Network,
    getL2Network,
  } from "@arbitrum/sdk";
  import { providers } from "ethers";
  
  import dotenv from "dotenv";
  
  export const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60
  
  dotenv.config();
  
  let l2NetworkID = process.env["l2NetworkID"] as string;
  
  export const getEnv = async () => {
    // SDK migration doesn't give direct access to the network objects, so just doing this here, it's ndb
    const l2NetworkRPC = (()=>{
      switch (l2NetworkID) {
        case '421613':
          return 'https://goerli-rollup.arbitrum.io/rpc'
        case '42161':
          return process.env["ARB_ONE_RPC"] as string
        case '42170':
          return process.env["NOVA_RPC"] as string
        default: {
          throw new Error(`Unknown L2 network ${l2NetworkID}`)
        }
      }
    })()
  
    const l1NetworkRPC = (()=>{
      switch (l2NetworkID) {
        case '421613':
          return process.env.GOERLI_RPC || ""
        case '42161':
          return process.env.MAINNET_RPC || ""
        case '42170':
          return process.env.MAINNET_RPC || ""
        default: {
          throw new Error(`Unknown L2 network ${l2NetworkID}`)
        }
      }
    })()
    const ethProvider = new providers.JsonRpcProvider(l1NetworkRPC);
    const arbProvider = new providers.JsonRpcProvider(l2NetworkRPC);
  
    const l2Network = await getL2Network(arbProvider);
    const l1Network = await getL1Network(ethProvider);
    const LOOP_MINUTES = +(process.env.PUBLISHER_LOOP_MINUTES || 0);
  
    const networkID = process.env.l2NetworkID;
    const testnetPrivkey = process.env.TESTNET_PRIVKEY || '';
    const verbose = process.env.VERBOSE === 'true';
  
    return {
      l1Network,
      l1Provider: ethProvider,
      l2Network,
      l2Provider: arbProvider,
      LOOP_MINUTES,
      networkID,
      testnetPrivkey,
      verbose,
    }
  };