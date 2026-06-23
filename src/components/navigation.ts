import { Package, Boxes, Users, Wallet, UserSquare, LayoutDashboard, ShoppingCart, Cloud } from "lucide-react";
import { CLOUD_SLUG } from "@/lib/files/types";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  key: string;
  label: string;
  /** Куда ведёт верхняя вкладка по клику (первый пункт раздела). */
  basePath: string;
  items: NavItem[];
}

// Верхние вкладки. Внутри каждой — свои боковые пункты.
export const SECTIONS: NavSection[] = [
  {
    key: "overview",
    label: "Обзор",
    basePath: "/",
    items: [
      { href: "/", label: "Обзор", icon: LayoutDashboard },
    ],
  },
  {
    key: "china",
    label: "Китай",
    basePath: "/procurement",
    items: [
      { href: "/procurement", label: "Закупки", icon: ShoppingCart },
      { href: "/orders", label: "Отправки", icon: Boxes },
      { href: "/orders/new", label: "Создать", icon: Package },
      { href: "/recipients", label: "Получатели", icon: Users },
    ],
  },
  {
    key: "files",
    label: "Файлы",
    basePath: `/files/${CLOUD_SLUG}`,
    items: [
      { href: `/files/${CLOUD_SLUG}`, label: "Облако", icon: Cloud },
    ],
  },
  {
    key: "smmlaba",
    label: "SmmLaba",
    basePath: "/balances",
    items: [
      { href: "/balances", label: "Балансы", icon: Wallet },
      { href: "/salaries", label: "Зарплаты", icon: Wallet },
      { href: "/salaries/employees", label: "Сотрудники", icon: UserSquare },
    ],
  },
];

function matchesItem(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

// Раздел, которому принадлежит текущий путь. По умолчанию — первый (Китай),
// чтобы вспомогательные страницы вроде /settings показывали осмысленный сайдбар.
export function sectionForPath(pathname: string): NavSection {
  return (
    SECTIONS.find((s) => s.items.some((i) => matchesItem(i, pathname))) ??
    SECTIONS[0]
  );
}

// Активный боковой пункт — самый длинный href, являющийся префиксом пути.
// Так /orders/new подсвечивает «Создать», а не «Отправки».
export function activeItem(
  items: NavItem[],
  pathname: string,
): NavItem | undefined {
  return items
    .filter((i) => matchesItem(i, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
