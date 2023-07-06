import { GraphQLClient } from "graphql-request";
import { L1Retryables, L1TicketReport, L2TicketReport, TokenDepositData } from "./failed_autoredeems";

////// subgraph endpoints
export const ARB_L1_RETRYABLES_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/gvladika/arb-bridge-eth-nitro";
export const ARB_L2_RETRYABLES_SUBGRAPH_URL =
  "https://api.thegraph.com/subgraphs/name/gvladika/arbitrum-retryables";

////// subgraph queries
export const FAILED_AUTOREDEEM_RETRYABLES_QUERY = `
query($fromTimestamp: BigInt!) {
  retryables(where: {redeemedAtTimestamp: null, timeoutTimestamp_gt: $fromTimestamp}) {
    id
    retryTxHash
    createdAtTimestamp
    createdAtBlockNumber
    timeoutTimestamp
    deposit
    status    
    retryTo
    retryData
    gasFeeCap
    gasLimit
    createdAtTxHash
  }
}
`;


export interface FailedRetryableRes {
  retryables: L2TicketReport[]
}

//query for creation
export const GET_L1_TXS_QUERY = `
    query($l2TicketIDs: [String!]!) {
      retryables(where: {retryableTicketID_in: $l2TicketIDs}) {
        transactionHash
        sender
        retryableTicketID
      }
    }
`;


export interface L1TxsRes {
  retryables: L1TicketReport[]
}

export const GET_L1_DEPOSIT_DATA_QUERY = `
    query($l2TicketIDs: [String!]!) {
      deposits(where: {l2TicketId_in: $l2TicketIDs}) {
        l2TicketId
        transactionHash
        tokenAmount
        sender
        l1Token {
          symbol
          id
          decimals
        }
      }
    }
`;

export interface L1DepositDataRes {
  deposits: TokenDepositData[]
}

export const GET_L1_RETRYABLES_QUERY = `
    query($fromTimestamp: BigInt!, $toTimestamp: BigInt!, $lastID: String) {
        retryables(first: 200, where: {timestamp_gt: $fromTimestamp, timestamp_lt: $toTimestamp, id_gt: $lastID}) {
          id
          retryableTicketID
          timestamp
          transactionHash
          destAddr
        }
    }
`;


export interface L1RetryablesRes {
  retryables: L1Retryables[]
}

export const GET_L2_RETRYABLES_BY_TICKET_ID_QUERY = `
    query($l2TicketIDs: [String!]!, $lastID: String) {
      retryables(first: 200, where: {id_in: $l2TicketIDs, id_gt: $lastID}) {
        id
      }
    }
`;

export interface L2RetryablesId {
  id: string
}

export interface L2RetryablesByTicketIdRes {
  retryables: L2RetryablesId[]
}

export const querySubgraph = async (url: string, query: string, queryVars?: any) => {
  const graphClient = new GraphQLClient(url);

  let retries = 0;
  const maxRetries = 200;
  const retryInterval = 30000; // 30 sec

  while (retries < maxRetries) {
    try {
      const data = await graphClient.request(query, queryVars);
      return data;
    } catch (err) {
      retries++;
      if (retries === maxRetries) {
        console.warn(`Failed to query subgraph ${url}`);
        throw err;
      } else {
        console.warn(`Subgraph query failed, retrying in ${retryInterval / 1000} seconds...`);
        await wait(retryInterval);
      }
    }
  }
console.log("no")
  return {};
};

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Unix timestamp
export const getPastTimestamp = (daysAgoInMs: number) => {
  const now = new Date().getTime();
  return Math.floor((now - daysAgoInMs) / 1000);
};

export const timestampToDate = (timestampInSeconds: number) => {
  const date = new Date(timestampInSeconds * 1000);
  return date.toUTCString();
};