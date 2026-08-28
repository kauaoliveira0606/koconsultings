import { createAirtableTables, type TableIds } from "./tables";

export const ECOM_SIMULATION_BASE_ID = "appgcEYqudlGfqBjE"; // "Andy - Ecom" base

export const ECOM_SIMULATION_TABLE_IDS: TableIds = {
  leads: "tblpFVOkddRGgm5rI",
  marketingDailyMetrics: "tblRdiOjEHQgth0TN",
  eodDialer: "tblWm3TRktDt075ih", // shared cross-offer rep log, same table as Bronson
  eodCloser: "tbl0xIvtCZIjemZRZ", // shared cross-offer rep log, same table as Bronson
  speedToLead: "tblQc86rJh5uiAP0E", // created to mirror Bronson's Speed to Lead
  leaderboard: "tblqmFNXfaSuEI4n5", // created to mirror Bronson's Leaderboard
};

export const {
  getLeads,
  getMarketingDailyMetrics,
  getEodDialer,
  getSpeedToLead,
  getLeaderboard,
} = createAirtableTables(ECOM_SIMULATION_BASE_ID, ECOM_SIMULATION_TABLE_IDS);
