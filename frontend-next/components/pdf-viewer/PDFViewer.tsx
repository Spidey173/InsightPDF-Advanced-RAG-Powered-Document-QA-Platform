"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getPdfUrl } from "@/lib/api";

export default function PDFViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 2) return;
    const container = containerRef.current;
    if (!container) return;
    isDragging.current = true;
    startX.current = e.pageX - container.offsetLeft;
    startY.current = e.pageY - container.offsetTop;
    scrollLeft.current = container.scrollLeft;
    scrollTop.current = container.scrollTop;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = x - startX.current;
    const walkY = y - startY.current;
    container.scrollLeft = scrollLeft.current - walkX;
    container.scrollTop = scrollTop.current - walkY;
  };

  const handleMouseUpOrLeave = () => {
    isDragging.current = false;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [rendering, setRendering] = useState(false);
  const [pdfLib, setPdfLib] = useState<any>(null);

  const {
    sessionId,
    files,
    activeDocumentName,
    currentPage,
    totalPages,
    pdfScale,
    highlightedCitation,
    setCurrentPage,
    setTotalPages,
    setPdfScale,
  } = useAppStore();

  // Keep track of scale in ref for high-performance event listeners
  const scaleRef = useRef(pdfScale);
  useEffect(() => {
    scaleRef.current = pdfScale;
  }, [pdfScale]);

  // Trackpad pinch-to-zoom listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005;
        const nextScale = Math.min(Math.max(scaleRef.current + delta, 0.5), 1.5);
        setPdfScale(nextScale);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [setPdfScale]);

  // Touch screen pinch-to-zoom
  const lastTouchDistance = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      lastTouchDistance.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const factor = dist / lastTouchDistance.current;
      const delta = (factor - 1) * 0.15;
      const nextScale = Math.min(Math.max(scaleRef.current + delta, 0.5), 1.5);
      setPdfScale(nextScale);
      lastTouchDistance.current = dist;
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistance.current = null;
  };

  // Load PDF.js library
  useEffect(() => {
    async function loadPdfJs() {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;
      setPdfLib(pdfjsLib);
    }
    loadPdfJs();
  }, []);

  // Load PDF document dynamically when active document changes
  useEffect(() => {
    if (!pdfLib || !sessionId || !activeDocumentName) return;

    async function loadPdf() {
      try {
        const url = getPdfUrl(sessionId!, activeDocumentName!);
        const doc = await pdfLib.getDocument({ url }).promise;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    }

    loadPdf();
  }, [pdfLib, sessionId, activeDocumentName, files, setTotalPages]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || rendering) return;
    setRendering(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: pdfScale * 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;
    } catch (err) {
      console.error("Failed to render page:", err);
    } finally {
      setRendering(false);
    }
  }, [pdfDoc, currentPage, pdfScale, rendering]);

  useEffect(() => {
    renderPage();
  }, [pdfDoc, currentPage, pdfScale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate on citation highlight
  useEffect(() => {
    if (highlightedCitation) {
      setCurrentPage(highlightedCitation.page);
    }
  }, [highlightedCitation, setCurrentPage]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const zoomIn = () => setPdfScale(Math.min(pdfScale + 0.1, 1.5));
  const zoomOut = () => setPdfScale(Math.max(pdfScale - 0.1, 0.5));
  const fitWidth = () => setPdfScale(1.0);

  if (!sessionId) return null;

  if (!activeDocumentName) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-midnight-950">
        <FileText className="w-10 h-10 text-text-muted mb-3 opacity-40 animate-pulse" />
        <p className="text-sm text-text-muted font-medium">
          Select a document from the Left Sidebar to begin reading
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-midnight-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/6 bg-surface-primary/80 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-10 text-center text-xs bg-white/5 border border-white/10 rounded px-1 py-0.5 focus:outline-none focus:border-accent-primary"
              min={1}
              max={totalPages}
            />
            <span className="text-xs text-text-muted">/ {totalPages}</span>
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs text-text-muted px-1 min-w-[3rem] text-center">
            {Math.round(pdfScale * 100)}%
          </span>

          <button
            onClick={zoomIn}
            className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            onClick={fitWidth}
            className="p-1.5 rounded-lg hover:bg-white/8 transition-colors"
            title="Fit width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-auto flex p-4 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="relative m-auto">
          <canvas
            ref={canvasRef}
            className="shadow-2xl rounded-sm"
            style={{ background: "white" }}
          />

          {/* Citation highlight overlay */}
          <AnimatePresence>
            {highlightedCitation && highlightedCitation.page === currentPage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                <div className="absolute top-[10%] left-[5%] right-[5%] h-[20%] citation-highlight rounded" />
              </motion.div>
            )}
          </AnimatePresence>

          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-midnight-950/50">
              <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Page Thumbnails (bottom strip) */}
      {totalPages > 0 && totalPages <= 50 && (
        <div className="flex items-center gap-1 px-4 py-2 border-t border-white/6 overflow-x-auto bg-surface-primary/80">
          {Array.from({ length: Math.min(totalPages, 20) }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => goToPage(i + 1)}
              className={`
                min-w-[2rem] h-7 rounded text-xs font-medium transition-all
                ${
                  currentPage === i + 1
                    ? "bg-accent-primary text-midnight-950 font-bold"
                    : "bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-secondary"
                }
              `}
            >
              {i + 1}
            </button>
          ))}
          {totalPages > 20 && (
            <span className="text-xs text-text-muted px-2">
              +{totalPages - 20} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AnimatePresence({ children }: { children: React.ReactNode }) {
  // Simple wrapper — actual AnimatePresence from framer-motion
  // is used inline above; this is for the overlay only
  return <>{children}</>;
}
