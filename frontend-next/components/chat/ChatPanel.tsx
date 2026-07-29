"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Bot,
  User,
  FileText,
  ShieldCheck,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { useAppStore, type ChatMessage } from "@/lib/store";
import { streamQuery, type CitationInfo } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import VerificationDrawer from "./VerificationDrawer";

// ──────────────────────────────────────
// Chat Panel (main export)
// ──────────────────────────────────────

export default function ChatPanel() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    sessionId,
    messages,
    isQuerying,
    insights,
    selectedFileNames,
    addMessage,
    appendToMessage,
    updateMessage,
    setQuerying,
    setCurrentStreamingId,
    highlightCitation,
  } = useAppStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !sessionId || isQuerying) return;

    const question = input.trim();
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // Add user message
    const userMsgId = `user-${Date.now()}`;
    addMessage({
      id: userMsgId,
      role: "user",
      content: question,
      timestamp: new Date(),
    });

    // Add placeholder AI message
    const aiMsgId = `ai-${Date.now()}`;
    addMessage({
      id: aiMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date(),
    });

    setQuerying(true);
    setCurrentStreamingId(aiMsgId);

    try {
      // Build history from previous messages
      const history = messages
        .filter((m) => !m.isStreaming)
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const citations: CitationInfo[] = [];
      let confidence = 0;

      for await (const event of streamQuery(sessionId, question, history, selectedFileNames)) {
        switch (event.event) {
          case "token":
            appendToMessage(aiMsgId, event.data.text as string);
            break;
          case "citation":
            citations.push(event.data as unknown as CitationInfo);
            break;
          case "confidence":
            confidence = event.data.score as number;
            break;
          case "done":
            updateMessage(aiMsgId, {
              isStreaming: false,
              citations,
              confidence_score: confidence,
            });
            break;
          case "error":
            updateMessage(aiMsgId, {
              content:
                "Sorry, an error occurred while generating the response. Please try again.",
              isStreaming: false,
            });
            break;
        }
      }
    } catch (err) {
      updateMessage(aiMsgId, {
        content: `Error: ${err instanceof Error ? err.message : "Failed to get response"}`,
        isStreaming: false,
      });
    } finally {
      setQuerying(false);
      setCurrentStreamingId(null);
    }
  }, [
    input,
    sessionId,
    isQuerying,
    messages,
    addMessage,
    appendToMessage,
    updateMessage,
    setQuerying,
    setCurrentStreamingId,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <EmptyState
            suggestedQuestions={insights?.suggested_questions || []}
            onQuestionClick={handleSuggestedQuestion}
          />
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onCitationClick={highlightCitation}
                animationDelay={idx * 0.02}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested follow-ups */}
      {messages.length > 0 && !isQuerying && (
        <SuggestedFollowups
          messages={messages}
          onClick={handleSuggestedQuestion}
        />
      )}

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-white/6">
        <div className="flex items-end gap-2 p-2 rounded-xl glass-elevated">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your documents..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none py-1.5 px-2 max-h-[120px]"
            rows={1}
            disabled={isQuerying}
            id="chat-input"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isQuerying}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${
                input.trim() && !isQuerying
                  ? "bg-accent-primary text-midnight-950 hover:bg-accent-secondary"
                  : "bg-white/5 text-text-muted cursor-not-allowed"
              }
            `}
            id="send-button"
          >
            {isQuerying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="text-[10px] text-text-muted text-center mt-2 opacity-60">
          InsightPDF may make mistakes. Verify important information with the source document.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Message Bubble
// ──────────────────────────────────────

function MessageBubble({
  message,
  onCitationClick,
  animationDelay = 0,
}: {
  message: ChatMessage;
  onCitationClick: (citation: CitationInfo | null) => void;
  animationDelay?: number;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.3 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-accent-primary/15 flex items-center justify-center mt-0.5">
          <Bot className="w-4 h-4 text-accent-primary" />
        </div>
      )}

      <div
        className={`
          max-w-[85%] rounded-2xl px-4 py-3
          ${
            isUser
              ? "bg-accent-primary text-midnight-950 font-semibold rounded-br-md"
              : "glass rounded-bl-md"
          }
        `}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{message.content}</p>
        ) : (
          <>
            {message.content ? (
              <div className="text-sm markdown-content">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : message.isStreaming ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-primary/60 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-text-muted">Thinking...</span>
              </div>
            ) : null}

            {/* Streaming cursor */}
            {message.isStreaming && message.content && (
              <span className="inline-block w-0.5 h-4 bg-accent-primary animate-pulse ml-0.5 align-middle" />
            )}

            {/* Verification Drawer */}
            {message.citations && message.citations.length > 0 && !message.isStreaming && (
              <VerificationDrawer
                citations={message.citations}
                confidenceScore={message.confidence_score}
              />
            )}
          </>
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-text-secondary" />
        </div>
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────
// Empty State
// ──────────────────────────────────────

function EmptyState({
  suggestedQuestions,
  onQuestionClick,
}: {
  suggestedQuestions: string[];
  onQuestionClick: (q: string) => void;
}) {
  const displayQuestions = suggestedQuestions && suggestedQuestions.length > 0
    ? suggestedQuestions.slice(0, 4)
    : [
        "Summarize this document",
        "Compare the key findings",
        "Extract the primary risks",
        "Generate a project timeline",
      ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-8 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-accent-primary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-1">
          Ask anything
        </h3>
        <p className="text-sm text-text-muted mb-6 max-w-xs">
          Ask any question about your uploaded documents. I&apos;ll find the answer with source citations.
        </p>
      </motion.div>

      <div className="w-full max-w-md space-y-2">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2 text-center">
          Suggested Queries
        </p>
        {displayQuestions.map((q, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            onClick={() => onQuestionClick(q)}
            className="w-full text-left p-3 rounded-xl glass hover:glass-active
              text-sm text-text-secondary hover:text-text-primary
              transition-all duration-200 group flex items-center gap-2"
          >
            <MessageSquare className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary shrink-0 transition-colors" />
            <span className="line-clamp-2">{q}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Suggested Follow-ups
// ──────────────────────────────────────

function SuggestedFollowups({
  messages,
  onClick,
}: {
  messages: ChatMessage[];
  onClick: (q: string) => void;
}) {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isStreaming);

  // Simple follow-up suggestions based on context
  const suggestions = [
    "Can you elaborate on that?",
    "What are the key takeaways?",
    "Are there any risks mentioned?",
  ];

  if (!lastAssistant || lastAssistant.content.length < 50) return null;

  return (
    <div className="px-4 py-2 flex gap-2 overflow-x-auto">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onClick(s)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs text-text-muted
            border border-white/8 hover:border-accent-primary/30 hover:text-accent-secondary
            hover:bg-accent-primary/5 transition-all duration-200"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
