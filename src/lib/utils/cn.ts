/**
 * Utility for merging class names
 * Similar to clsx/classnames but lightweight
 */

type ClassValue = string | number | boolean | undefined | null | ClassValue[];

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

// Conditional class helper
export function cond(condition: boolean, trueClass: string, falseClass?: string): string {
    return condition ? trueClass : (falseClass || '');
}
