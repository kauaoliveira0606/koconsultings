import { getEcomSimulationGoals } from "@/lib/goals-ecom-simulation";

export const revalidate = 3600;

export async function GET() {
  return Response.json(await getEcomSimulationGoals());
}
