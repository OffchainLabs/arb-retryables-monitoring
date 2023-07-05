
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

import { L1_CONTRACT_TO_PROTOCOL, L2_CONTRACT_TO_PROTOCOL } from "./constants";


const l2ChainID = process.env["l2NetworkID"] as string;
const failedRetryablesDelayMinutes = +(process.env.FAILED_RETRYABLES_DELAY_MINUTES || 1440); //1 day


const STARTING_TIMESTAMP = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
const ETHERSCAN_TX = "https://etherscan.io/tx/";
const ETHERSCAN_ADDRESS = "https://etherscan.io/address/";

let l1SubgraphEndpoint: string;
let l2SubgraphEndpoint: string;

enum Chain {
  ARBITRUM = "arbiscan",
  ETHEREUM = "etherscan",
}


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
   
      l1SubgraphEndpoint = ARB_L1_RETRYABLES_SUBGRAPH_URL;
      l2SubgraphEndpoint = ARB_L2_RETRYABLES_SUBGRAPH_URL;
   
  };


  const formatL1TX = (l1Report: L1TicketReport | undefined) => {
    let msg = "\n\t *L1 TX:* ";
  
    if (l1Report == undefined) {
      return msg + "-";
    }
  
    return `${msg}<${ETHERSCAN_TX + l1Report.transactionHash}>`;
  };

  const formatInitiator = (
    deposit: TokenDepositData | undefined,
    l1Report: L1TicketReport | undefined
  ) => {
    if (deposit !== undefined) {
      let msg = "\n\t *Deposit initiated by:* ";
      return `${msg}<${ETHERSCAN_ADDRESS + deposit.sender}>`;
    }
  
    if (l1Report !== undefined) {
      let msg = "\n\t *Retryable sender:* ";
      return `${msg}<${ETHERSCAN_ADDRESS + l1Report.sender}>`;
    }
  
    return "";
  };



  const reportFailedTickets = async (failedTickets: L2TicketReport[]) => {
  const ticketIDs: string[] = failedTickets.map((t) => t.createdAtTxHash);

  // get matching L1 TXs from L1 subgraph
  const l1TXsResponse: L1TxsRes = (await querySubgraph(l1SubgraphEndpoint, GET_L1_TXS_QUERY, {
    l2TicketIDs: ticketIDs,
    ticketSender: "0xd151c9ef49ce2d30b829a98a07767e3280f70961"
  })) as L1TxsRes;
  const l1TXs: L1TicketReport[] = l1TXsResponse["retryables"]!;

  // get token deposit data if Arbitrum token bridge issued the retryable
  const depositsDataResponse : L1DepositDataRes = (await querySubgraph(l1SubgraphEndpoint, GET_L1_DEPOSIT_DATA_QUERY, {
    l2TicketIDs: ticketIDs,
    ticketSender: "0xd151c9ef49ce2d30b829a98a07767e3280f70961"
  })) as L1DepositDataRes;
  const depositsData: TokenDepositData[] = depositsDataResponse["deposits"];


  for (let i = 0; i < failedTickets.length; i++) {
    const t = failedTickets[i];
    //console.log(t)
    const l1Report = l1TXs[i]
    const tokenDepositData = depositsData[i];

  
    if (l1Report !== undefined){

      let reportStr = 
      formatL1TX(l1Report) +
      formatInitiator(tokenDepositData, l1Report) +
      "\n=================================================================";
      console.log(reportStr);
      console.log("++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    }
    // build message to report
    
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
    //console.log(`Starting retryables checker for chainId: ${l2ChainID}`);
    setChainParams();
    while (true) {
      checkFailedRetryables();
      await wait(1000 * 60 * failedRetryablesDelayMinutes);
    }
  };

  
