interface ICONTRACT_TO_PROTOCOL {
  [contract: string]: string;
}
export const L1_CONTRACT_TO_PROTOCOL: ICONTRACT_TO_PROTOCOL = {
  "0xd151c9ef49ce2d30b829a98a07767e3280f70961": "Connext", //add your L1 contract here
};
export const L2_CONTRACT_TO_PROTOCOL: ICONTRACT_TO_PROTOCOL = {
  "0x09e9222e96e7b4ae2a407b98d48e330053351eee": "Arbitrum One: L2 ERC20 Gateway",
  "0x096760f208390250649e3e8763348e783aef5562": "Arbitrum One: L2 Custom Gateway",
  "0x7d9103572be58ffe99dc390e8246f02dcae6f611": "Aave Executor",
  "0x13baf73f48fcf6a8aab8431ca3a38c624cdfd8f3": "Beamer",
  "0xfd81392229b6252cf761459d370c239be3afc54f": "Connext",
  "0x6d2457a4ad276000a615295f7a80f79e48ccd318": "Livepeer",
};