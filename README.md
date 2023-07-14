# Arb Retryables Monitoring Tool

This tool enables you to track retryable tickets that were initiated from a _particular address_ after a _specific time_ but have failed to be automatically redeemed. If you want to learn more about retryables and their functioning, please see [here](https://developer.arbitrum.io/arbos/l1-to-l2-messaging).

Note that the tool relies on subgraphs, which index all the Arbitrum retryables in real-time, to retrieve data for retryables on both L1 (Ethereum) and L2 (Arbitrum One). In rare cases, there might be issues with the graph, causing our L1 and/or L2 subgraph to pause and resulting in data lagging for several hours until the nodes are resynced and all blocks are processed. If this occurs, it may cause tickets to not be detected accurately.

## Config Environment Variables

Set the values shown in .env-sample as environmental variables. To copy it into a .env file:

```bash
cp .env-sample .env
```

(you'll still need to edit some variables, i.e., `L1RPC`, `SENDER_ADDRESS`, and `STARTING_TIMESTAMP`)

## Installation

From the root directory:

```bash
yarn install
```

## Execution

Based on your system's configuration, you may have tickets that are initiated either from an externally owned account (EOA) or a contract that generates retryables. To utilize the script, you simply need to provide the corresponding address as an environmental variable and execute the script, using the following command.

```bash
yarn failed_autoredeems
```

The output will include all the tickets that were initiated from the specified address and are past the given timestamp. Specifically, the script will provide the following information:

- All retryables that have failed to be automatically redeemed.
- The current status of each ticket.
- If the ticket has not yet expired, it will display the future expiry time and provide a link for manual redemption.
- The L1 transaction of the retryable, which refers to the submission transaction of the ticket.
