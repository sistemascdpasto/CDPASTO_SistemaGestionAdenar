import { LucideIcon } from 'lucide-react';

export interface Auth {
    user: User;
    roles: string[];
    isAdmin: boolean;
    isColaborador: boolean;
    accessibleModules: string[];
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    url: string;
    icon?: LucideIcon | null;
    isActive?: boolean;
    items?: NavItem[];
    /** Optional brand accent color for this nav entry (used for subtle active-state tinting). */
    color?: string;
    /**
     * Submódulo transversal presente en varias secciones a la vez. No cuenta
     * para decidir si un grupo colapsable arranca abierto (ver nav-main.tsx).
     */
    shared?: boolean;
}

export type FlashStatus = string | { message: string; type?: 'success' | 'warning' | 'error' } | null;

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    status?: FlashStatus;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown; // This allows for additional properties...
}
