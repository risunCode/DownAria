'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ShieldCheck, UserCheck, Edit, Trash2, RefreshCw, ChevronLeft, ChevronRight, UserPlus, Ban, X, Gift, Plus, Copy, Crown, Check, Clock } from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { useSpecialReferrals, type SpecialReferral, type CreateReferralData } from '@/hooks/admin';

type TabType = 'users' | 'referrals';

interface User {
    id: string;
    email: string;
    username: string | null;
    display_name: string | null;
    role: 'user' | 'admin';
    status: 'active' | 'frozen' | 'banned';
    referral_code: string | null;
    total_referrals: number;
    last_seen: string | null;
    first_joined: string;
}

export default function AdminUsersPage() {
    return (
        <AdminGuard requiredRole="admin">
            <UsersContent />
        </AdminGuard>
    );
}

function UsersContent() {
    const [activeTab, setActiveTab] = useState<TabType>('users');

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                    <Users className="w-5 h-5 text-[var(--accent-primary)]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold">User Management</h1>
                    <p className="text-sm text-[var(--text-muted)]">Manage users and referral codes</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'users' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                    }`}
                >
                    <Users className="w-4 h-4" /> Users
                </button>
                <button
                    onClick={() => setActiveTab('referrals')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'referrals' ? 'bg-purple-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                    }`}
                >
                    <Gift className="w-4 h-4" /> Referral Codes
                </button>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                {activeTab === 'users' ? (
                    <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <UsersTab />
                    </motion.div>
                ) : (
                    <motion.div key="referrals" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <ReferralsTab />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// USERS TAB
// ═══════════════════════════════════════════════════════════════

function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showEdit, setShowEdit] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    const [editForm, setEditForm] = useState({ role: '' });
    const [addForm, setAddForm] = useState({ email: '', password: '', role: 'user' });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const getAuthHeaders = useCallback((): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (supabaseKey) {
            try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
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
        } catch { /* ignore */ }
        setLoading(false);
    }, [page, search, roleFilter, statusFilter, API_URL, getAuthHeaders]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const toast = (icon: 'success' | 'error', title: string) => {
        Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
    };

    const handleToggleStatus = async (user: User) => {
        // Determine next status in cycle: active -> frozen -> banned -> active
        const statusCycle: Record<string, 'active' | 'frozen' | 'banned'> = {
            'active': 'frozen',
            'frozen': 'banned',
            'banned': 'active'
        };
        const nextStatus = statusCycle[user.status] || 'active';
        
        const statusLabels: Record<string, string> = {
            'active': 'Activate',
            'frozen': 'Freeze',
            'banned': 'Ban'
        };
        
        const statusColors: Record<string, string> = {
            'active': '#22c55e',
            'frozen': '#3b82f6',
            'banned': '#ef4444'
        };

        const result = await Swal.fire({
            title: `${statusLabels[nextStatus]} account?`,
            html: `<p class="text-sm">Change status from <b>${user.status}</b> to <b>${nextStatus}</b></p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: statusColors[nextStatus],
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'updateStatus', userId: user.id, status: nextStatus })
        });
        if ((await res.json()).success) {
            fetchUsers();
            toast('success', 'Status updated');
        }
    };

    const handleSetRole = async () => {
        if (!selectedUser) return;
        
        // Warning if trying to demote admin
        if (selectedUser.role === 'admin' && editForm.role === 'user') {
            toast('error', 'Cannot demote admin to user');
            return;
        }

        const res = await fetch(`${API_URL}/api/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ action: 'updateRole', userId: selectedUser.id, role: editForm.role })
        });
        const json = await res.json();
        if (json.success) {
            fetchUsers();
            setShowEdit(false);
            toast('success', 'Role updated');
        } else {
            toast('error', json.error || 'Failed');
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
            toast('success', 'User created');
        } else {
            toast('error', json.error || 'Failed');
        }
    };

    const handleDelete = async (user: User) => {
        const result = await Swal.fire({
            title: 'Delete user?',
            html: `<strong>${user.email}</strong>`,
            icon: 'error',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
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
            toast('success', 'User deleted');
        }
    };

    const formatDate = (date: string | null) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';

    return (
        <div className="space-y-4">
            {/* Actions & Filters */}
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
                    <option value="frozen">Frozen</option>
                    <option value="banned">Banned</option>
                </select>
                <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm">
                    <UserPlus className="w-4 h-4" /> Add
                </button>
                <button onClick={fetchUsers} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Stats */}
            <div className="text-sm text-[var(--text-muted)]">{total} users</div>

            {/* Users List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">No users found</div>
                ) : users.map((user, i) => (
                    <motion.div key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        className={`glass-card p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${user.status !== 'active' ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)] font-bold text-sm shrink-0">
                                {user.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{user.display_name || user.username || user.email.split('@')[0]}</div>
                                <div className="text-xs text-[var(--text-muted)] truncate">{user.email}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                {user.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />} {user.role}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                user.status === 'active' ? 'bg-green-500/20 text-green-400' : 
                                user.status === 'frozen' ? 'bg-blue-500/20 text-blue-400' : 
                                'bg-red-500/20 text-red-400'
                            }`}>
                                {user.status === 'active' ? 'Active' : user.status === 'frozen' ? 'Frozen' : 'Banned'}
                            </span>
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{formatDate(user.first_joined)}</div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => { setSelectedUser(user); setEditForm({ role: user.role }); setShowEdit(true); }} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" title="Edit Role">
                                <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleToggleStatus(user)} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" title={`Current: ${user.status}`}>
                                {user.status === 'active' ? <Ban className="w-4 h-4 text-blue-400" /> : 
                                 user.status === 'frozen' ? <Ban className="w-4 h-4 text-red-400" /> : 
                                 <UserCheck className="w-4 h-4 text-green-400" />}
                            </button>
                            <button onClick={() => handleDelete(user)} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" title="Delete">
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
                        <input type="email" value={addForm.email} onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="Email" />
                        <input type="password" value={addForm.password} onChange={(e) => setAddForm(f => ({ ...f, password: e.target.value }))}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="Password" />
                        <select value={addForm.role} onChange={(e) => setAddForm(f => ({ ...f, role: e.target.value }))}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button onClick={handleAddUser} className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm">Create</button>
                    </div>
                </Modal>
            )}

            {/* Edit Role Modal */}
            {showEdit && selectedUser && (
                <Modal title="Edit Role" onClose={() => setShowEdit(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-[var(--text-muted)]">{selectedUser.email}</p>
                        {selectedUser.role === 'admin' && (
                            <p className="text-xs text-amber-400 bg-amber-500/10 p-2 rounded">⚠️ Admin cannot be demoted to user</p>
                        )}
                        <select value={editForm.role} onChange={(e) => setEditForm({ role: e.target.value })}
                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm"
                            disabled={selectedUser.role === 'admin'}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <button onClick={handleSetRole} disabled={selectedUser.role === 'admin' && editForm.role === 'user'} 
                            className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm disabled:opacity-50">Save</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// REFERRALS TAB
// ═══════════════════════════════════════════════════════════════

function ReferralsTab() {
    const { referrals, loading, saving, refetch, createReferral, toggleActive, deleteReferral, copyCode } = useSpecialReferrals();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<CreateReferralData>({ role: 'user', max_uses: 1 });

    const handleCreate = async () => {
        const result = await createReferral(form);
        if (result) {
            setShowCreate(false);
            setForm({ role: 'user', max_uses: 1 });
        }
    };

    const getStatus = (ref: SpecialReferral) => {
        if (!ref.is_active) return { label: 'Disabled', color: 'text-gray-400 bg-gray-500/20' };
        if (ref.expires_at && new Date(ref.expires_at) < new Date()) return { label: 'Expired', color: 'text-red-400 bg-red-500/20' };
        if (ref.current_uses >= ref.max_uses) return { label: 'Exhausted', color: 'text-orange-400 bg-orange-500/20' };
        return { label: 'Active', color: 'text-green-400 bg-green-500/20' };
    };

    const activeCount = referrals.filter(r => r.is_active && r.current_uses < r.max_uses).length;
    const adminCount = referrals.filter(r => r.role === 'admin').length;

    return (
        <div className="space-y-4">
            {/* Actions */}
            <div className="flex justify-between items-center">
                <div className="flex gap-4 text-sm">
                    <span className="text-[var(--text-muted)]">{referrals.length} codes</span>
                    <span className="text-green-400">{activeCount} active</span>
                    <span className="text-amber-400">{adminCount} admin</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm hover:opacity-90">
                        <Plus className="w-4 h-4" /> Create Code
                    </button>
                    <button onClick={refetch} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Referrals List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                ) : referrals.length === 0 ? (
                    <div className="text-center py-12">
                        <Gift className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3" />
                        <p className="text-[var(--text-muted)]">No referral codes yet</p>
                        <button onClick={() => setShowCreate(true)} className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm">
                            Create First Code
                        </button>
                    </div>
                ) : referrals.map((ref, i) => {
                    const status = getStatus(ref);
                    return (
                        <motion.div 
                            key={ref.id} 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            transition={{ delay: i * 0.02 }}
                            className={`glass-card p-3 ${!ref.is_active ? 'opacity-60' : ''}`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                {/* Code & Role */}
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={`p-2 rounded-lg ${ref.role === 'admin' ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                                        {ref.role === 'admin' ? <Crown className="w-4 h-4 text-amber-400" /> : <Users className="w-4 h-4 text-blue-400" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <code className="font-mono font-bold">{ref.code}</code>
                                            <button onClick={() => copyCode(ref.code)} className="p-1 rounded hover:bg-[var(--bg-secondary)]">
                                                <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                            <span className={`px-1.5 py-0.5 rounded ${ref.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                {ref.role}
                                            </span>
                                            {ref.note && <span>• {ref.note}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Usage & Status */}
                                <div className="flex items-center gap-3">
                                    <div className="text-center text-sm">
                                        <span className="font-medium">{ref.current_uses}/{ref.max_uses}</span>
                                        <span className="text-[var(--text-muted)] ml-1">uses</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>{status.label}</span>
                                    {ref.expires_at && (
                                        <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                            <Clock className="w-3 h-3" /> {new Date(ref.expires_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                    <button onClick={() => toggleActive(ref.id, !ref.is_active)} disabled={saving} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" title={ref.is_active ? 'Disable' : 'Enable'}>
                                        {ref.is_active ? <Ban className="w-4 h-4 text-orange-400" /> : <Check className="w-4 h-4 text-green-400" />}
                                    </button>
                                    <button onClick={() => deleteReferral(ref.id)} disabled={saving} className="p-1.5 rounded hover:bg-[var(--bg-secondary)]" title="Delete">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <Modal title="Create Referral Code" onClose={() => setShowCreate(false)}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Code (optional)</label>
                            <input 
                                type="text" 
                                value={form.code || ''} 
                                onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-mono"
                                placeholder="Auto-generate if empty"
                                maxLength={20}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Role Grant</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => setForm(f => ({ ...f, role: 'user' }))}
                                    className={`p-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${form.role === 'user' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-[var(--border-color)]'}`}>
                                    <Users className="w-4 h-4" /> User
                                </button>
                                <button onClick={() => setForm(f => ({ ...f, role: 'admin' }))}
                                    className={`p-2 rounded-lg border text-sm flex items-center justify-center gap-2 ${form.role === 'admin' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-[var(--border-color)]'}`}>
                                    <Crown className="w-4 h-4" /> Admin
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Max Uses</label>
                            <input type="number" value={form.max_uses} onChange={(e) => setForm(f => ({ ...f, max_uses: parseInt(e.target.value) || 1 }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" min={1} max={100} />
                        </div>
                        <div>
                            <label className="block text-sm text-[var(--text-muted)] mb-1">Note (optional)</label>
                            <input type="text" value={form.note || ''} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" placeholder="e.g., For beta testers" />
                        </div>
                        <button onClick={handleCreate} disabled={saving}
                            className="w-full py-2 bg-purple-500 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Code
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-md"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                    <h3 className="font-semibold">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-secondary)]">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4">{children}</div>
            </motion.div>
        </div>
    );
}
