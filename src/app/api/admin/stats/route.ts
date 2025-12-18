import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/utils/admin-auth';
import { 
    getDownloadsByPlatform, 
    getDownloadsByCountry, 
    getDownloadsBySource, 
    getSuccessRate,
    getRecentErrors,
    getStats
} from '@/lib/supabase';

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7');
        const type = searchParams.get('type') || 'all';

        switch (type) {
            case 'platform':
                return NextResponse.json({ 
                    success: true, 
                    data: await getDownloadsByPlatform(days) 
                });
            
            case 'country':
                return NextResponse.json({ 
                    success: true, 
                    data: await getDownloadsByCountry(days) 
                });
            
            case 'source':
                return NextResponse.json({ 
                    success: true, 
                    data: await getDownloadsBySource(days) 
                });
            
            case 'success':
                return NextResponse.json({ 
                    success: true, 
                    data: await getSuccessRate(days) 
                });
            
            case 'errors':
                return NextResponse.json({ 
                    success: true, 
                    data: await getRecentErrors(20) 
                });
            
            case 'all':
            default:
                const [platform, country, source, successRate, errors, raw] = await Promise.all([
                    getDownloadsByPlatform(days),
                    getDownloadsByCountry(days),
                    getDownloadsBySource(days),
                    getSuccessRate(days),
                    getRecentErrors(10),
                    getStats(days)
                ]);

                // Calculate daily trend
                const dailyTrend: Record<string, number> = {};
                if (raw) {
                    raw.forEach(row => {
                        const date = new Date(row.created_at).toISOString().split('T')[0];
                        dailyTrend[date] = (dailyTrend[date] || 0) + 1;
                    });
                }

                return NextResponse.json({
                    success: true,
                    data: {
                        period: `${days} days`,
                        platform,
                        country,
                        source,
                        successRate,
                        dailyTrend,
                        recentErrors: errors,
                    }
                });
        }
    } catch {
        return NextResponse.json(
            { success: false, error: 'Failed to fetch stats' },
            { status: 500 }
        );
    }
}
