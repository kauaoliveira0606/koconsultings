import { getGoals } from "@/lib/goals";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getGoals());
}
