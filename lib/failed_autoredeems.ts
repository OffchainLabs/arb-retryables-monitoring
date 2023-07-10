
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
  import { providers } from "ethers";
  import { TransactionReceipt } from '@ethersproject/providers'
  
  require('dotenv').config()
  

const l2ChainID = process.env.l2NetworkID
const l1Provider = new providers.JsonRpcProvider(process.env.L1RPC)

const STARTING_TIMESTAMP = 100 * 24 * 60 * 60 * 1000; // 14 days in ms
const ETHERSCAN_TX = "https://etherscan.io/tx/";
const RETRYABLE_DASHBOARD = "https://retryable-dashboard.arbitrum.io/tx/";
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





const arbLog = async() => {
  let str = '🔵'
  for (let i = 0; i < 25; i++) {
    await wait(40)
    if (i == 12) {
      str = `🔵${'🔵'.repeat(i)}🔵`
    } else {
      str = `🔵${' '.repeat(i * 2)}🔵`
    }
    while (str.length < 60) {
      str = ` ${str} `
    }

    console.log(str)
  }

  console.log(`Starting retryables checker for chainId: ${l2ChainID}`)
  await wait(2000)

  console.log('Lets')
  await wait(1000)

  console.log('Go ➡️')
  await wait(1000)
  console.log('...🚀')
  await wait(1000)
  console.log('')
}

const getTimeDifference = (timestampInSeconds: number) => {
  const now = new Date().getTime() / 1000;
  const difference = timestampInSeconds - now;

  const days = Math.floor(difference / (24 * 60 * 60));
  const hours = Math.floor((difference % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((difference % (60 * 60)) / 60);
  const seconds = Math.floor(difference % 60);

  if (days > 0) {
    return `${days}days : ${hours}h : ${minutes}min : ${seconds}s`;
  } else if (hours > 0) {
    return `${hours}h : ${minutes}min : ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}min : ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

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

  const formatL1TX = (l1Report: L1TicketReport | undefined)  => {
    
  
    if (l1Report == undefined) {
      return "-";
    }
    let msg = "\n*L1 TX is:* ";
    return `${msg}${ETHERSCAN_TX + l1Report.transactionHash}`;
   

  };

  const formatInitiator = async ( deposit: TokenDepositData | undefined, l1Report: L1TicketReport | undefined): Promise<string> => {
   
    if (deposit !== undefined) {
      const depositSenderFromGraph = deposit.sender;
      const rec = await getL1TXRec(deposit.transactionHash);
      const depositSenderFromRec = rec.from;
      if (depositSenderFromGraph === process.env.FROM_CONTRACT_ADDRESS){ return depositSenderFromGraph;}
      if (depositSenderFromRec === process.env.FROM_CONTRACT_ADDRESS) { return depositSenderFromRec;}
      else{
        return "";
      }
    }

    if (l1Report !== undefined) {
      const retryableSenderFromGraph = l1Report.sender;
      const rec = await getL1TXRec(l1Report.transactionHash);
      const retryableSenderFromRec = rec.from;
      if (retryableSenderFromGraph === process.env.FROM_CONTRACT_ADDRESS){ return retryableSenderFromGraph;}
      if (retryableSenderFromRec === process.env.FROM_CONTRACT_ADDRESS) { return retryableSenderFromRec;}
      else{
        return "";
      }
   
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
  

    
    const l1Report = l1TXs.find((l1Ticket) => l1Ticket.retryableTicketID === t.createdAtTxHash);
    const tokenDepositData = depositsData.find((deposit) => deposit.l2TicketId === t.id);
    
//\nPlease visit ${RETRYABLE_DASHBOARD+l1Report.transactionHash} to manually redeem the ticket!
    
  
    if (await formatInitiator(tokenDepositData, l1Report) !==""){
   
      let reportStr = formatL1TX(l1Report);
      let l1Tx = reportStr.slice(-66);
      let prefix;
      switch (t.status) {
      case "RedeemFailed":
        
        console.log("*************************************************************************************")
        prefix = "Redeem failed for the retryable ticket! It will expire in";
        console.log(prefix + `${getTimeDifference(+t.timeoutTimestamp)}`+ reportStr + `\nPlease visit ${RETRYABLE_DASHBOARD + l1Tx} to manually redeem the ticket!`);
        
        break;
      case "Expired":
        console.log("*************************************************************************************")
        prefix = "Retryable ticket already expired!";
        console.log(prefix + reportStr);
        break;
      case "Created":
        console.log("*************************************************************************************")
        prefix = "Retryable ticket hasn't been scheduled!";
        console.log(prefix + reportStr + `\nPlease visit ${RETRYABLE_DASHBOARD + l1Tx} to manually redeem the ticket!`);
        break;
      default:
        prefix = "*Found retryable ticket in unrecognized state:*";
    }

    }
    
  }
  console.log("*************************************************************************************")
  console.log("No other ticket is found!");
  
};

  const getFailedTickets = async () => {
    const queryResult: FailedRetryableRes = (await querySubgraph(l2SubgraphEndpoint, FAILED_AUTOREDEEM_RETRYABLES_QUERY, {
      fromTimestamp: getPastTimestamp(STARTING_TIMESTAMP),
      //fromTimestamp: 1680373169,
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
    await arbLog();
    setChainParams();
    checkFailedRetryables();
    await wait(1000 * 60);
   
   
  };

  
