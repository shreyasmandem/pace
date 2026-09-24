import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Check,
  ChevronDown,
  Lightbulb,
  RotateCcw,
  Search,
  Sparkles,
  ExternalLink,
  X,
} from 'lucide-react';
import { COMPANIES, fetchCompanyProblems, getCompanyMeta } from '../data';
import { usePaceStore } from '../state/store';
import type { CompanyProblem } from '../types';
import Lane from '../components/Lane';
import AITutorDrawer from '../components/AITutorDrawer';
import ConfirmDialog from '../components/ConfirmDialog';
import ResourceLinks from '../components/ResourceLinks';
import { noteUserSolveIntent } from '../lib/celebrate';
import styles from './CompanySheet.module.css';

const TOP_TECH = [
  { id: 'google', name: 'Google' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'meta', name: 'Meta' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'apple', name: 'Apple' },
  { id: 'netflix', name: 'Netflix' },
  { id: 'uber', name: 'Uber' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'goldmansachs', name: 'Goldman Sachs' },
  { id: 'flipkart', name: 'Flipkart' },
  { id: 'tcs', name: 'TCS' },
  { id: 'infosys', name: 'Infosys' },
];

const ALL_COMPANIES_SORTED = [...COMPANIES].sort((a, b) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
);

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const STATUSES = ['All', 'Solved', 'Unsolved'];
const PAGE_SIZE = 50;

