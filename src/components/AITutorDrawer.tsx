import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  Check,
  Copy,
  GraduationCap,
  NotebookPen,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { usePaceStore } from '../state/store';
import { askGroqTutor, type TutorContext } from '../lib/groq';
import ErrorBoundary from './ErrorBoundary';
import styles from './AITutorDrawer.module.css';

export interface AITutorDrawerProps {
  topicKey: string;
  topicTitle: string;
  trackTitle?: string;
  companyName?: string;
  patternTip?: string;
  problems?: Array<{ id: string; title: string; difficulty: string }>;
  currentProblem?: {
    id: string;
    title: string;
    difficulty?: string;
    acceptance?: string;
    topics?: string[];
  } | null;
  onClose: () => void;
}

const EMPTY_MESSAGES: any[] = [];

export default function AITutorDrawer({
  topicKey,
  topicTitle,
  trackTitle,
  companyName,
  patternTip,
  problems,
  currentProblem,
  onClose,
}: AITutorDrawerProps) {
  const [tab, setTab] = useState<'tutor' | 'notes'>('tutor');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const closingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const historyPushedRef = useRef(false);
  const stateKeyRef = useRef<string>('');
  const touchStartRef = useRef<{ x: number; y: number; isLeftEdge: boolean } | null>(null);

  const THINKING_MESSAGES = [
    'Pacer is analyzing problem context...',
    'Synthesizing optimal Python approach...',
    'Checking edge cases & complexity...',
    'Drafting step-by-step guidance...',
  ];

  // Dynamic thinking step rotation
  useEffect(() => {
    if (!loading) {
      setThinkingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % THINKING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Handle close action (from UI button, backdrop, Escape key, or swipe gestures)
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);

    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      try {
        if (window.history.state?.pacerDrawer === stateKeyRef.current) {
          window.history.back();
        }
      } catch {
        // ignore
      }
    }

    closingTimeoutRef.current = setTimeout(() => {
      onCloseRef.current();
    }, 240);
  }, [isClosing]);

  // Push history state on mount so that the mobile back swipe pops this state instead of navigating to Home
  useEffect(() => {
    const key = 'pacer_' + Date.now();
    stateKeyRef.current = key;
    try {
      window.history.pushState({ pacerDrawer: key }, '', window.location.href);
      historyPushedRef.current = true;
    } catch {
      // ignore
    }

    const handlePopState = () => {
      // When user swipes back on mobile or clicks browser/hardware back button
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        setIsClosing(true);
        closingTimeoutRef.current = setTimeout(() => {
          onCloseRef.current();
        }, 240);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (closingTimeoutRef.current) {
        clearTimeout(closingTimeoutRef.current);
      }
      // Clean up history entry if unmounting without a popstate (e.g. parent unmount)
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        try {
          if (window.history.state?.pacerDrawer === stateKeyRef.current) {
            window.history.back();
          }
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Body scroll lock (mobile full-screen only)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isMobile = window.innerWidth <= 760;
    if (isMobile) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, []);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Touch handlers for mobile swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      isLeftEdge: touch.clientX < 70,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const isLeftEdge = touchStartRef.current.isLeftEdge;
    touchStartRef.current = null;

    // Swipe right to dismiss:
    // Started near left edge and moved right > 45px, or generic swipe right > 90px
    const isHorizontalSwipeRight =
      (isLeftEdge && deltaX > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) ||
      (deltaX > 90 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4);

    if (isHorizontalSwipeRight) {
      handleClose();
    }
  };

  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Swipe down on header / mobile handle > 50px
    if (deltaY > 50 && deltaY > Math.abs(deltaX) * 1.2) {
      touchStartRef.current = null;
      handleClose();
      return;
    }

    // Swipe right on header > 50px
    if (deltaX > 50 && deltaX > Math.abs(deltaY) * 1.2) {
      touchStartRef.current = null;
      handleClose();
      return;
    }
  };

  // Zustand Store - safe defensive access with stable EMPTY_MESSAGES fallback
  const chatMessages = usePaceStore((s) => s.tutorChats?.[topicKey] ?? EMPTY_MESSAGES);
  const addTutorMessage = usePaceStore((s) => s.addTutorMessage);
  const clearTutorChat = usePaceStore((s) => s.clearTutorChat);

  // Manual note support (tied to current problem if present, or topicKey)
  const noteKey = currentProblem?.id || topicKey;
  const note = usePaceStore((s) => (s.notes && s.notes[noteKey]) ?? '');
  const setNote = usePaceStore((s) => s.setNote);

  // Auto scroll to bottom of chat
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [chatMessages.length, tab]);

  useEffect(() => {
    if (loading) {
      scrollToBottom(true);
    }
  }, [loading, thinkingStep]);

  useEffect(() => {
    if (tab === 'tutor') {
      textareaRef.current?.focus();
    } else {
      notesTextareaRef.current?.focus();
    }
  }, [tab]);

  // Context passed to Groq
  const tutorContext: TutorContext = {
    topicTitle,
    trackTitle,
    companyName,
    patternTip,
    problems: problems?.map((p) => ({ title: p.title, difficulty: p.difficulty })),
    currentProblem,
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || loading) return;

    setInput('');
    setError(null);

    // Add user message to state
    addTutorMessage(topicKey, { role: 'user', content: messageContent });

    setLoading(true);
    try {
      // Build history
      const history = [...chatMessages, { role: 'user' as const, content: messageContent }];
      const assistantReply = await askGroqTutor(tutorContext, history, messageContent);

      addTutorMessage(topicKey, { role: 'assistant', content: assistantReply });
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to AI Tutor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render markdown text and code blocks cleanly
  const renderFormattedContent = (content: string) => {
    if (!content || typeof content !== 'string') return null;
    try {
      // Split by code blocks ```lang ... ```
      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      const parts: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let blockCounter = 0;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        // Text before code block
        if (match.index > lastIndex) {
          const textSegment = content.slice(lastIndex, match.index);
          parts.push(
            <div key={`text-${lastIndex}`} className={styles.textBlock}>
              {renderInlineMarkdown(textSegment)}
            </div>
          );
        }

        const lang = match[1] || 'code';
        const code = match[2];
        const codeIndex = blockCounter++;

        parts.push(
          <div key={`code-${codeIndex}`} className={styles.codeBlockWrapper}>
            <div className={styles.codeBlockHeader}>
              <span className={styles.codeBlockLang}>{lang}</span>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopyCode(code, codeIndex)}
                title="Copy code"
              >
                {copiedIndex === codeIndex ? (
                  <>
                    <Check size={12} className={styles.copyCheck} />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className={styles.codePre}>
              <code>{code}</code>
            </pre>
          </div>
        );

        lastIndex = match.index + match[0].length;
      }

      if (lastIndex < content.length) {
        parts.push(
          <div key={`text-end`} className={styles.textBlock}>
            {renderInlineMarkdown(content.slice(lastIndex))}
          </div>
        );
      }

      return parts;
    } catch {
      return (
        <div className={styles.textBlock}>
          <p className={styles.paragraph}>{content}</p>
        </div>
      );
    }
  };

  // Inline formatting helper
  const renderInlineMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      // Headers
      if (line.startsWith('### ')) {
        return <h4 key={lIdx} className={styles.h4}>{line.slice(4)}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={lIdx} className={styles.h3}>{line.slice(3)}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={lIdx} className={styles.h2}>{line.slice(2)}</h2>;
      }
      // List items
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={lIdx} className={styles.listItem}>
            {formatBoldAndCode(line.slice(2))}
          </li>
        );
      }
      if (/^\d+\.\s/.test(line)) {
        return (
          <li key={lIdx} className={styles.numberedItem}>
            {formatBoldAndCode(line.replace(/^\d+\.\s/, ''))}
          </li>
        );
      }
      if (!line.trim()) {
        return <div key={lIdx} className={styles.spacer} />;
      }
      return <p key={lIdx} className={styles.paragraph}>{formatBoldAndCode(line)}</p>;
    });
  };

  const formatBoldAndCode = (str: string) => {
    const segments = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return <code key={i} className={styles.inlineCode}>{seg.slice(1, -1)}</code>;
      }
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={i} className={styles.bold}>{seg.slice(2, -2)}</strong>;
      }
      return seg;
    });
  };

  // Starter prompts tailored for Python DSA
  const starterPrompts = [
    {
      title: '🐍 Python Intuition & Pattern',
      prompt: `What are the core mental models and algorithmic patterns I need to master for "${topicTitle}" in Python 3?`,
    },
    ...(currentProblem
      ? [
          {
            title: `💡 Hint for "${currentProblem.title}"`,
            prompt: `Give me a conceptual hint for solving "${currentProblem.title}" in Python without giving away the full solution code yet.`,
          },
          {
            title: '⚡ Python 3 Complexity & Tools',
            prompt: `What is the optimal time & space complexity for "${currentProblem.title}", and what Python data structures make it optimal?`,
          },
        ]
      : [
          {
            title: '🪜 Step-by-Step Python Walkthrough',
            prompt: `Walk me through a classic problem in "${topicTitle}" with a clear step-by-step example trace in Python.`,
          },
        ]),
    {
      title: '⚠️ Python Gotchas & Traps',
      prompt: `What are the most frequent edge cases, index traps, and Python-specific gotchas candidates fall into when solving "${topicTitle}" questions?`,
    },
  ];

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${styles.backdrop} ${isClosing ? styles.backdropClosing : ''}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.panel} ${isClosing ? styles.panelClosing : ''}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        <ErrorBoundary fallbackTitle="Pacer encountered an error" onReset={handleClose}>
        {/* Mobile Drag Indicator */}
        <div className={styles.mobileHandle} onTouchEnd={handleHeaderTouchEnd} />

        {/* Header */}
        <div className={styles.header} onTouchEnd={handleHeaderTouchEnd}>
          <div className={styles.headerTitleArea}>
            <div className={styles.badgeRow}>
              <span className={styles.tutorBadge}>
                <Sparkles size={13} className={styles.sparkleIcon} />
                <span>Pacer</span>
              </span>
            </div>
            <h3 className={styles.title} title={topicTitle}>
              {topicTitle}
            </h3>
            {currentProblem && (
              <div className={styles.problemTag}>
                <span>Problem:</span> <strong>{currentProblem.title}</strong>
              </div>
            )}
          </div>

          <div className={styles.headerControls}>
            {/* Tab switch between AI Tutor & manual notes */}
            <div className={styles.tabToggle}>
              <button
                className={`${styles.tabBtn} ${tab === 'tutor' ? styles.tabActive : ''}`}
                onClick={() => setTab('tutor')}
                title="Pacer AI Tutor"
              >
                <Bot size={14} />
              </button>
              <button
                className={`${styles.tabBtn} ${tab === 'notes' ? styles.tabActive : ''}`}
                onClick={() => setTab('notes')}
                title="Personal Notes"
              >
                <NotebookPen size={14} />
              </button>
            </div>

            {/* Clear Chat Button */}
            {tab === 'tutor' && chatMessages.length > 0 && (
              <button
                className={styles.iconBtn}
                onClick={() => {
                  if (confirmClear) {
                    clearTutorChat(topicKey);
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 3000);
                  }
                }}
                title={confirmClear ? 'Click again to confirm clear' : 'Reset chat'}
              >
                <RotateCcw size={14} className={confirmClear ? styles.clearConfirmIcon : ''} />
              </button>
            )}

            {/* Close Button */}
            <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
              <X size={17} />
            </button>
          </div>
        </div>

        {tab === 'tutor' ? (
          <>
            {/* Messages Thread */}
            <div className={styles.thread}>
              {chatMessages.length === 0 ? (
                <div className={styles.welcomeContainer}>
                  <div className={styles.welcomeIconWrapper}>
                    <GraduationCap size={28} />
                  </div>
                  <h4 className={styles.welcomeTitle}>Meet Pacer</h4>
                  <p className={styles.welcomeDesc}>
                    Your dedicated DSA mentor tailored to <strong>{topicTitle}</strong>. Ask
                    for intuition, step-by-step hints, complexity trade-offs, or debugging.
                    Conversations are automatically saved.
                  </p>

                  <div className={styles.starterPromptGrid}>
                    <span className={styles.starterLabel}>Quick prompts:</span>
                    {starterPrompts.map((p, idx) => (
                      <button
                        key={idx}
                        className={styles.starterChip}
                        onClick={() => handleSendMessage(p.prompt)}
                      >
                        {p.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={styles.messageList}>
                  {chatMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div
                        key={msg.id || idx}
                        className={`${styles.messageWrapper} ${
                          isUser ? styles.messageUser : styles.messageAssistant
                        }`}
                      >
                        <div className={styles.messageAvatar} title={isUser ? 'You' : 'Pacer'}>
                          {isUser ? <span>You</span> : <Sparkles size={13} />}
                        </div>
                        <div className={styles.messageBubble}>
                          {isUser ? (
                            <p className={styles.userText}>{msg.content}</p>
                          ) : (
                            renderFormattedContent(msg.content)
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {loading && (
                    <div className={`${styles.messageWrapper} ${styles.messageAssistant}`}>
                      <div className={styles.messageAvatar} title="Pacer">
                        <Sparkles size={14} className={styles.pulsingIcon} />
                      </div>
                      <div className={styles.thinkingBubble}>
                        <div className={styles.dotsWave}>
                          <span className={styles.dot} />
                          <span className={styles.dot} />
                          <span className={styles.dot} />
                        </div>
                        <span className={styles.thinkingText}>
                          {THINKING_MESSAGES[thinkingStep]}
                        </span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className={styles.errorBanner}>
                      <span>{error}</span>
                      <button
                        className={styles.retryBtn}
                        onClick={() => handleSendMessage()}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Bar */}
            <div className={styles.inputArea}>
              <div className={styles.inputContainer}>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask Pacer anything about ${topicTitle}... (Enter to send)`}
                />
                <button
                  className={`${styles.sendBtn} ${input.trim() && !loading ? styles.sendBtnActive : ''}`}
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Manual Notes fallback tab */
          <div className={styles.notesContainer}>
            <div className={styles.notesHeader}>
              <span className={styles.notesTitle}>
                {currentProblem ? currentProblem.title : topicTitle}
              </span>
            </div>
            <textarea
              ref={notesTextareaRef}
              className={styles.notesTextarea}
              value={note}
              onChange={(e) => setNote(noteKey, e.target.value)}
              placeholder="Record your own insights, tricky edge cases, or your personal solution link..."
            />
            <div className={styles.notesFooter}>
              Saved automatically to this browser.
            </div>
          </div>
        )}
        </ErrorBoundary>
      </div>
    </div>,
    document.body
  );
}
