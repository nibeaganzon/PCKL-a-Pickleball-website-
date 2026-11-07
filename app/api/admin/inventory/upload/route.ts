import { requireAdmin } from "@/lib/admin-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.user) return authorization.response;

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = formData.get("kind");

    if (!(file instanceof File)) {
      return Response.json(
        { message: "No image file provided." },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type) && !file.type.startsWith("image/")) {
      return Response.json(
        { message: "Choose a valid picture file (JPG, PNG, GIF, WebP)." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { message: "Image size exceeds 10 MB limit." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some(
      (b) => b.id === "inventory" || b.name === "inventory"
    );
    if (!hasBucket) {
      const { error: createError } = await supabase.storage.createBucket(
        "inventory",
        { public: true }
      );
      if (createError && !createError.message.includes("already exists")) {
        console.error("Failed to create inventory bucket:", createError);
      }
    }

    const folder = kind === "equipment" ? "equipment" : "courts";
    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : file.type === "image/gif"
              ? "gif"
              : file.name.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `${folder}/${crypto.randomUUID()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("inventory")
      .upload(fileName, buffer, {
        contentType: file.type || "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return Response.json(
        { message: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("inventory").getPublicUrl(fileName);

    return Response.json({
      url: publicUrl,
      path: fileName,
    });
  } catch (error) {
    console.error("Error uploading inventory image:", error);
    return Response.json(
      { message: "Failed to upload image." },
      { status: 500 }
    );
  }
}
