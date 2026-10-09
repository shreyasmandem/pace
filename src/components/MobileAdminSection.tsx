import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldAlert,
  Users,
  Radio,
  BarChart3,
  Database,
  ScrollText,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Edit3,
  RotateCcw,
  Ban,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useAuthUser } from '../hooks/useAuth';
import { useIsDesktop } from '../hooks/useIsDesktop';
import {
  isPaceAdmin,
  ADMIN_EMAIL,
  fetchAdminUsers,
  adminDeleteUser,
  adminRestoreUser,
  adminUpdateUser,
  adminResetUserProgress,
  adminToggleBanUser,
  fetchBroadcastAnnouncement,
  updateBroadcastAnnouncement,
  deleteBroadcastAnnouncement,
  exportPlatformSnapshot,
  getAuditLogs,
  clearAuditLogs,
  addAuditLog,
  type AdminUser,
  type BroadcastAnnouncement,
  type AuditLogEntry,
} from '../lib/admin';
import { calculateTier } from '../lib/leaderboard';
import { TRACK_META } from '../data';
import styles from './MobileAdminSection.module.css';

type AdminTab = 'users' | 'broadcast' | 'analytics' | 'database' | 'audit';

export default function MobileAdminSection() {
  const { user } = useAuthUser();
  const isDesktop = useIsDesktop(1080);
  const isAdmin = isPaceAdmin(user);

  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'solved' | 'streak' | 'recent' | 'name'>('solved');

  // Modals state
  const [inspectUser, setInspectUser] = useState<AdminUser | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editSolvedCount, setEditSolvedCount] = useState(0);
  const [editStreak, setEditStreak] = useState(0);
  const [editWeeklyCount, setEditWeeklyCount] = useState(0);

  // Broadcast state
  const [broadcast, setBroadcast] = useState<BroadcastAnnouncement>({
    active: false,
    message: '',
    type: 'info',
    link: '',
    linkText: '',
    updatedAt: Date.now(),
    updatedBy: ADMIN_EMAIL,
  });
  const [deleteAlertModalOpen, setDeleteAlertModalOpen] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = async (isManual = false) => {
    if (!isAdmin) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [userList, broadcastData] = await Promise.all([
        fetchAdminUsers(),
        fetchBroadcastAnnouncement(),
      ]);

      setUsers(userList);
      if (broadcastData) {
        setBroadcast(broadcastData);
      } else {
        setBroadcast({
          active: false,
          message: '',
          type: 'info',
          link: '',
          linkText: '',
          updatedAt: Date.now(),
          updatedBy: ADMIN_EMAIL,
        });
      }
      setAuditLogs(getAuditLogs());
      if (isManual) showToast('Synced fresh from Firestore');
    } catch {
      showToast('Error syncing data from Firestore');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isDesktop && isAdmin) {
      loadData();
    }
  }, [isDesktop, isAdmin]);

  // Only render on mobile/phone (<1080px) and strictly for Shreyas (shreyas0381@gmail.com)
  if (isDesktop || !isAdmin) {
    return null;
  }

  const openEditModal = (u: AdminUser) => {
    setEditUser(u);
    setEditDisplayName(u.displayName);
    setEditSolvedCount(u.solvedCount);
    setEditStreak(u.streak);
    setEditWeeklyCount(u.weeklyCount);
  };

  const handleSaveEditUser = async () => {
    if (!editUser) return;
    const res = await adminUpdateUser(
      editUser.uid,
      {
        displayName: editDisplayName.trim(),
        solvedCount: Number(editSolvedCount) || 0,
        streak: Number(editStreak) || 0,
        weeklyCount: Number(editWeeklyCount) || 0,
      },
      user?.uid
    );

    if (res.success) {
      showToast(`Saved ${editDisplayName || editUser.uid}`);
      setEditUser(null);
      loadData(false);
    } else {
      showToast(res.error || 'Failed to update user');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const targetUid = deleteTarget.uid;
    const targetName = deleteTarget.displayName;

    setUsers((prev) =>
      prev.map((u) => (u.uid === targetUid ? { ...u, deleted: true } : u))
    );
    setDeleteTarget(null);
    setDeleteConfirmText('');

    const res = await adminDeleteUser(targetUid, targetName, user?.uid);
    if (res.success) {
      showToast(`User "${targetName}" purged`);
      loadData(false);
    } else {
      showToast(res.error || 'Failed to delete user');
      loadData(false);
    }
  };

  const handleRestoreUser = async (u: AdminUser) => {
    setUsers((prev) =>
      prev.map((item) => (item.uid === u.uid ? { ...item, deleted: false } : item))
    );
    const res = await adminRestoreUser(u.uid, u.displayName, user?.uid);
    if (res.success) {
      showToast(`Restored "${u.displayName}"`);
      loadData(false);
    } else {
      showToast(res.error || 'Failed to restore user');
      loadData(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    const res = await adminResetUserProgress(resetTarget.uid, resetTarget.displayName);
    if (res.success) {
      showToast(`Reset progress for ${resetTarget.displayName}`);
      setResetTarget(null);
      loadData(false);
    } else {
      showToast(res.error || 'Failed to reset progress');
    }
  };

  const handleToggleBan = async (u: AdminUser) => {
    const nextState = !u.banned;
    setUsers((prev) =>
      prev.map((item) => (item.uid === u.uid ? { ...item, banned: nextState } : item))
    );
    const res = await adminToggleBanUser(u.uid, nextState, u.displayName, user?.uid);
    if (res.success) {
      showToast(`${nextState ? 'Suspended' : 'Unbanned'} ${u.displayName}`);
      loadData(false);
    } else {
      showToast(res.error || 'Action failed');
      loadData(false);
    }
  };

  const handleSaveBroadcast = async (customPayload?: BroadcastAnnouncement) => {
    const target = customPayload || broadcast;
    if (target.active && (!target.message || !target.message.trim())) {
      showToast('Enter an announcement message first');
      return;
    }
    const res = await updateBroadcastAnnouncement(target, user?.uid);
    if (res.success) {
      setBroadcast({ ...target });
      showToast(target.active ? '🚀 Broadcast live!' : '⏸️ Broadcast paused');
    } else {
      showToast(res.error || 'Failed to update broadcast');
    }
  };

  const handleDeleteBroadcast = async () => {
    const res = await deleteBroadcastAnnouncement(user?.uid);
    if (res.success) {
      setBroadcast({
        active: false,
        message: '',
        type: 'info',
        link: '',
        linkText: '',
        updatedAt: Date.now(),
        updatedBy: ADMIN_EMAIL,
      });
      setDeleteAlertModalOpen(false);
      showToast('🗑️ Broadcast deleted');
    } else {
      showToast(res.error || 'Failed to delete broadcast');
    }
  };

  const handleExportSnapshot = async () => {
    try {
      const json = await exportPlatformSnapshot();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pace-platform-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addAuditLog('EXPORT_BACKUP', 'system', 'Full platform database snapshot downloaded', 'success');
      setAuditLogs(getAuditLogs());
      showToast('Backup snapshot downloaded');
    } catch {
      showToast('Export failed');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(id);
    setTimeout(() => setCopiedUid(null), 1800);
  };

  const activeUsers = users.filter((u) => !u.deleted);
  const deletedUsers = users.filter((u) => u.deleted);
  const suspendedUsers = users.filter((u) => u.banned && !u.deleted);

  const filteredUsers = users
    .filter((u) => {
      if (selectedTier === 'deleted') {
        if (!u.deleted) return false;
      } else if (selectedTier === 'suspended') {
        if (u.deleted || !u.banned) return false;
      } else {
        if (u.deleted) return false;
        if (selectedTier !== 'all') {
          const tier = calculateTier(u.solvedCount).tier.toLowerCase();
          if (tier !== selectedTier.toLowerCase()) return false;
        }
      }

      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        u.displayName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.uid.toLowerCase().includes(query);

      return matchesQuery;
    })
    .sort((a, b) => {
      if (sortBy === 'solved') return b.solvedCount - a.solvedCount;
      if (sortBy === 'streak') return b.streak - a.streak;
      if (sortBy === 'recent') return b.updatedAt - a.updatedAt;
      if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
      return 0;
    });

  const totalPlatformSolves = activeUsers.reduce((acc, u) => acc + (u.solvedCount || 0), 0);
  const activeStreakCount = activeUsers.filter((u) => u.streak > 0).length;

  return (
    <section className={styles.adminBlock}>
      <div className={styles.shell}>
        {/* Minimal Header */}
        <div className={styles.header}>
          <div
            className={styles.headerLeft}
            onClick={() => setExpanded((prev) => !prev)}
            role="button"
            tabIndex={0}
          >
            <div className={styles.shieldIcon}>
              <ShieldAlert size={15} />
            </div>
            <div className={styles.headerTitleWrap}>
              <div className={styles.headerTitleRow}>
                <h2 className={styles.headerTitle}>Admin Console</h2>
                <span className={styles.rootBadge}>ROOT</span>
              </div>
              <span className={styles.headerSub}>{ADMIN_EMAIL}</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Sync Firestore"
              aria-label="Sync Firestore"
            >
              <RefreshCw size={14} className={refreshing ? styles.spinning : ''} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={handleExportSnapshot}
              title="Export Platform Backup"
              aria-label="Export Platform Backup"
            >
              <Download size={14} />
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? 'Collapse Admin Console' : 'Expand Admin Console'}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* Compact 4-Metric Strip */}
        <div className={styles.statsStrip}>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{activeUsers.length}</span>
            <span className={styles.statLabel}>Users</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{totalPlatformSolves}</span>
            <span className={styles.statLabel}>Solves</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statValue}>{activeStreakCount}</span>
            <span className={styles.statLabel}>Streaks</span>
          </div>
          <div className={styles.statCell}>
            <span
              className={styles.statValue}
              style={{
                color: broadcast.active ? 'var(--difficulty-easy)' : 'var(--text-tertiary)',
              }}
            >
              {broadcast.active ? 'LIVE' : 'OFF'}
            </span>
            <span className={styles.statLabel}>Banner</span>
          </div>
        </div>

        {toastMessage && (
          <div className={styles.toast}>
            <Check size={14} color="var(--difficulty-easy)" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Segmented Tab Bar */}
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.tabBtn} ${expanded && activeTab === 'users' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('users');
              setExpanded(true);
            }}
          >
            <Users size={12} />
            <span>Users</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${expanded && activeTab === 'broadcast' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('broadcast');
              setExpanded(true);
            }}
          >
            <Radio size={12} />
            <span>Banner</span>
            {broadcast.active && <span className={styles.tabDot} />}
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${expanded && activeTab === 'analytics' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('analytics');
              setExpanded(true);
            }}
          >
            <BarChart3 size={12} />
            <span>Stats</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${expanded && activeTab === 'database' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('database');
              setExpanded(true);
            }}
          >
            <Database size={12} />
            <span>Tools</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${expanded && activeTab === 'audit' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setActiveTab('audit');
              setExpanded(true);
            }}
          >
            <ScrollText size={12} />
            <span>Audit</span>
          </button>
        </div>

        {expanded && (
          <div className={styles.body}>
              {/* TAB 1: USERS */}
              {activeTab === 'users' && (
                <div>
                  <div className={styles.controlsStack}>
                    <div className={styles.searchWrap}>
                      <Search size={14} className={styles.searchIcon} />
                      <input
                        type="text"
                        placeholder="Search name, email, or UID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                    <div className={styles.filterRow}>
                      <select
                        value={selectedTier}
                        onChange={(e) => setSelectedTier(e.target.value)}
                        className={styles.selectInput}
                      >
                        <option value="all">Active ({activeUsers.length})</option>
                        {deletedUsers.length > 0 && (
                          <option value="deleted">Deleted ({deletedUsers.length})</option>
                        )}
                        {suspendedUsers.length > 0 && (
                          <option value="suspended">Suspended ({suspendedUsers.length})</option>
                        )}
                        <option value="grandmaster">Grandmaster</option>
                        <option value="master">Master</option>
                        <option value="diamond">Diamond</option>
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                        <option value="bronze">Bronze</option>
                        <option value="novice">Novice</option>
                      </select>

                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className={styles.selectInput}
                      >
                        <option value="solved">Sort: Solved</option>
                        <option value="streak">Sort: Streak</option>
                        <option value="recent">Sort: Recent</option>
                        <option value="name">Sort: Name</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.userList}>
                    {filteredUsers.length === 0 ? (
                      <div className={styles.emptyText}>
                        {loading ? 'Loading users...' : 'No matching users.'}
                      </div>
                    ) : (
                      filteredUsers.map((u) => {
                        const tier = calculateTier(u.solvedCount);
                        const isOwner = u.email === ADMIN_EMAIL;
                        return (
                          <div key={u.uid} className={styles.userCard}>
                            <div className={styles.userTop}>
                              <div className={styles.userIdentity}>
                                {u.photoURL ? (
                                  <img src={u.photoURL} alt="" className={styles.avatar} />
                                ) : (
                                  <div className={styles.avatarFallback}>
                                    {u.displayName.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div className={styles.userTextWrap}>
                                  <div className={styles.userNameRow}>
                                    <span className={styles.userName}>{u.displayName}</span>
                                    {isOwner && <span className={styles.rootBadge}>OWNER</span>}
                                    {u.banned && !u.deleted && (
                                      <span className={`${styles.statusPill} ${styles.statusBanned}`}>
                                        BANNED
                                      </span>
                                    )}
                                    {u.deleted && (
                                      <span className={`${styles.statusPill} ${styles.statusDeleted}`}>
                                        DELETED
                                      </span>
                                    )}
                                  </div>
                                  <span className={styles.userEmail}>
                                    {u.email || 'No email'} · {u.lastActiveFormatted}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={styles.tierBadge}
                                style={{ color: tier.color, background: tier.bg }}
                              >
                                {tier.tier}
                              </span>
                            </div>

                            <div className={styles.userMetaBar}>
                              <div className={styles.userMetrics}>
                                <span>
                                  <strong>{u.solvedCount}</strong> solved
                                </span>
                                <span>🔥 {u.streak}d</span>
                                <span>{u.weeklyCount}/wk</span>
                                <button
                                  type="button"
                                  className={styles.uidBtn}
                                  onClick={() => copyToClipboard(u.uid, u.uid)}
                                  title="Copy UID"
                                >
                                  {copiedUid === u.uid ? (
                                    <>
                                      <Check size={10} color="var(--difficulty-easy)" />
                                      <span>Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={10} />
                                      <span>{u.uid.slice(0, 6)}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className={styles.userActions}>
                                {u.deleted ? (
                                  <button
                                    type="button"
                                    className={styles.restoreBtn}
                                    onClick={() => handleRestoreUser(u)}
                                  >
                                    <RotateCcw size={12} />
                                    <span>Restore</span>
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className={styles.miniActionBtn}
                                      onClick={() => setInspectUser(u)}
                                      title="Inspect JSON"
                                    >
                                      <Eye size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.miniActionBtn}
                                      onClick={() => openEditModal(u)}
                                      title="Edit user"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.miniActionBtn}
                                      onClick={() => setResetTarget(u)}
                                      title="Reset progress"
                                    >
                                      <RotateCcw size={13} />
                                    </button>
                                    {!isOwner && (
                                      <button
                                        type="button"
                                        className={styles.miniActionBtn}
                                        onClick={() => handleToggleBan(u)}
                                        title={u.banned ? 'Unban' : 'Suspend'}
                                        style={{
                                          color: u.banned ? 'var(--difficulty-easy)' : undefined,
                                        }}
                                      >
                                        <Ban size={13} />
                                      </button>
                                    )}
                                    {!isOwner && (
                                      <button
                                        type="button"
                                        className={`${styles.miniActionBtn} ${styles.miniActionBtnDanger}`}
                                        onClick={() => {
                                          setDeleteTarget(u);
                                          setDeleteConfirmText('');
                                        }}
                                        title="Delete user"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: BROADCAST BANNER */}
              {activeTab === 'broadcast' && (
                <div className={styles.stack}>
                  {broadcast.message && broadcast.message.trim() && (
                    <div className={styles.liveBannerBox}>
                      <div className={styles.liveBannerTop}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Current Alert
                        </span>
                        <span
                          className={`${styles.liveStatusPill} ${
                            broadcast.active ? styles.liveOn : styles.liveOff
                          }`}
                        >
                          {broadcast.active ? '● LIVE' : '○ PAUSED'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          paddingLeft: 8,
                          borderLeft: '2px solid var(--accent)',
                        }}
                      >
                        {broadcast.message}
                      </div>
                      <div className={styles.btnRow}>
                        <button
                          type="button"
                          className={styles.secondaryBtn}
                          onClick={() => {
                            const next = { ...broadcast, active: !broadcast.active };
                            handleSaveBroadcast(next);
                          }}
                        >
                          {broadcast.active ? 'Pause Banner' : 'Activate Banner'}
                        </button>
                        <button
                          type="button"
                          className={styles.dangerBtn}
                          onClick={() => setDeleteAlertModalOpen(true)}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Announcement Message</label>
                    <textarea
                      className={styles.textarea}
                      placeholder="Write site-wide banner announcement..."
                      value={broadcast.message}
                      onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Theme Style</label>
                    <div className={styles.pillSelector}>
                      {(['info', 'warning', 'alert', 'success'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.pillChoice} ${
                            broadcast.type === t ? styles.pillChoiceActive : ''
                          }`}
                          onClick={() => setBroadcast((b) => ({ ...b, type: t }))}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.twoCol}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Link URL (Optional)</label>
                      <input
                        type="text"
                        className={styles.textInput}
                        placeholder="/companies or https://..."
                        value={broadcast.link || ''}
                        onChange={(e) => setBroadcast((b) => ({ ...b, link: e.target.value }))}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Link Label</label>
                      <input
                        type="text"
                        className={styles.textInput}
                        placeholder="Explore →"
                        value={broadcast.linkText || ''}
                        onChange={(e) => setBroadcast((b) => ({ ...b, linkText: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className={styles.btnRow}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={() => handleSaveBroadcast({ ...broadcast, active: true })}
                    >
                      <Radio size={13} />
                      <span>Publish Live</span>
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => handleSaveBroadcast({ ...broadcast, active: false })}
                    >
                      Save Inactive
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: PLATFORM ANALYTICS */}
              {activeTab === 'analytics' && (
                <div className={styles.stack}>
                  <div className={styles.subCard}>
                    <h3 className={styles.subCardTitle}>Track Enrollments</h3>
                    {Object.entries(TRACK_META).map(([id, meta]) => {
                      const enrolledCount = users.filter((u) =>
                        u.registeredTracks?.includes(id)
                      ).length;
                      const percent =
                        users.length > 0 ? Math.round((enrolledCount / users.length) * 100) : 0;
                      return (
                        <div key={id} className={styles.trackStatRow}>
                          <div className={styles.trackStatTop}>
                            <span style={{ fontWeight: 600, color: meta.accent }}>
                              {meta.shortLabel}
                            </span>
                            <span className="numeric" style={{ color: 'var(--text-tertiary)' }}>
                              {enrolledCount} ({percent}%)
                            </span>
                          </div>
                          <div className={styles.barTrack}>
                            <div
                              className={styles.barFill}
                              style={{ width: `${percent}%`, background: meta.accent }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.subCard}>
                    <h3 className={styles.subCardTitle}>Top 5 Leaders</h3>
                    {activeUsers.slice(0, 5).map((u, i) => (
                      <div key={u.uid} className={styles.leaderRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color:
                                i === 0
                                  ? '#f0b429'
                                  : i === 1
                                  ? '#cbd5e1'
                                  : i === 2
                                  ? '#ff7a29'
                                  : 'var(--text-tertiary)',
                            }}
                          >
                            #{i + 1}
                          </span>
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {u.displayName}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                            🔥 {u.streak}d
                          </span>
                          <span className="numeric" style={{ fontWeight: 700 }}>
                            {u.solvedCount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: DATABASE TOOLS */}
              {activeTab === 'database' && (
                <div className={styles.stack}>
                  <div className={styles.toolItem}>
                    <div className={styles.toolInfo}>
                      <span className={styles.toolTitle}>Platform JSON Backup</span>
                      <span className={styles.toolDesc}>
                        Download full snapshot of users, solves &amp; audit logs
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      onClick={handleExportSnapshot}
                    >
                      <Download size={13} />
                      <span>Export</span>
                    </button>
                  </div>

                  <div className={styles.toolItem}>
                    <div className={styles.toolInfo}>
                      <span className={styles.toolTitle}>Re-index Leaderboard</span>
                      <span className={styles.toolDesc}>
                        Sync all user records &amp; recalculate rankings
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => loadData(true)}
                    >
                      <RefreshCw size={13} />
                      <span>Sync</span>
                    </button>
                  </div>

                  <div className={styles.toolItem}>
                    <div className={styles.toolInfo}>
                      <span className={styles.toolTitle}>Purge Offline Auth Cache</span>
                      <span className={styles.toolDesc}>
                        Clear local auth cache &amp; persistence buffers
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        try {
                          localStorage.removeItem('pace_cached_auth_user');
                          showToast('Offline auth cache purged');
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Purge</span>
                    </button>
                  </div>

                  <div className={styles.toolItem}>
                    <div className={styles.toolInfo}>
                      <span className={styles.toolTitle}>Firestore Security Rules</span>
                      <span className={styles.toolDesc}>
                        Copy production rules for Firebase Console
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      onClick={() => {
                        const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'shreyas0381@gmail.com';
    }

    match /users/{userId} {
      allow read, write, delete: if isAdmin() || (request.auth != null && request.auth.uid == userId);
    }

    match /leaderboard/{userId} {
      allow read: if true;
      allow write, delete: if isAdmin() || (request.auth != null && request.auth.uid == userId);
    }

    match /system/{docId} {
      allow read: if true;
      allow write, delete: if request.auth != null;
    }
  }
}`;
                        copyToClipboard(rules, 'rules_copied');
                        showToast('📋 Firestore rules copied!');
                      }}
                    >
                      <Copy size={13} />
                      <span>{copiedUid === 'rules_copied' ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 5: AUDIT LOG */}
              {activeTab === 'audit' && (
                <div className={styles.stack}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span className={styles.fieldLabel}>
                      Session Audit Log ({auditLogs.length})
                    </span>
                    {auditLogs.length > 0 && (
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ height: 26, padding: '0 8px', fontSize: '0.7rem' }}
                        onClick={() => {
                          clearAuditLogs();
                          setAuditLogs([]);
                          showToast('Audit log cleared');
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className={styles.emptyText}>No admin actions logged this session.</div>
                  ) : (
                    <div className={styles.auditList}>
                      {auditLogs.map((log) => (
                        <div key={log.id} className={styles.auditItem}>
                          <div className={styles.auditTop}>
                            <span className={styles.auditAction}>{log.action}</span>
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background:
                                  log.status === 'success'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : log.status === 'warning'
                                    ? 'rgba(245, 158, 11, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color:
                                  log.status === 'success'
                                    ? '#6ee7b7'
                                    : log.status === 'warning'
                                    ? '#fcd34d'
                                    : '#fca5a5',
                              }}
                            >
                              {log.status.toUpperCase()}
                            </span>
                          </div>
                          <div className={styles.auditDetails}>{log.details}</div>
                          <div className={styles.auditMeta}>
                            {new Date(log.timestamp).toLocaleTimeString()} ·{' '}
                            {log.target.slice(0, 14)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
        )}
      </div>

      {/* MODAL 1: INSPECT USER JSON */}
      {inspectUser &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setInspectUser(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Inspect: {inspectUser.displayName}</h3>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setInspectUser(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                    {inspectUser.uid}
                  </span>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    style={{ height: 28, fontSize: '0.72rem' }}
                    onClick={() =>
                      copyToClipboard(
                        JSON.stringify(
                          {
                            account: inspectUser,
                            rawUserData: inspectUser.rawUserData,
                            rawLeaderboardData: inspectUser.rawLeaderboardData,
                          },
                          null,
                          2
                        ),
                        'inspect-json'
                      )
                    }
                  >
                    <Copy size={12} />
                    <span>{copiedUid === 'inspect-json' ? 'Copied!' : 'Copy JSON'}</span>
                  </button>
                </div>
                <div className={styles.codeBlock}>
                  {JSON.stringify(
                    {
                      profile: {
                        uid: inspectUser.uid,
                        displayName: inspectUser.displayName,
                        email: inspectUser.email,
                        solvedCount: inspectUser.solvedCount,
                        streak: inspectUser.streak,
                        weeklyCount: inspectUser.weeklyCount,
                        registeredTracks: inspectUser.registeredTracks,
                        banned: inspectUser.banned,
                      },
                      firestoreUserData: inspectUser.rawUserData,
                      firestoreLeaderboardData: inspectUser.rawLeaderboardData,
                    },
                    null,
                    2
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setInspectUser(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: EDIT USER */}
      {editUser &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setEditUser(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Edit User Profile &amp; Stats</h3>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setEditUser(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Display Name</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                  />
                </div>
                <div className={styles.twoCol}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Solved Count</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.textInput}
                      value={editSolvedCount}
                      onChange={(e) => setEditSolvedCount(Number(e.target.value))}
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Daily Streak</label>
                    <input
                      type="number"
                      min={0}
                      className={styles.textInput}
                      value={editStreak}
                      onChange={(e) => setEditStreak(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Weekly Solves</label>
                  <input
                    type="number"
                    min={0}
                    className={styles.textInput}
                    value={editWeeklyCount}
                    onChange={(e) => setEditWeeklyCount(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setEditUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleSaveEditUser}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: DELETE USER */}
      {deleteTarget &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setDeleteTarget(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} color="#ef4444" />
                  <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>
                    Delete User Account
                  </h3>
                </div>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setDeleteTarget(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p style={{ margin: 0 }}>
                  Permanently delete{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {deleteTarget.displayName}
                  </strong>{' '}
                  ({deleteTarget.email || deleteTarget.uid})?
                </p>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Type <strong>DELETE</strong> to confirm:
                  </label>
                  <input
                    type="text"
                    placeholder="DELETE"
                    className={styles.textInput}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  style={{
                    opacity: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? 1 : 0.4,
                  }}
                  onClick={handleConfirmDelete}
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: RESET USER PROGRESS */}
      {resetTarget &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setResetTarget(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Reset User Progress</h3>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setResetTarget(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p style={{ margin: 0 }}>
                  Reset all solved progress, streaks, and planner items for{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {resetTarget.displayName}
                  </strong>{' '}
                  back to 0?
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setResetTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={handleConfirmReset}
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 5: DELETE BROADCAST ALERT */}
      {deleteAlertModalOpen &&
        createPortal(
          <div className={styles.modalBackdrop} onClick={() => setDeleteAlertModalOpen(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>
                  Delete Broadcast Alert
                </h3>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setDeleteAlertModalOpen(false)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <p style={{ margin: 0 }}>
                  Permanently remove the broadcast banner from all devices?
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setDeleteAlertModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={handleDeleteBroadcast}
                >
                  Delete Alert
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
