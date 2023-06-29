
import {
    FAILED_RETRYABLES_QUERY,
    GET_L1_TXS_QUERY,
    querySubgraph,
    GET_L1_DEPOSIT_DATA_QUERY,
    getPastTimestamp,
  } from "./subgraph_utils";

const l2ChainID = process.env["l2NetworkID"] as string;
const failedRetryablesDelayMinutes = +(process.env.FAILED_RETRYABLES_DELAY_MINUTES || 1440); //1 day


const STARTING_TIMESTAMP = 14 * 24 * 60 * 60 * 1000; // 14 days in ms
const ETHERSCAN_TX = "https://etherscan.io/tx/";

let l1SubgraphEndpoint: string;
let l2SubgraphEndpoint: string;


const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

interface L2TicketReport {
    id: string; //the L1 submission tx
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
  
  interface L1TicketReport {
    transactionHash: string;
    sender: string;
  }
  
  interface TokenDepositData {
    l2TicketId: string;
    tokenAmount: string;
    sender: string;
    l1Token: {
      symbol: string;
      id: string;
      decimals: number;
    };
  }

  const isExpired = (ticket: L2TicketReport) => {
    const now = Math.floor(new Date().getTime() / 1000); // epoch in seconds
    return now > +ticket.timeoutTimestamp;
  };


  const setChainParams = () => {
    if (l2ChainID === "42161") {
      l1SubgraphEndpoint = process.env["ARB_BRIDGE_SUBGRAPH_URL"] as string;
      l2SubgraphEndpoint = process.env["ARB_RETRYABLES_SUBGRAPH_URL"] as string;
    } else {
      throw new Error("Wrong L2 chain ID, only 42161 is supported!");
    }
  };


  const formatL1TX = (l1Report: L1TicketReport | undefined) => {
    let msg = "\n\t *L1 TX:* ";
  
    if (l1Report == undefined) {
      return msg + "-";
    }
  
    return `${msg}<${ETHERSCAN_TX + l1Report.transactionHash}|${l1Report.transactionHash}>`;
  };


  const reportFailedTickets = async (failedTickets: L2TicketReport[]) => {
  const ticketIDs: string[] = failedTickets.map((t) => t.createdAtTxHash);

  // get matching L1 TXs from L1 subgraph
  const l1TXsResponse = await querySubgraph(l1SubgraphEndpoint, GET_L1_TXS_QUERY, {
    l2TicketIDs: ticketIDs,
  });
  const l1TXs: L1TicketReport[] = l1TXsResponse["retryables"];

  // get token deposit data if Arbitrum token bridge issued the retryable
  const depositsDataResponse = await querySubgraph(l1SubgraphEndpoint, GET_L1_DEPOSIT_DATA_QUERY, {
    l2TicketIDs: ticketIDs,
  });
  const depositsData: TokenDepositData[] = depositsDataResponse["deposits"];


  for (let i = 0; i < failedTickets.length; i++) {
    const t = failedTickets[i];
    const l1Report = l1TXs.find((l1Ticket) => l1Ticket.transactionHash === t.id);

    // build message to report
    let reportStr = formatL1TX(l1Report) +
    "\n=================================================================";

    console.log(reportStr);
  }
};

  const getFailedTickets = async () => {
    const queryResult = await querySubgraph(l2SubgraphEndpoint, FAILED_RETRYABLES_QUERY, {
      fromTimestamp: getPastTimestamp(STARTING_TIMESTAMP),
    });
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


  const checkFailedRetryablesLoop = async () => {
    console.log(`Starting retryables checker for chainId: ${l2ChainID}`);
  
    while (true) {
      checkFailedRetryables();
      await wait(1000 * 60 * failedRetryablesDelayMinutes);
    }
  };


  export const checkFailedRetryablesProcess = async () => {
    setChainParams();
  
    checkFailedRetryablesLoop().catch(async (e: Error) => {
      console.log(
        `🔴 Error: ${e.stack} \n\n Retryables checker will start up again in ${failedRetryablesDelayMinutes} minutes 🔴 `
      );
  
      setTimeout(checkFailedRetryablesProcess, 1000 * 60 * failedRetryablesDelayMinutes);
    });
  };
  
