'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, Shield, ShieldCheck, UserCheck, Activity, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight, UserPlus, Ban, X } from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';

interface User {
    id: string;
    email: string;
    username: string | null;
    display_name: string | null;
    role: 'user' | 'admin';
    is_active: boolean;
    referral_code: string | null;
    total_referrals: number;
    last_login: string | null;
    last_activity: string | null;
    created_at: string;
}

interface ActivityLog {
    id: number;
    action: string;
    details: Record<string, unknown> | null;
    ip_address: string | null;
    country: string | null;
    created_at: string;
}

export default function AdminUsersPage() {
    return (
        <AdminGuard requiredRole="admin">
            <UsersContent />
        </AdminGuard>
    );
}

function UsersContent() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showActivity, setShowActivity] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    const [activity, setActivity] = useState<ActivityLog[]>([]);
    const [editForm, setEditForm] = useState({ role: '' });
    const [addForm, setAddForm] = useState({ email: '', password: '', role: 'user' });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    // Get auth token from Supabase session
    const getAuthHeaders = useCallback((): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (supabaseKey) {
            try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                const token = session?.access_token;
                if (token) headers['Authorization'] = `Bearer ${token}`;
            } catch { /* ignore */ }
        }
        return headers;
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                ...(search && { search }),
                ...(roleFilter && { role: roleFilter }),
                ...(statusFilter && { status: statusFilter })
            });
            const res = await fetch(`${API_URL}/api/admin/users?${params}`, { headers: getAuthHeaders() });
            const json = await res.json();
            if (json.success) {
                setUsers(json.data.users);
                setTotalPages(json.data.totalPages);
                setTotal(json.data.total);
            }
        } catch {
            // Failed to fetch users
        }
        setLoading(false);
    }, [page, search, roleFilter, statusFilter, API_URL, getAuthHeaders]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleToggleStatus = async (user: User) => {
        const action = user.is_active ? 'freeze' : 'unfreeze';
        const result = await Swal.fire({
            title: `${action === 'freeze' ? 'Freeze' : 'Unfreeze'} account?`,
            text: user.is_active ? 'User will not be able to login.' : 'User will be able to login again.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: user.is_active ? '#3b82f6' : '#22c55e',
            confirmButtonText: action === 'freeze' ? 'Yes, freeze!' : 'Yes, unfreeze!',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'toggleStatus', userId: user.id, isActive: !user.is_active })
        });
        if ((await res.json()).success) {
            fetchUsers();
            Swal.fire({ title: 'Done!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleSetRole = async () => {
        if (!selectedUser) return;
        const result = await Swal.fire({
            title: 'Change role?',
            text: `Set ${selectedUser.email} as ${editForm.role.replace('_', ' ')}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#8b5cf6',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'updateRole', userId: selectedUser.id, role: editForm.role })
        });
        if ((await res.json()).success) {
            fetchUsers();
            setShowEdit(false);
            Swal.fire({ title: 'Role updated!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleAddUser = async () => {
        if (!addForm.email || !addForm.password) return;
        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'createUser', ...addForm })
        });
        const json = await res.json();
        if (json.success) {
            fetchUsers();
            setShowAddUser(false);
            setAddForm({ email: '', password: '', role: 'user' });
            Swal.fire({ title: 'User created!', icon: 'success', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } else {
            Swal.fire({ title: 'Error', text: json.error, icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleViewActivity = async (user: User) => {
        setSelectedUser(user);
        setShowActivity(true);
        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'getActivity', userId: user.id })
        });
        const json = await res.json();
        if (json.success) setActivity(json.data);
    };

    const handleDelete = async (user: User) => {
        const result = await Swal.fire({
            title: 'Delete user?',
            html: `Delete <strong>${user.email}</strong>?<br><small class="text-red-400">All data will be permanently removed.</small>`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ userId: user.id })
        });
        if ((await res.json()).success) {
            fetchUsers();
            Swal.fire({ title: 'Deleted!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

    const RoleBadge = ({ role }: { role: string }) => {
        const cfg: Record<string, { bg: string; icon: React.ReactNode }> = {
            admin: { bg: 'bg-amber-500/20 text-amber-400', icon: <ShieldCheck className="w-3 h-3" /> },
            user: { bg: 'bg-blue-500/20 text-blue-400', icon: <Users className="w-3 h-3" /> },
        };
        return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${cfg[role]?.bg}`}>{cfg[role]?.icon} {role.replace('_', ' ')}</span>;
    };

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                        <Users className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Users</h1>
                        <p className="text-sm text-[var(--text-muted)]">{total} registered users</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm hover:opacity-90">
                        <UserPlus className="w-4 h-4" /> Add User
                    </button>
                    <button onClick={fetchUsers} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)]">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input type="text" placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm" />
                </div>
                <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Frozen</option>
                </select>
            </div>

            {/* Users Grid */}
            <div className="grid gap-3">
                {loading ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">No users found</div>
                ) : users.map((user, i) => (
                    <motion.div key={user.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                        className={`glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-4 ${!user.is_active ? 'opacity-60' : ''}`}>
                        {/* Avatar & Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)] font-bold shrink-0">
                                {user.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium truncate">{user.display_name || user.username || user.email.split('@')[0]}</div>
                                <div className="text-xs text-[var(--text-muted)] truncate">{user.email}</div>
                            </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <RoleBadge role={user.role} />
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {user.is_active ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                {user.is_active ? 'Active' : 'Frozen'}
                            </span>
                            {user.referral_code && <span className="text-xs text-[var(--text-muted)]">{user.referral_code}</span>}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                            <span title="Referrals">👥 {user.total_referrals}</span>
                            <span title="Last active">{formatDate(user.last_activity || user.last_login)}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <button onClick={() => handleViewActivity(user)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title="Activity">
                                <Activity className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setSelectedUser(user); setEditForm({ role: user.role }); setShowEdit(true); }} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title="Set Role">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleToggleStatus(user)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title={user.is_active ? 'Freeze' : 'Unfreeze'}>
                                {user.is_active ? <Ban className="w-4 h-4 text-blue-400" /> : <UserCheck className="w-4 h-4 text-green-400" />}
                            </button>
                            <button onClick={() => handleDelete(user)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]" title="Delete">
                                <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg bg-[var(--bg-card)] disabled:opacity-50">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg bg-[var(--bg-card)] disabled:opacity-50">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Add User Modal */}
            {showAddUser && (
                <Modal title="Add User" onClose={() => setShowAddUser(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
                            <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="user@example.com" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Password</label>
                            <input type="password" value={addForm.password} onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="••••••••" />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Role</label>
                            <select value={addForm.role} onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button onClick={handleAddUser} className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm hover:opacity-90">Create User</button>
                    </div>
                </Modal>
            )}

            {/* Edit Role Modal */}
            {showEdit && selectedUser && (
                <Modal title="Set Role" onClose={() => setShowEdit(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-[var(--text-muted)]">{selectedUser.email}</p>
                        <select value={editForm.role} onChange={(e) => setEditForm({ role: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button onClick={handleSetRole} className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm hover:opacity-90">Save</button>
                    </div>
                </Modal>
            )}

            {/* Activity Modal */}
            {showActivity && selectedUser && (
                <Modal title={`Activity: ${selectedUser.email}`} onClose={() => setShowActivity(false)} wide>
                    {activity.length === 0 ? (
                        <p className="text-center text-[var(--text-muted)] py-8">No activity</p>
                    ) : (
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {activity.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 p-3 bg-[var(--bg-secondary)] rounded-lg">
                                    <Activity className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{log.action}</span>
                                            {log.country && <span className="text-xs text-[var(--text-muted)]">{log.country}</span>}
                                            {log.ip_address && <span className="text-xs text-[var(--text-muted)]">{log.ip_address}</span>}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">{formatDate(log.created_at)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl ${wide ? 'w-full max-w-2xl' : 'w-full max-w-sm'}`}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                    <h3 className="font-semibold">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4">{children}</div>
            </motion.div>
        </div>
    );
}
