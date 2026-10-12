import { AVAL_BASE_ID } from "@/lib/airtable/tables-aval";
import { dataCheckDoneHandlers } from "@/lib/data-check-done";

export const dynamic = "force-dynamic";

export const { POST, DELETE } = dataCheckDoneHandlers(AVAL_BASE_ID, "tbl4OB9QFuYmJPu8a");
