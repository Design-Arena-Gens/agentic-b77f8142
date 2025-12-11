import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSeoBundle } from "@/lib/seo";
import { uploadVideo, downloadRemoteVideo } from "@/lib/youtube";
import { CATEGORY_META } from "@/lib/categories";

const payloadSchema = z.object({
  sourceType: z.enum(["file", "link"]),
  category: z.enum(["tech", "vlog", "shorts", "gaming", "tutorial"]),
  language: z.string().min(2),
  monetization: z.enum(["enabled", "disabled"]),
  scheduleTime: z
    .string()
    .refine((value) => value === undefined || value === "" || !Number.isNaN(Date.parse(value)), {
      message: "Invalid schedule time",
    })
    .optional(),
  videoUrl: z.string().url().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bufferFromFile = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const deriveFileName = (fileNameOrUrl: string, fallback: string) => {
  if (!fileNameOrUrl) return fallback;
  try {
    const url = new URL(fileNameOrUrl);
    const pathname = url.pathname.split("/").filter(Boolean).pop();
    return pathname ?? fallback;
  } catch {
    return fileNameOrUrl;
  }
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const sourceType = formData.get("sourceType");
    const category = formData.get("category");
    const language = formData.get("language");
    const monetization = formData.get("monetization");
    const scheduleTimeRaw = formData.get("scheduleTime");
    const videoUrl = formData.get("videoUrl");

    const parsed = payloadSchema.safeParse({
      sourceType,
      category,
      language,
      monetization,
      scheduleTime: scheduleTimeRaw || undefined,
      videoUrl: videoUrl || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { data } = parsed;
    let videoBuffer: Buffer | null = null;
    let fileNameOrUrl = "";

    if (data.sourceType === "file") {
      const file = formData.get("videoFile");
      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Video file is required for uploads." },
          { status: 400 },
        );
      }
      videoBuffer = await bufferFromFile(file);
      fileNameOrUrl = file.name;
    } else {
      if (!data.videoUrl) {
        return NextResponse.json(
          { ok: false, error: "Video URL is required." },
          { status: 400 },
        );
      }
      videoBuffer = await downloadRemoteVideo(data.videoUrl);
      fileNameOrUrl = data.videoUrl;
    }

    if (!videoBuffer) {
      return NextResponse.json(
        { ok: false, error: "Failed to resolve video content." },
        { status: 500 },
      );
    }

    const scheduleUtc = data.scheduleTime ? new Date(data.scheduleTime).toISOString() : undefined;
    const seoBundle = generateSeoBundle({
      fileNameOrUrl,
      category: data.category,
      language: data.language,
      monetization: data.monetization,
    });

    const fileName = deriveFileName(fileNameOrUrl, "upload.mp4");
    const { youtubeCategoryId } = CATEGORY_META[data.category];

    const { videoId, publishAt } = await uploadVideo({
      videoBuffer,
      fileName,
      title: seoBundle.title,
      description: seoBundle.description,
      tags: seoBundle.tags,
      category: data.category,
      language: data.language,
      publishAt: scheduleUtc,
    });

    return NextResponse.json({
      ok: true,
      data: {
        videoId,
        title: seoBundle.title,
        description: seoBundle.description,
        tags: seoBundle.tags,
        hashtags: seoBundle.hashtags,
        thumbnailPrompt: seoBundle.thumbnailPrompt,
        publishAt: publishAt ?? null,
        categoryId: youtubeCategoryId,
      },
    });
  } catch (error) {
    console.error("Upload error", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
