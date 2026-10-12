"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardIcon from "./dashboard-icon";
import NotificationBell from "./notification-bell";

export default function DashboardSidebar({
  canAccessCrm,
  canManageTeam,
}: {
  canAccessCrm: boolean;
  canManageTeam: boolean;
}) {
  const pathname = usePathname();
  const isDashboardActive = pathname === "/dashboard";
  const isTeamActive = pathname.startsWith("/dashboard/equipe");
  const isCrmActive = pathname.startsWith("/dashboard/leads");
  const isProductsActive = pathname.startsWith("/dashboard/produtos");
  const isOrdersActive = pathname.startsWith("/dashboard/pedidos");

  return (
    <aside aria-label="Navegação principal" className="app-sidebar">
      <Link
        aria-label="SGRC, página inicial"
        className="sidebar-brand"
        href="/dashboard"
      >
        <span aria-hidden="true" className="brand-mark">
          S
        </span>
        <span>
          <strong>SGRC</strong>
          <small>Gestão comercial</small>
        </span>
      </Link>

      {canAccessCrm ? <NotificationBell /> : null}

      <nav className="sidebar-nav">
        <p className="nav-group-label">Início</p>
        <Link
          aria-current={isDashboardActive ? "page" : undefined}
          className={`nav-item${isDashboardActive ? " is-active" : ""}`}
          href="/dashboard"
        >
          <DashboardIcon name="home" />
          <span>Visão geral</span>
        </Link>

        <p className="nav-group-label">Comercial</p>
        {canManageTeam ? (
          <Link
            aria-current={isTeamActive ? "page" : undefined}
            className={`nav-item${isTeamActive ? " is-active" : ""}`}
            href="/dashboard/equipe"
          >
            <DashboardIcon name="team" />
            <span>Equipe e territórios</span>
          </Link>
        ) : null}
        {canAccessCrm ? (
          <Link
            aria-current={isCrmActive ? "page" : undefined}
            className={`nav-item${isCrmActive ? " is-active" : ""}`}
            href="/dashboard/leads"
          >
            <DashboardIcon name="clients" />
            <span>Leads e clientes</span>
          </Link>
        ) : (
          <span aria-disabled="true" className="nav-item is-unavailable">
            <DashboardIcon name="clients" />
            <span>Leads e clientes</span>
            <small>Em breve</small>
          </span>
        )}
        {canAccessCrm ? (
          <Link
            aria-current={isProductsActive ? "page" : undefined}
            className={`nav-item${isProductsActive ? " is-active" : ""}`}
            href="/dashboard/produtos"
          >
            <DashboardIcon name="products" />
            <span>Produtos</span>
          </Link>
        ) : null}
        {canAccessCrm ? (
          <Link
            aria-current={isOrdersActive ? "page" : undefined}
            className={`nav-item${isOrdersActive ? " is-active" : ""}`}
            href="/dashboard/pedidos"
          >
            <DashboardIcon name="orders" />
            <span>Pedidos</span>
          </Link>
        ) : null}

        <p className="nav-group-label">Acompanhamento</p>
        <span aria-disabled="true" className="nav-item is-unavailable">
          <DashboardIcon name="reports" />
          <span>Metas e resultados</span>
          <small>Em breve</small>
        </span>
      </nav>

      <div className="sidebar-footer">
        <span>SGRC</span>
        <span>Gestão em construção</span>
      </div>
    </aside>
  );
}
