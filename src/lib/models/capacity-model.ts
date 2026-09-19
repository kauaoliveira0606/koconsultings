export type CapacityModelInputs = {
  revenueGoal: number;
  aov: number;
  closeRate: number; // fraction 0-1
  connectionRate: number; // fraction 0-1
  workingDays: number;
  dialers: number; // headcount we have (input)
};

export function computeCapacityModel(inputs: CapacityModelInputs) {
  const salesNeeded = inputs.aov > 0 ? inputs.revenueGoal / inputs.aov : 0;
  const pickupsNeeded = inputs.closeRate > 0 ? salesNeeded / inputs.closeRate : 0;
  const dialsNeeded = inputs.connectionRate > 0 ? pickupsNeeded / inputs.connectionRate : 0;
  const dialsNeededPerDay = inputs.workingDays > 0 ? dialsNeeded / inputs.workingDays : 0;
  // Output, not an input: what the funnel rates force each dialer to work per day.
  const leadsPerDialerPerDay = inputs.dialers > 0 ? dialsNeededPerDay / inputs.dialers : 0;

  return {
    salesNeeded,
    pickupsNeeded,
    dialsNeeded,
    dialsNeededPerDay,
    leadsPerDialerPerDay,
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