export default function CompanySheet() {
  const { companyId } = useParams<{ companyId?: string }>();
  const navigate = useNavigate();

  // Selected company id
  const currentCompanyId = companyId && getCompanyMeta(companyId) ? companyId : 'google';
  const companyMeta = getCompanyMeta(currentCompanyId) || COMPANIES[0];

  const [problems, setProblems] = useState<CompanyProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');
  const [timeframe, setTimeframe] = useState('All');
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  // Combobox state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [tutorProblem, setTutorProblem] = useState<CompanyProblem | null>(null);
  const [companyTutorOpen, setCompanyTutorOpen] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const handleCloseTutor = useCallback(() => {
    setTutorProblem(null);
    setCompanyTutorOpen(false);
  }, []);

  // Store
  const progress = usePaceStore((s) => s.progress);
  const toggleProblem = usePaceStore((s) => s.toggleProblem);
  const notes = usePaceStore((s) => s.notes);
  const bookmarks = usePaceStore((s) => s.bookmarks);
  const toggleBookmark = usePaceStore((s) => s.toggleBookmark);
  const resetTrack = usePaceStore((s) => s.resetTrack);
  const tutorChats = usePaceStore((s) => s.tutorChats);

  // Fetch company problems when currentCompanyId changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setDisplayLimit(PAGE_SIZE);
    setQuery('');
    setDifficulty('All');
    setStatus('All');
    setTimeframe('All');

    fetchCompanyProblems(currentCompanyId)
      .then((data) => {
        if (active) {
          setProblems(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentCompanyId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Available timeframes for this company
  const availableTimeframes = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) {
      if (p.timeframe && p.timeframe !== 'All Time') {
        set.add(p.timeframe);
      }
    }
    if (set.size > 0) {
      return ['All', ...Array.from(set)];
    }
    return [];
  }, [problems]);

  // Solved counts
  const stats = useMemo(() => {
    let solved = 0;
    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    for (const p of problems) {
      if (progress[p.id]) {
        solved++;
        if (p.difficulty === 'Easy') easySolved++;
        else if (p.difficulty === 'Hard') hardSolved++;
        else mediumSolved++;
      }
    }

    const total = problems.length;
    const percent = total > 0 ? (solved / total) * 100 : 0;

    return {
      total,
      solved,
      percent,
      easy: { solved: easySolved, total: companyMeta.easy },
      medium: { solved: mediumSolved, total: companyMeta.medium },
      hard: { solved: hardSolved, total: companyMeta.hard },
    };
  }, [problems, progress, companyMeta]);

  // Filtered problems
  const filteredProblems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      if (q) {
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchTopic = p.topics.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchTopic) return false;
      }
      if (difficulty !== 'All' && p.difficulty !== difficulty) return false;
      if (timeframe !== 'All' && p.timeframe !== timeframe) return false;

      const isSolved = !!progress[p.id];
      if (status === 'Solved' && !isSolved) return false;
      if (status === 'Unsolved' && isSolved) return false;

      return true;
    });
  }, [problems, query, difficulty, timeframe, status, progress]);

  // Visible page slice
  const visibleProblems = useMemo(() => {
    return filteredProblems.slice(0, displayLimit);
  }, [filteredProblems, displayLimit]);

  // Filtered company list for dropdown (alphabetical order, all 500+ companies)
  const dropdownCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return ALL_COMPANIES_SORTED;
    return ALL_COMPANIES_SORTED.filter(
      (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    );
  }, [companySearch]);

  const selectCompany = (id: string) => {
    setDropdownOpen(false);
    setCompanySearch('');
    navigate(`/company/${id}`);
  };

  const handleResetCompany = () => {
    const ids = problems.map((p) => p.id);
    resetTrack(ids);
    setConfirmingReset(false);
  };

  return (
    <div className={styles.page}>
      {/* Quick Pills & Company Selector */}
      <div className={styles.selectorContainer}>
        <div className={styles.selectorTop}>
          <span className={styles.selectorLabel}>Company Questions</span>
          <div className={styles.comboboxWrapper} ref={dropdownRef}>
            <button
              className={styles.comboboxTrigger}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Choose Company"
            >
              <span>{companyMeta.name}</span>
              <ChevronDown size={16} />
            </button>

            {dropdownOpen && (
              <>
                <div
                  className={styles.dropdownBackdrop}
                  onClick={() => setDropdownOpen(false)}
                />
                <div className={styles.comboboxDropdown} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.mobileHandle} />
                  <div className={styles.dropdownHeader}>
                    <div className={styles.dropdownSearch}>
                      <Search size={14} className={styles.dropdownSearchIcon} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search 500+ companies..."
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                      />
                      {companySearch && (
                        <button
                          type="button"
                          className={styles.dropdownClearBtn}
                          onClick={() => setCompanySearch('')}
                          aria-label="Clear company search"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      className={styles.dropdownCloseBtn}
                      onClick={() => setDropdownOpen(false)}
                      aria-label="Close company list"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.dropdownList}>
                    {dropdownCompanies.map((c) => (
                      <button
                        key={c.id}
                        className={`${styles.dropdownItem} ${
                          c.id === currentCompanyId ? styles.dropdownItemActive : ''
                        }`}
                        onClick={() => selectCompany(c.id)}
                      >
                        <span>{c.name}</span>
                        <span className={`${styles.dropdownItemTotal} mono`}>{c.total} q</span>
                      </button>
                    ))}
                    {dropdownCompanies.length === 0 && (
                      <div className={styles.empty}>No matching companies found</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Pills for Top Tech */}
        <div className={styles.quickPills}>
          {TOP_TECH.map((t) => (
            <button
              key={t.id}
              className={`${styles.quickPill} ${
                currentCompanyId === t.id ? styles.quickPillActive : ''
              }`}
              onClick={() => selectCompany(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Hero Header */}
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{companyMeta.name}</h1>
            <button
              className={styles.companyTutorBtn}
              onClick={() => setCompanyTutorOpen(true)}
              title={`Ask Pacer about ${companyMeta.name} interview questions`}
            >
              <Sparkles size={13} />
              <span>Ask Pacer</span>
            </button>
          </div>
          <p className={styles.subtitle}>
            Most frequently asked coding interview problems, verified across candidate assessments.
          </p>
          {companyMeta.interviewTip && (
            <div className={styles.patternTip}>
              <Lightbulb size={16} className={styles.patternTipIcon} />
              <div className={styles.patternTipText}>
                <strong>Interview Pattern Focus:</strong> {companyMeta.interviewTip}
              </div>
            </div>
          )}
        </div>

        <div className={styles.heroStat}>
          <span className={`${styles.heroFigure} numeric`}>{Math.round(stats.percent)}%</span>
          <span className={styles.heroFraction}>
            <span className="numeric">{stats.solved}</span> of <span className="numeric">{stats.total}</span> solved
          </span>
          <Lane percent={stats.percent} color="var(--accent)" size="lg" />
          <div className={styles.difficultyBreakdown}>
            <span className={styles.diffEasy}>
              Easy <span className="mono">{stats.easy.solved}/{stats.easy.total}</span>
            </span>
            <span className={styles.diffMedium}>
              Medium <span className="mono">{stats.medium.solved}/{stats.medium.total}</span>
            </span>
            <span className={styles.diffHard}>
              Hard <span className="mono">{stats.hard.solved}/{stats.hard.total}</span>
            </span>
          </div>
        </div>
      </header>

      {/* Filter Toolbar */}
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search problems or topics (e.g. dynamic programming, sliding window)..."
          />
        </label>

        {/* Difficulty Chips */}
        <div className={styles.chips}>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              className={`${styles.chip} ${difficulty === d ? styles.chipActive : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Status Chips */}
        <div className={styles.chips}>
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`${styles.chip} ${status === s ? styles.chipActive : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Timeframe Chips if applicable */}
        {availableTimeframes.length > 0 && (
          <div className={styles.chips}>
            {availableTimeframes.map((tf) => (
              <button
                key={tf}
                className={`${styles.chip} ${timeframe === tf ? styles.chipActive : ''}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
        )}

        {/* Reset Track Button */}
        <button className={styles.resetButton} onClick={() => setConfirmingReset(true)}>
          <RotateCcw size={14} />
          Reset company
        </button>
      </div>

      {/* Problem Table */}
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span className={styles.thCheck} />
          <span className={styles.thIndex}>#</span>
          <span className={styles.thTitle}>Problem Title</span>
          <span className={styles.thDiff}>Difficulty</span>
          <span className={styles.thAcceptance}>Acceptance</span>
          <span className={styles.thFreq}>Frequency</span>
          <span className={styles.thActions}>Links</span>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading {companyMeta.name} problems...</div>
        ) : filteredProblems.length === 0 ? (
          <div className={styles.empty}>No problems match the selected filters.</div>
        ) : (
          visibleProblems.map((p, idx) => {
            const solved = !!progress[p.id];
            const hasNote = !!notes[p.id]?.trim();
            const bookmarked = !!bookmarks[p.id];

            const diffClass =
              p.difficulty === 'Easy'
                ? styles.easy
                : p.difficulty === 'Hard'
                ? styles.hard
                : styles.medium;

            const freqScore = Math.min(100, Math.max(0, p.frequency || 0));

            return (
              <div key={p.id} className={styles.row}>
                {/* Checkbox */}
                <button
                  className={`${styles.checkbox} ${solved ? styles.checked : ''}`}
                  onClick={() => {
                    if (!solved) noteUserSolveIntent(p.id);
                    toggleProblem(p.id);
                  }}
                  aria-pressed={solved}
                  aria-label={solved ? `Mark ${p.title} as unsolved` : `Mark ${p.title} as solved`}
                >
                  {solved && <Check size={12} strokeWidth={3} />}
                </button>

                {/* Index */}
                <span className={`${styles.index} mono`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>

                {/* Title & Topics */}
                <div className={styles.titleCol}>
                  <a
                    href={p.links.leetcode || `https://leetcode.com/problems/${p.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${styles.titleLink} ${solved ? styles.titleSolved : ''}`}
                    title={p.title}
                  >
                    {p.title}
                  </a>
                  {p.topics && p.topics.length > 0 && (
                    <div className={styles.topicPills}>
                      {p.topics.slice(0, 3).map((topic) => (
                        <span key={topic} className={styles.topicPill}>
                          {topic}
                        </span>
                      ))}
                      {p.topics.length > 3 && (
                        <span className={styles.topicPill}>+{p.topics.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Difficulty */}
                <span className={`${styles.difficulty} ${diffClass}`}>{p.difficulty}</span>

                {/* Acceptance Rate */}
                <span className={`${styles.acceptance} mono`}>
                  {p.acceptance || '—'}
                </span>

                {/* Frequency Indicator */}
                <div className={styles.frequency}>
                  <span className={`${styles.freqScore} mono`}>
                    {p.frequency ? `${Math.round(p.frequency)}%` : '—'}
                  </span>
                  {p.frequency ? (
                    <div className={styles.freqBarBg}>
                      <div
                        className={styles.freqBarFill}
                        style={{ width: `${freqScore}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Actions & Links */}
                <div className={styles.actions}>
                  <ResourceLinks links={p.links} />

                  <button
                    className={`${styles.iconButton} ${styles.tutorBtn} ${
                      tutorChats?.[`company_${currentCompanyId}_${p.id}`]?.length || hasNote
                        ? styles.tutorActive
                        : ''
                    }`}
                    onClick={() => setTutorProblem(p)}
                    aria-label="Ask Pacer"
                    title="Ask Pacer"
                  >
                    <Sparkles size={13} />
                  </button>

                  <button
                    className={`${styles.iconButton} ${bookmarked ? styles.iconActive : ''}`}
                    onClick={() => toggleBookmark(p.id)}
                    aria-pressed={bookmarked}
                    aria-label="Bookmark"
                    title="Bookmark"
                  >
                    <Bookmark size={14} fill={bookmarked ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Pagination / Load more */}
        {!loading && filteredProblems.length > visibleProblems.length && (
          <div className={styles.pagination}>
            <span>
              Showing <strong className="mono">{visibleProblems.length}</strong> of{' '}
              <strong className="mono">{filteredProblems.length}</strong> problems
            </span>
            <div className={styles.loadMoreButtons}>
              <button
                className={styles.loadMoreBtn}
                onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
              >
                Load {PAGE_SIZE} more
              </button>
              <button
                className={styles.loadMoreBtn}
                onClick={() => setDisplayLimit(filteredProblems.length)}
              >
                Show all ({filteredProblems.length})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Tutor Drawer */}
      {(tutorProblem || companyTutorOpen) && (
        <AITutorDrawer
          topicKey={
            tutorProblem
              ? `company_${currentCompanyId}_${tutorProblem.id}`
              : `company_${currentCompanyId}`
          }
          topicTitle={
            tutorProblem
              ? `${companyMeta.name} — ${tutorProblem.title}`
              : `${companyMeta.name} Interview Prep with Pacer`
          }
          companyName={companyMeta.name}
          patternTip={companyMeta.interviewTip || undefined}
          problems={problems.slice(0, 30).map((pr) => ({ id: pr.id, title: pr.title, difficulty: pr.difficulty }))}
          currentProblem={
            tutorProblem
              ? {
                  id: tutorProblem.id,
                  title: tutorProblem.title,
                  difficulty: tutorProblem.difficulty,
                  acceptance: tutorProblem.acceptance || undefined,
                  topics: tutorProblem.topics,
                }
              : null
          }
          onClose={handleCloseTutor}
        />
      )}

      {/* Reset Confirmation Dialog */}
      {confirmingReset && (
        <ConfirmDialog
          title={`Reset ${companyMeta.name}?`}
          body={`This clears your solved progress, personal notes, and bookmarks for all problems in ${companyMeta.name}. This action cannot be undone.`}
          confirmLabel="Reset company"
          onConfirm={handleResetCompany}
          onCancel={() => setConfirmingReset(false)}
        />
      )}
    </div>
  );
}
