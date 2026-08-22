import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, withErrorHandling } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

/** Einen sanft gelöschten Vorschlag wiederherstellen. */
export async function POST(_request: NextRequest, { params }: Params) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const proposal = await db.designProposal.findUnique({ where: { id } });
    if (!proposal) return jsonError("Vorschlag nicht gefunden.", 404);
    if (!proposal.deletedAt) {
      return NextResponse.json({ id: proposal.id, restored: false });
    }
    await db.designProposal.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json({ id: proposal.id, restored: true });
  });
}
