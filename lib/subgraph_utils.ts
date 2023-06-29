import { GraphQLClient } from "graphql-request";

////// subgraph queries
export const FAILED_RETRYABLES_QUERY = `
query($fromTimestamp: BigInt!) {
  retryables(first: 200, where: {status_not: "Redeemed", createdAtTimestamp_gt: $fromTimestamp}, orderBy: createdAtTimestamp) {
    createdAtTxHash
  }
}
`;
//query for creation
export const GET_L1_TXS_QUERY = `
    query($l2TicketIDs: [String!]!) {
      retryables(where: {retryableTicketID_in: $l2TicketIDs}) {
        transactionHash
        sender
      }
    }
`;
export const GET_L1_DEPOSIT_DATA_QUERY = `
    query($l2TicketIDs: [String!]!) {
      deposits(where: {l2TicketId_in: $l2TicketIDs}) {
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
export const GET_L2_RETRYABLES_BY_TICKET_ID_QUERY = `
    query($l2TicketIDs: [String!]!, $lastID: String) {
      retryables(first: 200, where: {id_in: $l2TicketIDs, id_gt: $lastID}) {
        id
      }
    }
`;

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