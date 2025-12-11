"use client";

import { useMemo, useState } from "react";
import { generateSeoBundle } from "@/lib/seo";
import type { VideoCategory } from "@/lib/types";

type MonetizationSetting = "enabled" | "disabled";

type UploadSummary = {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
  thumbnailPrompt?: string;
  publishAt: string | null;
};

const CATEGORY_LABELS: Record<VideoCategory, string> = {
  tech: "Tech",
  vlog: "Vlog",
  shorts: "Shorts",
  gaming: "Gaming",
  tutorial: "Tutorial",
};

export const UploadForm = () => {
  const [sourceType, setSourceType] = useState<"file" | "link">("file");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState<VideoCategory>("tech");
  const [language, setLanguage] = useState("English");
  const [monetization, setMonetization] = useState<MonetizationSetting>("enabled");
  const [scheduleTime, setScheduleTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);

  const preview = useMemo(() => {
    const fileNameOrUrl = sourceType === "file" ? videoFile?.name ?? "" : videoUrl;
    if (!fileNameOrUrl) {
      return null;
    }
    return generateSeoBundle({
      fileNameOrUrl,
      category,
      language,
      monetization,
    });
  }, [sourceType, videoFile, videoUrl, category, language, monetization]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSummary(null);

    if (sourceType === "file" && !videoFile) {
      setError("Please select a video file to upload.");
      return;
    }

    if (sourceType === "link" && !videoUrl) {
      setError("Please provide a valid video link.");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("sourceType", sourceType);
      formData.append("category", category);
      formData.append("language", language);
      formData.append("monetization", monetization);
      if (scheduleTime) {
        formData.append("scheduleTime", scheduleTime);
      }
      if (sourceType === "file" && videoFile) {
        formData.append("videoFile", videoFile);
      }
      if (sourceType === "link") {
        formData.append("videoUrl", videoUrl);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Upload failed. Please try again.");
        return;
      }

      setSummary(payload.data as UploadSummary);
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Unexpected error occurred.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <form className="form" onSubmit={handleSubmit}>
        <div className="header">
          <h1>YouTube Upload Agent</h1>
          <p>Provide your source and preferences. We handle the SEO and publishing.</p>
        </div>

        <div className="field-group">
          <label>Video Source</label>
          <div className="source-toggle">
            <button
              type="button"
              className={sourceType === "file" ? "toggle active" : "toggle"}
              onClick={() => setSourceType("file")}
            >
              Upload File
            </button>
            <button
              type="button"
              className={sourceType === "link" ? "toggle active" : "toggle"}
              onClick={() => setSourceType("link")}
            >
              Use Link
            </button>
          </div>
          {sourceType === "file" ? (
            <input
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setVideoFile(file ?? null);
              }}
              required
            />
          ) : (
            <input
              type="url"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              required
            />
          )}
        </div>

        <div className="field-grid">
          <div className="field-group">
            <label>Category</label>
            <select value={category} onChange={(event) => setCategory(event.target.value as VideoCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label>Language</label>
            <input
              type="text"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              placeholder="English"
              required
            />
          </div>

          <div className="field-group">
            <label>Monetization</label>
            <select
              value={monetization}
              onChange={(event) => setMonetization(event.target.value as MonetizationSetting)}
            >
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>

          <div className="field-group">
            <label>Schedule (optional)</label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(event) => setScheduleTime(event.target.value)}
            />
          </div>
        </div>

        <button className="submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Uploading..." : "Generate & Upload"}
        </button>

        {error ? <p className="error">{error}</p> : null}

        {preview ? (
          <div className="preview">
            <h2>SEO Blueprint</h2>
            <p className="preview-title">{preview.title}</p>
            <p>{preview.description}</p>
            <div className="preview-tags">
              {preview.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="summary">
            <h2>Upload Summary</h2>
            <p><strong>Video ID:</strong> {summary.videoId}</p>
            <p><strong>Title:</strong> {summary.title}</p>
            <p><strong>Description:</strong></p>
            <pre>{summary.description}</pre>
            <p><strong>Tags:</strong> {summary.tags.join(", ")}</p>
            <p><strong>Hashtags:</strong> {summary.hashtags.join(" ")}</p>
            {summary.thumbnailPrompt ? (
              <p>
                <strong>Thumbnail Prompt:</strong> {summary.thumbnailPrompt}
              </p>
            ) : null}
            {summary.publishAt ? (
              <p>
                <strong>Scheduled Publish:</strong> {new Date(summary.publishAt).toLocaleString()}
              </p>
            ) : (
              <p><strong>Publish Status:</strong> Live on upload</p>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
};
