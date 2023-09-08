import {
  FAILED_AUTOREDEEM_RETRYABLES_QUERY,
  GET_L1_TXS_QUERY,
  querySubgraph,
  GET_L1_DEPOSIT_DATA_QUERY,
  getPastTimestamp,
  L1TxsRes,
  FailedRetryableRes,
  L1DepositDataRes,
} from './subgraph_utils'
import { requireEnvVariables, arbLog } from './utils'

import { providers } from 'ethers'
import { TransactionReceipt } from '@ethersproject/providers'

require('dotenv').config()

const l2ChainID = process.env.L2_NETWORK_ID
const l1Provider = new providers.JsonRpcProvider(process.env.L1RPC)

let l1SubgraphEndpoint: string
let l2SubgraphEndpoint: string

export interface L2TicketReport {
  id: string
  retryTxHash: string
  createdAtTimestamp: string
  createdAtBlockNumber: number
  timeoutTimestamp: string
  deposit: string
  status: string
  retryTo: string
  retryData: string
  gasFeeCap: number
  gasLimit: number
  createdAtTxHash: string
}

export interface L1TicketReport {
  id: string
  transactionHash: string
  sender: string
  retryableTicketID: string
}

export interface TokenDepositData {
  l2TicketId: string
  tokenAmount: string
  sender: string
  l1Token: {
    symbol: string
    id: string
    decimals: number
  }
  transactionHash: string
}

export interface L1Retryables {
  id: string
  retryableTicketID: string
  timestamp: string
  transactionHash: string
  destAddr: string
  sender: string
}

