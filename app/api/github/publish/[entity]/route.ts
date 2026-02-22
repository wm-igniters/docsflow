import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { publishWithAdapter } from "@/lib/services/PublishService";
import { releaseNotesPublishAdapter } from "@/lib/publish/adapters/releaseNotes";

const adapters: Record<string, any> = {
  "release-notes": releaseNotesPublishAdapter,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;
    const adapter = adapters[entity];
    if (!adapter) {
      return NextResponse.json(
        { error: `Unknown publish entity: ${entity}` },
        { status: 404 }
      );
    }

    const session = await auth();
    const user = {
      name: session?.user?.name || undefined,
      email: session?.user?.email || undefined,
    };

    const { docId } = await req.json().catch(() => ({ docId: null }));

    const result = await publishWithAdapter(adapter, {
      docId,
      user,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("❌ Generic Publish API Error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to publish to GitHub",
        details: error.response?.data,
      },
      { status: 500 }
    );
  }
}
