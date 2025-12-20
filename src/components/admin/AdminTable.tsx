'use client';

import { RefreshCw } from 'lucide-react';

interface Column<T> {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    hideOnMobile?: boolean;
    render?: (item: T, index: number) => React.ReactNode;
}

interface AdminTableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    emptyMessage?: string;
    emptyIcon?: React.ReactNode;
    keyExtractor?: (item: T, index: number) => string;
    onRowClick?: (item: T) => void;
}

export function AdminTable<T>({
    columns,
    data,
    loading = false,
    emptyMessage = 'No data found',
    emptyIcon,
    keyExtractor = (_, i) => String(i),
    onRowClick,
}: AdminTableProps<T>) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12">
                {emptyIcon && <div className="mb-3 flex justify-center text-[var(--text-muted)]">{emptyIcon}</div>}
                <p className="text-[var(--text-muted)]">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className={`p-3 font-medium ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                                style={col.width ? { width: col.width } : undefined}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr
                            key={keyExtractor(item, index)}
                            className={`border-b border-[var(--border-color)] last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-[var(--bg-secondary)]/50' : ''}`}
                            onClick={() => onRowClick?.(item)}
                        >
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className={`p-3 ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                                >
                                    {col.render ? col.render(item, index) : String((item as Record<string, unknown>)[col.key] ?? '')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
