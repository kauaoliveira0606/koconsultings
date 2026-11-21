import { getAaronGoals } from "@/lib/goals-aaron";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getAaronGoals());
}
