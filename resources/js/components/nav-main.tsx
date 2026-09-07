import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

/** Compara sin querystring y aceptando subrutas (`/x` cubre `/x/detalle`). */
function urlPertenece(itemUrl: string, url: string): boolean {
    if (itemUrl === '#' || itemUrl === '' || itemUrl === '/') return false;
    const actual = url.split('?')[0];
    return actual === itemUrl || actual.startsWith(itemUrl.replace(/\/$/, '') + '/');
}

/**
 * ¿La url actual coincide con este ítem o con alguno de sus descendientes?
 * Se usa tanto para marcar el ítem activo como para decidir si un grupo
 * colapsable arranca abierto — clave porque el layout (y por tanto el
 * sidebar) se re-monta en cada navegación, así que `defaultOpen` se vuelve a
 * evaluar cada vez.
 */
function containsUrl(item: NavItem, url: string): boolean {
    if (urlPertenece(item.url, url)) return true;
    return item.items?.some((child) => containsUrl(child, url)) ?? false;
}

/** Nivel de submenú (dentro de un módulo ya desplegado). Soporta un nivel más de anidación. */
function NavSubItems({ items, currentUrl }: { items: NavItem[]; currentUrl: string }) {
    return (
        <SidebarMenuSub>
            {items.map((item) =>
                item.items?.length ? (
                    <Collapsible key={item.title} defaultOpen={containsUrl(item, currentUrl)} className="group/subcollapsible">
                        <SidebarMenuSubItem>
                            <CollapsibleTrigger asChild>
                                <SidebarMenuButton size="sm" isActive={containsUrl(item, currentUrl)}>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                    <ChevronRight className="ml-auto size-3.5 transition-transform duration-200 group-data-[state=open]/subcollapsible:rotate-90" />
                                </SidebarMenuButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <NavSubItems items={item.items} currentUrl={currentUrl} />
                            </CollapsibleContent>
                        </SidebarMenuSubItem>
                    </Collapsible>
                ) : (
                    <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton
                            asChild
                            isActive={item.url === currentUrl}
                            style={item.url === currentUrl && item.color ? { color: item.color } : undefined}
                        >
                            <Link href={item.url} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                ),
            )}
        </SidebarMenuSub>
    );
}

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const { state } = useSidebar();

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => {
                    // Activo si la URL es del módulo o de cualquiera de sus
                    // submódulos — incluidos los que viven en su propia ruta
                    // fuera del prefijo del módulo (ej. "5 Por Qué" → /cinco-porques).
                    const isGroupActive = containsUrl(item, page.url);

                    // Con el sidebar retraído a solo íconos no hay espacio para desplegar
                    // los submódulos, así que el ícono navega directo a la vista general
                    // del módulo en vez de intentar abrir el submenú (que quedaría oculto).
                    if (item.items?.length && state === 'collapsed') {
                        return (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isGroupActive}
                                    tooltip={item.title}
                                    style={isGroupActive && item.color ? { color: item.color } : undefined}
                                >
                                    <Link href={item.url} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    }

                    return item.items?.length ? (
                        <Collapsible key={item.title} asChild defaultOpen={isGroupActive} className="group/collapsible">
                            <SidebarMenuItem>
                                {isGroupActive && item.color && (
                                    <span
                                        className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full transition-colors"
                                        style={{ backgroundColor: item.color }}
                                        aria-hidden
                                    />
                                )}
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton
                                        isActive={isGroupActive}
                                        style={isGroupActive && item.color ? { color: item.color } : undefined}
                                    >
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <NavSubItems items={item.items} currentUrl={page.url} />
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    ) : (
                        <SidebarMenuItem key={item.title}>
                            {item.url === page.url && item.color && (
                                <span
                                    className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                    aria-hidden
                                />
                            )}
                            <SidebarMenuButton
                                asChild
                                isActive={item.url === page.url}
                                style={item.url === page.url && item.color ? { color: item.color } : undefined}
                            >
                                <Link href={item.url} prefetch>
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );
}