const getTimeDifference = (timestampInSeconds: number) => {
  const now = new Date().getTime() / 1000
  const difference = timestampInSeconds - now

  const days = Math.floor(difference / (24 * 60 * 60))
  const hours = Math.floor((difference % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((difference % (60 * 60)) / 60)
  const seconds = Math.floor(difference % 60)

  if (days > 0) {
    return `${days}days : ${hours}h : ${minutes}min : ${seconds}s`
  } else if (hours > 0) {
    return `${hours}h : ${minutes}min : ${seconds}s`
  } else if (minutes > 0) {
    return `${minutes}min : ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

const isExpired = (ticket: L2TicketReport) => {
  const now = Math.floor(new Date().getTime() / 1000) // epoch in seconds
  return now > Number(ticket.timeoutTimestamp)
}

const setChainParams = () => {
  if (l2ChainID === '42161') {
    l1SubgraphEndpoint = process.env.ARB_L1_RETRYABLES_SUBGRAPH_URL!
    l2SubgraphEndpoint = process.env.ARB_L2_RETRYABLES_SUBGRAPH_URL!
  } else {
    throw new Error('Wrong L2 chain ID, only 42161 is supported')
  }
}

const getL1TXRec = async (txHash: string): Promise<TransactionReceipt> => {
  const receipt = await l1Provider.getTransactionReceipt(txHash)
  return receipt
}

const formatL1TX = (l1Report: L1TicketReport | undefined) => {
  if (l1Report == undefined) {
    return '-'
  }
  let msg = '\nL1 TX is: '
  return `${msg}${process.env.ETHERSCAN_TX + l1Report.transactionHash}`
}

const isMatchingSender = async (
  deposit: TokenDepositData | undefined,
  l1Report: L1TicketReport | undefined
): Promise<boolean> => {
  if (deposit !== undefined) {
    const depositSenderFromGraph = deposit.sender.toLowerCase()
    const rec = await getL1TXRec(deposit.transactionHash)
    const depositSenderFromRec = rec.from.toLowerCase()

    if (
      depositSenderFromGraph == process.env.SENDER_ADDRESS!.toLowerCase() ||
      depositSenderFromRec == process.env.SENDER_ADDRESS!.toLowerCase()
    ) {
      return true
    }
  }

  if (l1Report !== undefined) {
    const retryableSenderFromGraph = l1Report.sender.toLowerCase()
    const rec = await getL1TXRec(l1Report.transactionHash)
    const retryableSenderFromRec = rec.from.toLowerCase()
    if (
      retryableSenderFromGraph === process.env.SENDER_ADDRESS!.toLowerCase() ||
      retryableSenderFromRec === process.env.SENDER_ADDRESS!.toLowerCase()
    ) {
      return true
    }
  }

  return false
}

const reportFailedTickets = async (failedTickets: L2TicketReport[]) => {
  const ticketIDs: string[] = failedTickets.map(t => t.createdAtTxHash)

  // get matching L1 TXs from L1 subgraph
  const l1TXsResponse: L1TxsRes = (await querySubgraph(
    l1SubgraphEndpoint,
    GET_L1_TXS_QUERY,
    {
      l2TicketIDs: ticketIDs,
    }
  )) as L1TxsRes
  const l1TXs: L1TicketReport[] = l1TXsResponse['retryables']!

  // get token deposit data if Arbitrum token bridge issued the retryable
  const depositsDataResponse: L1DepositDataRes = (await querySubgraph(
    l1SubgraphEndpoint,
    GET_L1_DEPOSIT_DATA_QUERY,
    {
      l2TicketIDs: ticketIDs,
    }
  )) as L1DepositDataRes
  const depositsData: TokenDepositData[] = depositsDataResponse['deposits']

  for (let i = 0; i < failedTickets.length; i++) {
    const t = failedTickets[i]

    const l1Report = l1TXs.find(
      l1Ticket => l1Ticket.retryableTicketID === t.createdAtTxHash
    )
    const tokenDepositData = depositsData.find(
      deposit => deposit.l2TicketId === t.id
    )

    if (await isMatchingSender(tokenDepositData, l1Report)) {
      let reportStr = formatL1TX(l1Report)
      let l1Tx = reportStr.slice(-66)
      let prefix
      switch (t.status) {
        case 'RedeemFailed':
          console.log(
            '*************************************************************************************'
          )
          prefix =
            'Redeem failed for the retryable ticket!\n🚨 Note that the ticket will expire in '
          console.log(
            prefix +
              `${getTimeDifference(+t.timeoutTimestamp)}` +
              reportStr +
              `\nPlease visit ${
                process.env.RETRYABLE_DASHBOARD + l1Tx
              } to manually redeem the ticket!`
          )

          break
        case 'Expired':
          console.log(
            '*************************************************************************************'
          )
          prefix = 'Retryable ticket already expired!'
          console.log(prefix + reportStr)
          break
        case 'Created':
          console.log(
            '*************************************************************************************'
          )
          prefix = "Retryable ticket hasn't been scheduled!"
          console.log(
            prefix +
              reportStr +
              `\nPlease visit ${
                process.env.RETRYABLE_DASHBOARD + l1Tx
              } to manually redeem the ticket!`
          )
          break
        default:
          prefix = '*Found retryable ticket in unrecognized state:*'
      }
    }
  }
  console.log(
    '*************************************************************************************'
  )
  console.log('No other ticket is found!')
}

const getFailedTickets = async () => {
  const queryResult: FailedRetryableRes = (await querySubgraph(
    l2SubgraphEndpoint,
    FAILED_AUTOREDEEM_RETRYABLES_QUERY,
    {
      fromTimestamp: getPastTimestamp(
        parseInt(process.env.CREATED_SINCE_DAYS_AGO!)
      ),
    }
  )) as FailedRetryableRes
  const failedTickets: L2TicketReport[] = queryResult['retryables']

  // subgraph doesn't know about expired tickets, so check and update status here
  const failedAndExpiredTickets = failedTickets.map(ticket => {
    if (isExpired(ticket)) {
      return { ...ticket, status: 'Expired' }
    }
    return ticket
  })

  return failedAndExpiredTickets
}

const checkFailedRetryables = async () => {
  // query L2 subgraph to get failed tickets
  const failedTickets: L2TicketReport[] = await getFailedTickets()

  // report it
  await reportFailedTickets(failedTickets)
}

export const checkFailedRetryablesLoop = async () => {
  requireEnvVariables(['L1RPC', 'SENDER_ADDRESS', 'CREATED_SINCE_DAYS_AGO'])
  await arbLog(l2ChainID)
  setChainParams()
  await checkFailedRetryables()
}
