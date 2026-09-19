/** Fixed model constant, not a user input: how many leads (dials) one rep works per day. */
export const LEADS_PER_REP_PER_DAY = 30;

export type CapacityModelInputs = {
  revenueGoal: number;
  aov: number;
  closeRate: number; // fraction 0-1
  connectionRate: number; // fraction 0-1
  workingDays: number;
  costPerLead: number;
};

export function computeCapacityModel(inputs: CapacityModelInputs) {
  const dealsNeeded = inputs.aov > 0 ? inputs.revenueGoal / inputs.aov : 0;
  const leadToDealRate = inputs.connectionRate * inputs.closeRate;
  const pickupsNeeded = inputs.closeRate > 0 ? dealsNeeded / inputs.closeRate : 0;
  const leadsRequired = leadToDealRate > 0 ? dealsNeeded / leadToDealRate : 0;
  const leadsRequiredPerDay = inputs.workingDays > 0 ? leadsRequired / inputs.workingDays : 0;
  const repsNeededExact = leadsRequiredPerDay / LEADS_PER_REP_PER_DAY;
  const repsNeededRoundUp = Math.ceil(repsNeededExact);
  // Per-rep output is measured against the reps you'd actually have to hire.
  const dealsPerRep = repsNeededRoundUp > 0 ? dealsNeeded / repsNeededRoundUp : 0;
  const revenuePerRep = repsNeededRoundUp > 0 ? inputs.revenueGoal / repsNeededRoundUp : 0;
  const adSpendNeeded = leadsRequired * inputs.costPerLead;
  const profitAfterAdSpend = inputs.revenueGoal - adSpendNeeded;

  return {
    dealsNeeded,
    leadToDealRate,
    pickupsNeeded,
    leadsRequired,
    leadsRequiredPerDay,
    repsNeededExact,
    repsNeededRoundUp,
    dealsPerRep,
    revenuePerRep,
    adSpendNeeded,
    profitAfterAdSpend,
  };
}

/** Downside scenarios here only degrade Close Rate and Connection Rate. */
export function applyCapacityDownside(
  inputs: CapacityModelInputs,
  factor: 0.85 | 0.7
): CapacityModelInputs {
  return {
    ...inputs,
    closeRate: inputs.closeRate * factor,
    connectionRate: inputs.connectionRate * factor,
  };
}

export type HighTicketAscensionInputs = {
  bookingRate: number; // fraction 0-1: low-ticket closes that book a high-ticket call
  showRate: number; // fraction 0-1
  closeRate: number; // fraction 0-1: high-ticket close rate
  aov: number;
  slotsPerCloserPerDay: number;
};

/** Low-ticket closes come from the capacity model's Deals Needed. */
export function computeHighTicketAscension(
  lowTicketCloses: number,
  workingDays: number,
  inputs: HighTicketAscensionInputs
) {
  const callsBooked = lowTicketCloses * inputs.bookingRate;
  const callsShowed = callsBooked * inputs.showRate;
  const dealsClosed = callsShowed * inputs.closeRate;
  const extraCash = dealsClosed * inputs.aov;
  const callsBookedPerDay = workingDays > 0 ? callsBooked / workingDays : 0;
  const closersNeededExact =
    inputs.slotsPerCloserPerDay > 0 ? callsBookedPerDay / inputs.slotsPerCloserPerDay : 0;
  const closersNeededRoundUp = Math.ceil(closersNeededExact);

  return {
    callsBooked,
    callsShowed,
    dealsClosed,
    extraCash,
    callsBookedPerDay,
    closersNeededExact,
    closersNeededRoundUp,
  };
}

/** Downside scenarios degrade Show Rate and High Ticket Close Rate. */
export function applyHighTicketDownside(
  inputs: HighTicketAscensionInputs,
  factor: 0.85 | 0.7
): HighTicketAscensionInputs {
  return {
    ...inputs,
    showRate: inputs.showRate * factor,
    closeRate: inputs.closeRate * factor,
  };
}

/** Rolls both funnels up: low-ticket cash is the revenue goal, high-ticket is the ascension's extra cash. */
export function computeCombinedResults(
  lowTicketCash: number,
  highTicketCash: number,
  adSpend: number
) {
  const combinedCash = lowTicketCash + highTicketCash;
  const profit = combinedCash - adSpend;
  const profitMargin = combinedCash > 0 ? profit / combinedCash : 0;
  return { combinedCash, profit, profitMargin };
}
