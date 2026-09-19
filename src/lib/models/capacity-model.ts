/** Fixed model constant, not a user input: how many leads (dials) one dialer works per day. */
export const LEADS_PER_DIALER_PER_DAY = 30;

export type CapacityModelInputs = {
  revenueGoal: number;
  aov: number;
  closeRate: number; // fraction 0-1
  connectionRate: number; // fraction 0-1
  workingDays: number;
};

export function computeCapacityModel(inputs: CapacityModelInputs) {
  const salesNeeded = inputs.aov > 0 ? inputs.revenueGoal / inputs.aov : 0;
  const pickupsNeeded = inputs.closeRate > 0 ? salesNeeded / inputs.closeRate : 0;
  const dialsNeeded = inputs.connectionRate > 0 ? pickupsNeeded / inputs.connectionRate : 0;
  const dialsNeededPerDay = inputs.workingDays > 0 ? dialsNeeded / inputs.workingDays : 0;
  const dialersNeededExact = dialsNeededPerDay / LEADS_PER_DIALER_PER_DAY;
  const dialersNeededRoundUp = Math.ceil(dialersNeededExact);

  return {
    salesNeeded,
    pickupsNeeded,
    dialsNeeded,
    dialsNeededPerDay,
    dialersNeededExact,
    dialersNeededRoundUp,
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
