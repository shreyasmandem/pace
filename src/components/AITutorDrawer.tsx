import { useEffect, useRef, useState } from 'react';
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Zustand Store
  const chatMessages = usePaceStore((s) => s.tutorChats[topicKey] || []);
  const addTutorMessage = usePaceStore((s) => s.addTutorMessage);
  const clearTutorChat = usePaceStore((s) => s.clearTutorChat);

  // Manual note support (tied to current problem if present, or topicKey)
  const noteKey = currentProblem?.id || topicKey;
  const note = usePaceStore((s) => s.notes[noteKey] ?? '');
  const setNote = usePaceStore((s) => s.setNote);

  // Auto scroll to bottom of chat
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [chatMessages.length, tab]);

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

  // Starter prompts
  const starterPrompts = [
    {
      title: '💡 Core Intuition & Patterns',
      prompt: `What are the core mental models and algorithmic patterns I need to master for "${topicTitle}"?`,
    },
    ...(currentProblem
      ? [
          {
            title: `🎯 Hint for "${currentProblem.title}"`,
            prompt: `Give me a conceptual hint for solving "${currentProblem.title}" without giving away the full solution code.`,
          },
          {
            title: '⚡ Optimal Complexity',
            prompt: `What is the brute force vs optimal time & space complexity for "${currentProblem.title}", and what makes the optimal approach fast?`,
          },
        ]
      : [
          {
            title: '🪜 Step-by-Step Example Walkthrough',
            prompt: `Walk me through a classic problem in "${topicTitle}" with a clear step-by-step example trace.`,
          },
        ]),
    {
      title: '⚠️ Common Edge Cases & Traps',
      prompt: `What are the most frequent edge cases, bugs, or traps candidates fall into when solving "${topicTitle}" questions?`,
    },
  ];

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Drag Indicator */}
        <div className={styles.mobileHandle} />

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleArea}>
            <div className={styles.badgeRow}>
              <span className={styles.tutorBadge}>
                <Sparkles size={13} className={styles.sparkleIcon} />
                <span>AI Tutor</span>
              </span>
              <span className={styles.modelBadge}>Groq ⚡ LPU</span>
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
                title="AI Tutor"
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
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
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
                  <h4 className={styles.welcomeTitle}>Interactive DSA Tutor</h4>
                  <p className={styles.welcomeDesc}>
                    Tailored specifically to <strong>{topicTitle}</strong>. Ask for intuition,
                    hints, complexity analysis, or debugging advice. Conversations are saved for
                    this topic.
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
                        <div className={styles.messageAvatar}>
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
                      <div className={styles.messageAvatar}>
                        <Sparkles size={13} className={styles.pulsingIcon} />
                      </div>
                      <div className={styles.thinkingBubble}>
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                        <span className={styles.dot} />
                        <span className={styles.thinkingText}>Pace Tutor is thinking...</span>
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
                  placeholder={`Ask anything about ${topicTitle}... (Enter to send)`}
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
              <div className={styles.inputFooter}>
                <span>Powered by Groq LPU • Answers tailored to {topicTitle}</span>
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
      </div>
    </div>
  );
}
