import { NextResponse } from "next/server";
import { getAllCategories, addCategory, deleteCategory, deleteTasksByCategory, getAppState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, categories: getAllCategories() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      name?: string;
      color?: string;
      icon?: string;
      categoryId?: string;
      deleteTasks?: boolean;
    };
    const { action } = body;

    if (action === "add") {
      const name = body.name?.trim();
      if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
      const cat = addCategory(name, body.color, body.icon);
      return NextResponse.json({ ok: true, category: cat, state: getAppState() });
    }

    if (action === "delete") {
      const { categoryId, deleteTasks } = body;
      if (!categoryId) return NextResponse.json({ ok: false, error: "Missing categoryId" }, { status: 400 });
      if (deleteTasks) deleteTasksByCategory(categoryId);
      deleteCategory(categoryId);
      return NextResponse.json({ ok: true, state: getAppState() });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
