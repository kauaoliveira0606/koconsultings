import { getAvalGoals } from "@/lib/goals-aval";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getAvalGoals());
}
