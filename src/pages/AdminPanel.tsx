import { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
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
  Lock,
  Flame,
  Award,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuthUser } from '../hooks/useAuth';
import { useIsDesktop } from '../hooks/useIsDesktop';
import {
  isPaceAdmin,
  ADMIN_EMAIL,
  fetchAdminUsers,
  adminDeleteUser,
  adminUpdateUser,
  adminResetUserProgress,
  adminToggleBanUser,
  fetchBroadcastAnnouncement,
  updateBroadcastAnnouncement,
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
import styles from './AdminPanel.module.css';

type AdminTab = 'users' | 'broadcast' | 'analytics' | 'database' | 'audit';

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuthUser();
  const isDesktop = useIsDesktop(1080);
  const isAdmin = isPaceAdmin(user);

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

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Load admin data
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
      }
      setAuditLogs(getAuditLogs());
      if (isManual) showToast('Platform data synced fresh from Firestore');
    } catch (err) {
      console.warn('Admin load error:', err);
      showToast('Error syncing data from Firestore');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin]);

  // Handle Edit User Modal Open
  const openEditModal = (u: AdminUser) => {
    setEditUser(u);
    setEditDisplayName(u.displayName);
    setEditSolvedCount(u.solvedCount);
    setEditStreak(u.streak);
    setEditWeeklyCount(u.weeklyCount);
  };

  // Save Edit User
  const handleSaveEditUser = async () => {
    if (!editUser) return;
    const res = await adminUpdateUser(editUser.uid, {
      displayName: editDisplayName.trim(),
      solvedCount: Number(editSolvedCount) || 0,
      streak: Number(editStreak) || 0,
      weeklyCount: Number(editWeeklyCount) || 0,
    });

    if (res.success) {
      showToast(`Saved changes for ${editDisplayName || editUser.uid}`);
      setEditUser(null);
      loadData(false);
    } else {
      showToast(res.error || 'Failed to update user');
    }
  };

  // Confirm Delete User
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await adminDeleteUser(deleteTarget.uid, deleteTarget.displayName);
    if (res.success) {
      showToast(`User ${deleteTarget.displayName} successfully deleted`);
      setDeleteTarget(null);
      setDeleteConfirmText('');
      loadData(false);
    } else {
      showToast(res.error || 'Failed to delete user');
    }
  };

  // Reset User Progress
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

  // Toggle Ban User
  const handleToggleBan = async (u: AdminUser) => {
    const nextState = !u.banned;
    const res = await adminToggleBanUser(u.uid, nextState, u.displayName);
    if (res.success) {
      showToast(`${nextState ? 'Banned' : 'Unbanned'} ${u.displayName}`);
      loadData(false);
    } else {
      showToast(res.error || 'Action failed');
    }
  };

  // Save Broadcast Announcement
  const handleSaveBroadcast = async () => {
    const success = await updateBroadcastAnnouncement(broadcast);
    if (success) {
      showToast(broadcast.active ? 'Broadcast announcement published' : 'Broadcast deactivated');
    } else {
      showToast('Failed to update announcement');
    }
  };

  // Export Full Platform Snapshot
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
      showToast('Full backup snapshot downloaded');
    } catch {
      showToast('Export failed');
    }
  };

  // Copy UID
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUid(id);
    setTimeout(() => setCopiedUid(null), 1800);
  };

  // Filtered & Sorted Users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery =
          !query ||
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.uid.toLowerCase().includes(query);

        if (!matchesQuery) return false;

        if (selectedTier !== 'all') {
          const tier = calculateTier(u.solvedCount).tier.toLowerCase();
          if (tier !== selectedTier.toLowerCase()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'solved') return b.solvedCount - a.solvedCount;
        if (sortBy === 'streak') return b.streak - a.streak;
        if (sortBy === 'recent') return b.updatedAt - a.updatedAt;
        if (sortBy === 'name') return a.displayName.localeCompare(b.displayName);
        return 0;
      });
  }, [users, searchQuery, selectedTier, sortBy]);

  // Aggregate Metrics
  const totalPlatformSolves = useMemo(
    () => users.reduce((acc, u) => acc + (u.solvedCount || 0), 0),
    [users]
  );
  const activeStreakCount = useMemo(
    () => users.filter((u) => u.streak > 0).length,
    [users]
  );

  // Security Check: strictly PC + shreyas0381@gmail.com
  if (!isDesktop || !isAdmin) {
    return (
      <div className={styles.deniedContainer}>
        <div className={styles.deniedCard}>
          <div className={styles.deniedIcon}>
            <Lock size={28} />
          </div>
          <h1 className={styles.deniedTitle}>Administrator Access Required</h1>
          <p className={styles.deniedText}>
            {!isDesktop
              ? 'The Pace Admin Command Center is only accessible on desktop computers.'
              : 'This panel is strictly restricted to administrator Shreyas Mandem (shreyas0381@gmail.com).'}
          </p>
          <NavLink to="/" className={styles.returnBtn}>
            Return to Dashboard
          </NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toastMessage && (
        <div className={styles.toast}>
          <Check size={16} color="var(--difficulty-easy)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <div className={styles.adminIconBadge}>
              <ShieldAlert size={20} />
            </div>
            <h1 className={styles.title}>Admin Command Center</h1>
            <span className={styles.rootBadge}>SUPERADMIN</span>
          </div>
          <p className={styles.subtitle}>
            Platform control, user database moderation &amp; system health for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{ADMIN_EMAIL}</strong>
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="Refresh database records"
          >
            <RefreshCw size={15} className={refreshing ? styles.spinning : ''} />
            <span>{refreshing ? 'Syncing...' : 'Sync Firestore'}</span>
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
            onClick={handleExportSnapshot}
            title="Download full JSON platform backup"
          >
            <Download size={15} />
            <span>Export Snapshot</span>
          </button>
        </div>
      </header>

      {/* Top 4 Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon}>
            <Users size={22} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Registered Users</span>
            <span className={`${styles.metricValue} numeric`}>{users.length}</span>
            <span className={styles.metricDetail}>Synced across accounts</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: 'var(--difficulty-medium)' }}>
            <Award size={22} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Total Platform Solves</span>
            <span className={`${styles.metricValue} numeric`}>{totalPlatformSolves}</span>
            <span className={styles.metricDetail}>Aggregated question solutions</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: 'var(--accent)' }}>
            <Flame size={22} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Active Daily Streaks</span>
            <span className={`${styles.metricValue} numeric`}>{activeStreakCount}</span>
            <span className={styles.metricDetail}>Users currently on streaks</span>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ color: '#38bdf8' }}>
            <Radio size={22} />
          </div>
          <div className={styles.metricInfo}>
            <span className={styles.metricLabel}>Broadcast Status</span>
            <span
              className={styles.metricValue}
              style={{
                fontSize: '1rem',
                color: broadcast.active ? 'var(--difficulty-easy)' : 'var(--text-tertiary)',
              }}
            >
              {broadcast.active ? '● LIVE ACTIVE' : '○ Standby'}
            </span>
            <span className={styles.metricDetail}>Platform announcement banner</span>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabsBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={16} />
          <span>User Management</span>
          <span className={styles.tabBadge}>{users.length}</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'broadcast' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('broadcast')}
        >
          <Radio size={16} />
          <span>Broadcast Banner</span>
          {broadcast.active && (
            <span
              className={styles.tabBadge}
              style={{ background: 'var(--difficulty-easy)', color: '#000' }}
            >
              ACTIVE
            </span>
          )}
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={16} />
          <span>Platform Analytics</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'database' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('database')}
        >
          <Database size={16} />
          <span>Database Tools</span>
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'audit' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <ScrollText size={16} />
          <span>Audit Log</span>
          <span className={styles.tabBadge}>{auditLogs.length}</span>
        </button>
      </div>

      {/* TAB 1: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div>
          {/* Controls Bar */}
          <div className={styles.userControls}>
            <div className={styles.searchBox}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search user by display name, email, or UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className={styles.selectInput}
              >
                <option value="all">All Tiers</option>
                <option value="grandmaster">Grandmaster (450+)</option>
                <option value="master">Master (250+)</option>
                <option value="diamond">Diamond (120+)</option>
                <option value="gold">Gold (50+)</option>
                <option value="silver">Silver (15+)</option>
                <option value="bronze">Bronze (1+)</option>
                <option value="novice">Novice (0)</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.selectInput}
              >
                <option value="solved">Sort by Solved (High to Low)</option>
                <option value="streak">Sort by Streak (High to Low)</option>
                <option value="recent">Sort by Recently Active</option>
                <option value="name">Sort by Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className={styles.tableCard}>
            <div className={styles.tableContainer}>
              <table className={styles.userTable}>
                <thead>
                  <tr>
                    <th>User / Account</th>
                    <th>UID</th>
                    <th>Tier</th>
                    <th>Solved</th>
                    <th>Streak</th>
                    <th>Weekly</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: 'right' }}>Admin Commands</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={styles.emptyState}>
                        {loading
                          ? 'Fetching user directory from Firestore...'
                          : 'No users matching current filters.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const tier = calculateTier(u.solvedCount);
                      const isOwner = u.email === ADMIN_EMAIL;
                      return (
                        <tr key={u.uid} className={styles.userRow}>
                          <td>
                            <div className={styles.userCell}>
                              {u.photoURL ? (
                                <img src={u.photoURL} alt="" className={styles.avatar} />
                              ) : (
                                <div className={styles.avatarFallback}>
                                  {u.displayName.slice(0, 1).toUpperCase()}
                                </div>
                              )}
                              <div className={styles.userInfo}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <span className={styles.userName}>{u.displayName}</span>
                                  {isOwner && (
                                    <span
                                      className={styles.rootBadge}
                                      style={{ marginLeft: 6, fontSize: '0.58rem', padding: '1px 5px' }}
                                    >
                                      OWNER
                                    </span>
                                  )}
                                  {u.banned && <span className={styles.bannedPill}>SUSPENDED</span>}
                                </div>
                                <span className={styles.userEmail}>{u.email || 'No email registered'}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className={styles.uidCode}
                              onClick={() => copyToClipboard(u.uid, u.uid)}
                              title="Click to copy UID"
                            >
                              {copiedUid === u.uid ? (
                                <>
                                  <Check size={11} color="var(--difficulty-easy)" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>{u.uid.slice(0, 8)}...</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td>
                            <span
                              className={styles.tierPill}
                              style={{ color: tier.color, background: tier.bg }}
                            >
                              {tier.tier}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600 }} className="numeric">
                              {u.solvedCount}
                            </span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.74rem' }}>
                              {' '}/ 625
                            </span>
                          </td>

                          <td>
                            <span
                              style={{
                                color: u.streak > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                                fontWeight: u.streak > 0 ? 600 : 400,
                              }}
                              className="numeric"
                            >
                              🔥 {u.streak}d
                            </span>
                          </td>

                          <td>
                            <span className="numeric" style={{ color: 'var(--text-secondary)' }}>
                              {u.weeklyCount}
                            </span>
                          </td>

                          <td>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                              {u.lastActiveFormatted}
                            </span>
                          </td>

                          <td>
                            <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className={styles.rowActionBtn}
                                onClick={() => setInspectUser(u)}
                                title="Inspect raw JSON data"
                              >
                                <Eye size={14} />
                              </button>

                              <button
                                type="button"
                                className={styles.rowActionBtn}
                                onClick={() => openEditModal(u)}
                                title="Edit user stats & profile"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                type="button"
                                className={styles.rowActionBtn}
                                onClick={() => setResetTarget(u)}
                                title="Reset user solves/progress"
                              >
                                <RotateCcw size={14} />
                              </button>

                              {!isOwner && (
                                <button
                                  type="button"
                                  className={styles.rowActionBtn}
                                  onClick={() => handleToggleBan(u)}
                                  title={u.banned ? 'Unban user' : 'Suspend / Ban user'}
                                  style={{ color: u.banned ? 'var(--difficulty-easy)' : undefined }}
                                >
                                  <Ban size={14} />
                                </button>
                              )}

                              {!isOwner && (
                                <button
                                  type="button"
                                  className={`${styles.rowActionBtn} ${styles.rowActionBtnDanger}`}
                                  onClick={() => {
                                    setDeleteTarget(u);
                                    setDeleteConfirmText('');
                                  }}
                                  title="Delete user account"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BROADCAST BANNER */}
      {activeTab === 'broadcast' && (
        <div className={styles.broadcastCard}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>
              Global Platform Broadcast Announcement
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Broadcast real-time announcements, maintenance notices, and milestone alerts to all Pace users.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Banner Visibility</label>
            <div className={styles.radioRow}>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="broadcastActive"
                  checked={broadcast.active}
                  onChange={() => setBroadcast((b) => ({ ...b, active: true }))}
                />
                <span style={{ fontWeight: 600, color: 'var(--difficulty-easy)' }}>
                  Active (Displayed to all users)
                </span>
              </label>
              <label className={styles.radioOption}>
                <input
                  type="radio"
                  name="broadcastActive"
                  checked={!broadcast.active}
                  onChange={() => setBroadcast((b) => ({ ...b, active: false }))}
                />
                <span style={{ color: 'var(--text-tertiary)' }}>Deactivated / Standby</span>
              </label>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Announcement Message</label>
            <textarea
              className={styles.formTextarea}
              placeholder="e.g., 🚀 NeetCode 250 curriculum is now live! Register in settings to start preparing."
              value={broadcast.message}
              onChange={(e) => setBroadcast((b) => ({ ...b, message: e.target.value }))}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Banner Theme Style</label>
            <div className={styles.radioRow}>
              {(['info', 'warning', 'alert', 'success'] as const).map((t) => (
                <label key={t} className={styles.radioOption}>
                  <input
                    type="radio"
                    name="broadcastType"
                    checked={broadcast.type === t}
                    onChange={() => setBroadcast((b) => ({ ...b, type: t }))}
                  />
                  <span style={{ textTransform: 'capitalize' }}>{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Action Link URL (Optional)</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="e.g., /companies or https://github.com..."
                value={broadcast.link || ''}
                onChange={(e) => setBroadcast((b) => ({ ...b, link: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Action Button Text</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="e.g., Explore now →"
                value={broadcast.linkText || ''}
                onChange={(e) => setBroadcast((b) => ({ ...b, linkText: e.target.value }))}
              />
            </div>
          </div>

          {/* Live Preview Box */}
          <div className={styles.previewBox}>
            <div className={styles.previewLabel}>Live User Preview</div>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                background:
                  broadcast.type === 'warning'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : broadcast.type === 'alert'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : broadcast.type === 'success'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  broadcast.type === 'warning'
                    ? '#fcd34d'
                    : broadcast.type === 'alert'
                    ? '#fca5a5'
                    : broadcast.type === 'success'
                    ? '#6ee7b7'
                    : '#93c5fd',
              }}
            >
              <span>{broadcast.message || 'No announcement message specified yet.'}</span>
              {broadcast.link && (
                <span style={{ textDecoration: 'underline', fontWeight: 600 }}>
                  {broadcast.linkText || 'Learn more →'}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                setBroadcast((b) => ({ ...b, active: false }));
                handleSaveBroadcast();
              }}
            >
              Deactivate Banner
            </button>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={handleSaveBroadcast}
            >
              Publish Announcement
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM ANALYTICS */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Track Enrollments Card */}
          <div className={styles.tableCard} style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              Curriculum Track Popularity &amp; Enrollments
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {Object.entries(TRACK_META).map(([id, meta]) => {
                const enrolledCount = users.filter((u) => u.registeredTracks?.includes(id)).length;
                const percent = users.length > 0 ? Math.round((enrolledCount / users.length) * 100) : 0;
                return (
                  <div
                    key={id}
                    style={{
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-hairline)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: meta.accent }}>{meta.shortLabel}</span>
                      <span className="numeric" style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                        {enrolledCount} enrolled ({percent}%)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {meta.label}
                    </span>
                    <div
                      style={{
                        height: 6,
                        background: 'var(--surface-hover)',
                        borderRadius: 3,
                        overflow: 'hidden',
                        marginTop: 4,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${percent}%`,
                          background: meta.accent,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 5 Leaderboard Snapshot */}
          <div className={styles.tableCard} style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16 }}>
              Top 5 Platform Leaders
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {users.slice(0, 5).map((u, i) => (
                <div
                  key={u.uid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-sunken)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: i === 0 ? '#f0b429' : i === 1 ? '#cbd5e1' : i === 2 ? '#ff7a29' : 'var(--text-tertiary)',
                        width: 24,
                      }}
                    >
                      #{i + 1}
                    </span>
                    <span style={{ fontWeight: 600 }}>{u.displayName}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{u.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>🔥 {u.streak} days</span>
                    <span style={{ fontWeight: 700 }}>{u.solvedCount} solved</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE TOOLS */}
      {activeTab === 'database' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className={styles.tableCard} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Download size={20} color="var(--accent)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Download Platform Snapshot</h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Export a complete JSON backup containing all registered users, their solve statistics, enrolled tracks, and audit history.
            </p>
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              style={{ marginTop: 8 }}
              onClick={handleExportSnapshot}
            >
              <Download size={15} />
              <span>Download JSON Backup</span>
            </button>
          </div>

          <div className={styles.tableCard} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RefreshCw size={20} color="var(--difficulty-medium)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Leaderboard Re-index</h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Re-scans all user progress records and ensures leaderboard solves and streaks are 100% accurate.
            </p>
            <button
              type="button"
              className={styles.actionBtn}
              style={{ marginTop: 8 }}
              onClick={() => loadData(true)}
            >
              <RefreshCw size={15} />
              <span>Re-index Leaderboard</span>
            </button>
          </div>

          <div className={styles.tableCard} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <RotateCcw size={20} color="#f87171" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Purge Offline Cache</h3>
            </div>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Clears browser local auth user cache and resets local persistence buffers if any sync conflicts occur.
            </p>
            <button
              type="button"
              className={styles.actionBtn}
              style={{ marginTop: 8 }}
              onClick={() => {
                try {
                  localStorage.removeItem('pace_cached_auth_user');
                  showToast('Local offline auth cache purged');
                } catch {
                  // ignore
                }
              }}
            >
              <span>Purge Cache</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className={styles.tableCard}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-hairline)' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Session &amp; Security Audit Log</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Immutable stream of all administrative commands executed in Pace.
              </p>
            </div>
            {auditLogs.length > 0 && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  clearAuditLogs();
                  setAuditLogs([]);
                  showToast('Audit log cleared');
                }}
              >
                Clear Log
              </button>
            )}
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.userTable}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.emptyState}>
                      No administrative actions logged yet this session.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleTimeString()} • {new Date(log.timestamp).toLocaleDateString()}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {log.target.slice(0, 16)}
                      </td>
                      <td style={{ fontSize: '0.84rem' }}>{log.details}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '2px 6px',
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: INSPECT RAW USER JSON */}
      {inspectUser && (
        <div className={styles.modalBackdrop} onClick={() => setInspectUser(null)}>
          <div className={`${styles.modal} ${styles.modalLarge}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Eye size={18} color="var(--accent)" />
                <h3 className={styles.modalTitle}>Inspect User: {inspectUser.displayName}</h3>
              </div>
              <button
                type="button"
                className={styles.closeIconBtn}
                onClick={() => setInspectUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  UID: <code className="mono">{inspectUser.uid}</code>
                </span>
                <button
                  type="button"
                  className={styles.actionBtn}
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
                  <Copy size={13} />
                  <span>{copiedUid === 'inspect-json' ? 'Copied!' : 'Copy Raw JSON'}</span>
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
                      updatedAt: inspectUser.updatedAt,
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
                className={styles.actionBtn}
                onClick={() => setInspectUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER STATS & PROFILE */}
      {editUser && (
        <div className={styles.modalBackdrop} onClick={() => setEditUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Edit3 size={18} color="var(--accent)" />
                <h3 className={styles.modalTitle}>Edit User Profile &amp; Stats</h3>
              </div>
              <button
                type="button"
                className={styles.closeIconBtn}
                onClick={() => setEditUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Display Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Solved Count Override</label>
                  <input
                    type="number"
                    min={0}
                    max={625}
                    className={styles.formInput}
                    value={editSolvedCount}
                    onChange={(e) => setEditSolvedCount(Number(e.target.value))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Daily Streak (Days)</label>
                  <input
                    type="number"
                    min={0}
                    className={styles.formInput}
                    value={editStreak}
                    onChange={(e) => setEditStreak(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Weekly Solves Count</label>
                <input
                  type="number"
                  min={0}
                  className={styles.formInput}
                  value={editWeeklyCount}
                  onChange={(e) => setEditWeeklyCount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setEditUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={handleSaveEditUser}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE USER CONFIRMATION */}
      {deleteTarget && (
        <div className={styles.modalBackdrop} onClick={() => setDeleteTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={20} color="#ef4444" />
                <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>
                  Delete User Account
                </h3>
              </div>
              <button
                type="button"
                className={styles.closeIconBtn}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p>
                Are you sure you want to permanently delete user{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.displayName}</strong>{' '}
                ({deleteTarget.email || deleteTarget.uid})?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#f87171' }}>
                ⚠️ This will immediately purge their document from both the{' '}
                <code>users</code> and <code>leaderboard</code> Firestore collections. This action cannot be undone.
              </p>

              <div className={styles.formGroup} style={{ marginTop: 8 }}>
                <label className={styles.formLabel}>
                  Type <strong style={{ color: 'var(--text-primary)' }}>DELETE</strong> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="DELETE"
                  className={styles.formInput}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
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
                  cursor: deleteConfirmText.trim().toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
                onClick={handleConfirmDelete}
              >
                Permanently Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: RESET PROGRESS CONFIRMATION */}
      {resetTarget && (
        <div className={styles.modalBackdrop} onClick={() => setResetTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RotateCcw size={18} color="var(--accent)" />
                <h3 className={styles.modalTitle}>Reset User Progress</h3>
              </div>
              <button
                type="button"
                className={styles.closeIconBtn}
                onClick={() => setResetTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p>
                Reset problem progress, solve log, streaks, and planner for{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{resetTarget.displayName}</strong> back to 0?
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                This is useful if a user requested a fresh start or if bad progress data was pushed.
              </p>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setResetTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={handleConfirmReset}
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
