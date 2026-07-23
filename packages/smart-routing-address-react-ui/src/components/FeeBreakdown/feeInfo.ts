/**
 * Plain-language explanations for each fee/route line, surfaced as tooltips
 * on the info icons in the fee section so users understand what they're
 * charged.
 */
export const FEE_INFO = {
  minDeposit: 'Smallest amount this route can process after fees.',
  maxSlippage: 'Maximum price movement allowed during the swap.',
  estimatedFee: 'Estimated swap, bridge, and network costs.',
  readyIn: 'Estimated arrival after the deposit is detected.',
  // Breakdown legs
  provider: 'Bridge provider selected for this route.',
  execution: 'Cost to execute and deliver funds on the destination chain.',
  capital: 'Relayer cost for fronting capital while bridging.',
  destGas: 'Gas to complete delivery on the destination chain.',
  lp: 'Bridge liquidity-provider fee.',
  service: 'Solver fee for filling the route.',
  originGas: 'Gas to submit from the source chain.',
  app: 'Optional application fee.',
} as const
