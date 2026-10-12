import { BRONSON_BASE_ID } from "@/lib/airtable/tables";
import { dataCheckDoneHandlers } from "@/lib/data-check-done";

export const dynamic = "force-dynamic";

export const { POST, DELETE } = dataCheckDoneHandlers(BRONSON_BASE_ID, "tbl8JD9XLp4NwGjbc");
