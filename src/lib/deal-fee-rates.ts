/** Fees that come off high ticket cash, as a share of the cash. */
export type DealFeeRates = {
  /** Processing: comes off every high ticket dollar collected. */
  processing: number;
  /** A further cut on anything financed (Clarity, Klarna, ...), on top of processing. */
  financing: number;
};

export const DEAL_FEE_RATES = {
  // 2.5% processing, 17.5% in total on a financed deal. Same for both offers.
  bronson: { processing: 0.025, financing: 0.15 },
  aval: { processing: 0.025, financing: 0.15 },
} satisfies Record<string, DealFeeRates>;
