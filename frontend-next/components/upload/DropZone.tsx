"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { uploadDocuments, getInsights } from "@/lib/api";
import type { UploadedFile } from "@/lib/store";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DropZone() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    isUploading,
    uploadProgress,
    uploadStage,
    setSession,
    setUploading,
    setUploadProgress,
    setInsights,
    setLoadingInsights,
  } = useAppStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const valid = acceptedFiles.filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase();
        return ["pdf", "docx", "txt"].includes(ext || "");
      });
      if (valid.length === 0) {
        setError("Please upload PDF, DOCX, or TXT files.");
        return;
      }
      setSelectedFiles((prev) => [...prev, ...valid]);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0, "Uploading files...");
    setError(null);

    try {
      setUploadProgress(10, "Uploading to server...");

      const result = await uploadDocuments(selectedFiles, (progress) => {
        setUploadProgress(Math.min(progress * 0.4, 40), "Uploading files...");
      });

      setUploadProgress(50, "Processing documents...");

      const files: UploadedFile[] = selectedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));

      setUploadProgress(80, "Building search index...");
      setSession(result.session_id, files);

      setUploadProgress(90, "Generating insights...");

      // Fetch insights
      setLoadingInsights(true);
      try {
        const insights = await getInsights(result.session_id);
        setInsights(insights);
      } catch {
        // Insights are optional
      }

      setUploadProgress(100, "Complete!");
      setSelectedFiles([]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed p-12
          transition-all duration-300 group
          ${
            isDragActive
              ? "dropzone-active border-accent-primary bg-accent-primary/5"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          }
        `}
      >
        <input {...getInputProps()} id="file-upload-input" />

        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div
            animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={`
              p-4 rounded-2xl transition-colors duration-300
              ${isDragActive ? "bg-accent-primary/15" : "bg-white/5 group-hover:bg-white/8"}
            `}
          >
            <Upload
              className={`w-8 h-8 transition-colors ${
                isDragActive ? "text-accent-primary" : "text-text-muted group-hover:text-text-secondary"
              }`}
            />
          </motion.div>

          <div>
            <p className="text-lg font-medium text-text-primary mb-1">
              {isDragActive ? "Drop files here" : "Drop documents or click to browse"}
            </p>
            <p className="text-sm text-text-muted">
              Supports PDF, DOCX, TXT • Up to 50MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 p-3 rounded-xl glass"
              >
                <FileText className="w-5 h-5 text-accent-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </motion.div>
            ))}

            {/* Upload Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleUpload}
              disabled={isUploading}
              className={`
                w-full mt-4 py-3.5 px-6 rounded-xl font-bold text-sm
                flex items-center justify-center gap-2
                transition-all duration-300 shadow-lg
                ${
                  isUploading
                    ? "bg-accent-primary/20 text-accent-primary/50 cursor-not-allowed border border-accent-primary/10"
                    : "bg-accent-primary hover:bg-accent-secondary text-midnight-950 shadow-accent-primary/20 hover:shadow-accent-primary/35 border border-transparent"
                }
              `}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadStage || "Processing..."}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    Upload & Analyze{" "}
                    {selectedFiles.length === 1
                      ? "Document"
                      : `${selectedFiles.length} Documents`}
                  </span>
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <div className="flex justify-between text-xs text-text-muted mb-2">
              <span>{uploadStage}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20"
          >
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
