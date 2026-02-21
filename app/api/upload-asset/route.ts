import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { uploadObject } from "../../../lib/s3";
import connectDB from "../../../lib/db";
import { DB_CONFIG } from "../../../lib/config.mjs";
import { AssetSchema } from "../../../models/Asset";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const usedInPath = formData.get("usedInPath") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!usedInPath) {
      return NextResponse.json(
        { error: "No usedInPath provided" },
        { status: 400 }
      );
    }

    const originalFileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // id in S3
    const id = `public_assets/${Date.now()}_${originalFileName.replace(
      /[^a-zA-Z0-9.\-_]/g,
      "_"
    )}`;

    // Upload to S3
    const { url } = await uploadObject({
      body: buffer,
      contentType: file.type,
      id,
      overwritePush: true,
    });

    // Save to DB
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    const Asset =
      conn.models.Asset ||
      conn.model("Asset", AssetSchema, DB_CONFIG.COLLECTIONS.ASSETS);

    const asset = new Asset({
      originalFileName,
      usedInPath,
      objectId: id,
      url,
    });
    
    await asset.save();

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Error uploading asset:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
