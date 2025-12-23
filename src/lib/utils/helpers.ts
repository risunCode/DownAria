/**
 * Helper Utilities
 * Small utility functions for common operations
 */

// ============================================================================
// CLASS NAME UTILITIES
// ============================================================================

type ClassValue = string | number | boolean | undefined | null | ClassValue[];

/**
 * Merge class names (similar to clsx/classnames but lightweight)
 * @example cn('btn', isActive && 'btn-active', 'px-4') => "btn btn-active px-4"
 */
export function cn(...inputs: ClassValue[]): string {
    const classes: string[] = [];
    
    for (const input of inputs) {
        if (!input) continue;
        
        if (typeof input === 'string' || typeof input === 'number') {
            classes.push(String(input));
        } else if (Array.isArray(input)) {
            const nested = cn(...input);
            if (nested) classes.push(nested);
        }
    }
    
    return classes.join(' ');
}

/**
 * Conditional class helper
 * @example cond(isActive, 'text-blue', 'text-gray') => "text-blue" or "text-gray"
 */
export function cond(condition: boolean, trueClass: string, falseClass?: string): string {
    return condition ? trueClass : (falseClass || '');
}

// ============================================================================
// ID GENERATION
// ============================================================================

/**
 * Generate unique ID
 * @example generateId() => "lxyz123abc"
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
