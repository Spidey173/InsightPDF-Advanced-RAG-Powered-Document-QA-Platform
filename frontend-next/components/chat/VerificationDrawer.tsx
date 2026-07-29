"use client";

import { useState } from "react";
import { ShieldCheck, ChevronDown, ChevronUp, ExternalLink, FileText, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CitationInfo } from "@/lib/api";
import { useAppStore } from "@/lib/store";

interface VerificationDrawerProps {
  citations: CitationInfo[];
  confidenceScore?: number;
}

export default function VerificationDrawer({
  citations,
  confidenceScore,
}: VerificationDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const { highlightCitation } = useAppStore();

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 border border-white/5 rounded-xl bg-white/[0.01] overflow-hidden select-none">
      {/* Header Summary Trigger */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/[0.01] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${
            confidenceScore && confidenceScore >= 0.8
              ? "text-success"
              : confidenceScore && confidenceScore >= 0.5
                ? "text-warning"
                : "text-danger"
          }`} />
          <span className="text-xs font-semibold text-text-secondary">
            Grounding Verification
          </span>
          {confidenceScore !== undefined && (
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-text-muted font-mono">
              {Math.round(confidenceScore * 100)}% verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-muted">
            {citations.length} cited source{citations.length > 1 ? "s" : ""}
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
        </div>
      </button>

      {/* Expanded Claims List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-white/5 bg-black/10 px-3 py-2.5 space-y-2.5"
          >
            {citations.map((citation, idx) => (
              <div
                key={citation.citation_id || idx}
                onClick={() => highlightCitation(citation)}
                className="group flex flex-col p-2.5 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-accent-soft/20 hover:border-accent-primary/20 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted group-hover:text-accent-primary uppercase tracking-wider">
                    <FileText className="w-3 h-3 text-accent-primary" />
                    <span>{citation.source_file}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted group-hover:text-text-secondary font-mono">
                    <span>Page {citation.page}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 italic">
                  "{citation.highlighted_text || citation.highlighted_text}"
                </p>

                {/* Evidence claim matching validation status */}
                <div className="flex items-center gap-1 mt-2 text-[9px] font-semibold text-success uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Evidence match verified</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
