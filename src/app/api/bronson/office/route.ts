import type { NextRequest } from "next/server";
import { getOffice, addTask, toggleTask, deleteTask, addPerson, deletePerson } from "@/lib/office";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getOffice();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = String(body.action ?? "");
  try {
    switch (action) {
      case "toggle":
        await toggleTask(String(body.id), Boolean(body.done));
        break;
      case "addTask":
        if (!body.task || !body.department || !body.role) return Response.json({ error: "Missing fields" }, { status: 400 });
        await addTask({
          task: String(body.task),
          description: body.description ? String(body.description) : "",
          department: String(body.department),
          role: String(body.role),
          assignee: body.assignee ? String(body.assignee) : "",
        });
        break;
      case "deleteTask":
        await deleteTask(String(body.id));
        break;
      case "addPerson":
        if (!body.name || !body.department || !body.role) return Response.json({ error: "Missing fields" }, { status: 400 });
        await addPerson({ name: String(body.name), department: String(body.department), role: String(body.role) });
        break;
      case "removePerson":
        await deletePerson(String(body.id));
        break;
      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Write failed" }, { status: 500 });
  }
  return Response.json(await getOffice());
}
