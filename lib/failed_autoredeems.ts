
import {
    FAILED_AUTOREDEEM_RETRYABLES_QUERY,
    GET_L1_TXS_QUERY,
    querySubgraph,
    GET_L1_DEPOSIT_DATA_QUERY,
    getPastTimestamp,
    ARB_L1_RETRYABLES_SUBGRAPH_URL,
    ARB_L2_RETRYABLES_SUBGRAPH_URL,
    L1TxsRes,
    FailedRetryableRes,
    L1DepositDataRes
  } from "./subgraph_utils";
  import{
    getL1Network,
    L1TransactionReceipt
  } from "@arbitrum/sdk";
  import { providers } from "ethers";
  import { TransactionReceipt } from '@ethersproject/providers'
  require('dotenv').config()

const l2ChainID = process.env.l2NetworkID
const failedRetryablesDelayMinutes = +(process.env.FAILED_RETRYABLES_DELAY_MINUTES || 1440); //1 day
const l1Provider = new providers.JsonRpcProvider(process.env.L1RPC)

const STARTING_TIMESTAMP = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
const ETHERSCAN_TX = "https://etherscan.io/tx/";
const ETHERSCAN_ADDRESS = "https://etherscan.io/address/";

let l1SubgraphEndpoint: string;
let l2SubgraphEndpoint: string;


const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface L2TicketReport {
    id: string; 
    retryTxHash: string;
    createdAtTimestamp: string;
    createdAtBlockNumber: number;
    timeoutTimestamp: string;
    deposit: string;
    status: string;
    retryTo: string;
    retryData: string;
    gasFeeCap: number;
    gasLimit: number;
    createdAtTxHash:string;
}
  
export interface L1TicketReport {
  id: string;
  transactionHash: string;
  sender: string;
  retryableTicketID: string;
}
  
export interface TokenDepositData {
  l2TicketId: string;
  tokenAmount: string;
  sender: string;
  l1Token: {
    symbol: string;
    id: string;
    decimals: number;
  };
  transactionHash: string;
}

export interface L1Retryables {
  id: string
  retryableTicketID: string
  timestamp: string
  transactionHash: string
  destAddr: string
  sender: string
}

  const isExpired = (ticket: L2TicketReport) => {
    const now = Math.floor(new Date().getTime() / 1000); // epoch in seconds
    return now > +ticket.timeoutTimestamp;
  };


  const setChainParams = () => {
    if (l2ChainID === "42161") {
      l1SubgraphEndpoint = ARB_L1_RETRYABLES_SUBGRAPH_URL;
      l2SubgraphEndpoint = ARB_L2_RETRYABLES_SUBGRAPH_URL;
    } else {
      throw new Error("Wrong L2 chain ID, only 42161 is supported");
    }
  };


  const getL1TXRec = async (txHash: string): Promise<TransactionReceipt>  => {
    const receipt = await l1Provider.getTransactionReceipt(txHash);
    return receipt;
    
  };

  const formatL1TX = (l1Report: L1TicketReport | undefined) => {
    let msg = "\n\t *L1 TX:* ";
  
    if (l1Report == undefined) {
      return msg + "-";
    }
    return `${msg}<${ETHERSCAN_TX + l1Report.transactionHash}`;
  };

  const formatInitiator = async ( deposit: TokenDepositData | undefined, l1Report: L1TicketReport | undefined): Promise<string> => {
   
    if (deposit !== undefined) {

      const rec = await getL1TXRec(deposit.transactionHash);
      let msg = "\n\t *Deposit initiated by:* ";
  
      return `${msg}<${ETHERSCAN_ADDRESS + rec.from}>`;
    }
  
    if (l1Report !== undefined) {
      const rec = await getL1TXRec(l1Report.transactionHash);
      let msg = "\n\t *Retryable sender:* ";
      return `${msg}<${ETHERSCAN_ADDRESS + rec.from}>`;
    }
  
    return "";
  };



  const reportFailedTickets = async (failedTickets: L2TicketReport[]) => {
  const ticketIDs: string[] = failedTickets.map((t) => t.createdAtTxHash);

  // get matching L1 TXs from L1 subgraph
  const l1TXsResponse: L1TxsRes = (await querySubgraph(l1SubgraphEndpoint, GET_L1_TXS_QUERY, {
    l2TicketIDs: ticketIDs,
    //ticketSender: process.env.FROM_CONTRACT_ADDRESS
  })) as L1TxsRes;
  const l1TXs: L1TicketReport[] = l1TXsResponse["retryables"]!;

  // get token deposit data if Arbitrum token bridge issued the retryable
  const depositsDataResponse : L1DepositDataRes = (await querySubgraph(l1SubgraphEndpoint, GET_L1_DEPOSIT_DATA_QUERY, {
    l2TicketIDs: ticketIDs
  })) as L1DepositDataRes;
  const depositsData: TokenDepositData[] = depositsDataResponse["deposits"];

  for (let i = 0; i < failedTickets.length; i++) {
    const t = failedTickets[i];
    
    //console.log(t.createdAtTxHash)

    
    const l1Report = l1TXs.find((l1Ticket) => l1Ticket.retryableTicketID === t.createdAtTxHash);
   const tokenDepositData = depositsData.find((deposit) => deposit.l2TicketId === t.id);
    
   let reportStr =
   
   await formatInitiator(tokenDepositData, l1Report) +

   formatL1TX(l1Report) 
    //console.log(tokenDepositData)
    // let reportStr = 
    //   formatL1TX(l1Report) +
    //   (await formatInitiator(tokenDepositData, l1Report))
    console.log(reportStr);
      console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
  }
};

  const getFailedTickets = async () => {
    const queryResult: FailedRetryableRes = (await querySubgraph(l2SubgraphEndpoint, FAILED_AUTOREDEEM_RETRYABLES_QUERY, {
      //fromTimestamp: getPastTimestamp(STARTING_TIMESTAMP),
      fromTimestamp: 1680373169,
    })) as FailedRetryableRes;
    const failedTickets: L2TicketReport[] = queryResult["retryables"];
  
    // subgraph doesn't know about expired tickets, so check and update status here
    const failedAndExpiredTickets = failedTickets.map((ticket) => {
      if (isExpired(ticket)) {
        return { ...ticket, status: "Expired" };
      }
      return ticket;
    });
  
    return failedAndExpiredTickets;
  };


  const checkFailedRetryables = async () => {
    // query L2 subgraph to get failed tickets
    const failedTickets: L2TicketReport[] = await getFailedTickets();
  
    // report it
    await reportFailedTickets(failedTickets);
  };


  export const checkFailedRetryablesLoop = async () => {
    console.log(`Starting retryables checker for chainId: ${l2ChainID}`);
    setChainParams();
    while (true) {
      checkFailedRetryables();
      await wait(1000 * 60 * failedRetryablesDelayMinutes);
    }
  };

  
