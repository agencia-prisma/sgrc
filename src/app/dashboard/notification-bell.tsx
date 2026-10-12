"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type SalesOrderNotification = {
  id: string;
  order_id: string;
  notification_type: "approved" | "rejected";
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<
    SalesOrderNotification[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeNotificationId, setActiveNotificationId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isMounted = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          notifications?: SalesOrderNotification[];
          error?: string;
        };
        if (!response.ok) {
          if (isMounted) {
            setErrorMessage(
              result.error ?? "Não foi possível carregar as notificações.",
            );
          }
          return;
        }
        if (isMounted) {
          setNotifications(result.notifications ?? []);
          setErrorMessage(null);
        }
      } catch {
        if (isMounted) {
          setErrorMessage(
            "Não foi possível conectar ao serviço de notificações.",
          );
        }
      }
    };

    void loadNotifications();
    const intervalId = window.setInterval(() => void loadNotifications(), 60_000);
    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;

  async function openNotification(notification: SalesOrderNotification) {
    setActiveNotificationId(notification.id);
    setErrorMessage(null);
    try {
      if (!notification.read_at) {
        const response = await fetch(
          `/api/notifications/${notification.id}/read`,
          { method: "PATCH" },
        );
        const result = (await response.json()) as { error?: string };
        if (!response.ok) {
          setErrorMessage(
            result.error ?? "Não foi possível marcar a notificação como lida.",
          );
          return;
        }
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, read_at: new Date().toISOString() }
              : item,
          ),
        );
      }
      setIsOpen(false);
      router.push(`/dashboard/pedidos/${notification.order_id}`);
    } catch {
      setErrorMessage(
        "Não foi possível atualizar a notificação. Tente novamente.",
      );
    } finally {
      setActiveNotificationId(null);
    }
  }

  return (
    <div className="notification-center">
      <button
        aria-expanded={isOpen}
        aria-label={
          unreadCount > 0
            ? `Notificações, ${unreadCount} não lida(s)`
            : "Notificações"
        }
        className="notification-toggle"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="19"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        <span>Notificações</span>
        {unreadCount > 0 ? (
          <span aria-hidden="true" className="notification-count">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          aria-label="Central de notificações"
          className="notification-panel"
        >
          <div className="notification-panel-heading">
            <strong>Notificações</strong>
            <button
              aria-label="Fechar notificações"
              className="notification-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              ×
            </button>
          </div>
          {errorMessage ? (
            <p className="notification-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {notifications.length > 0 ? (
            <ul className="notification-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    className={`notification-item${notification.read_at ? "" : " is-unread"}`}
                    disabled={activeNotificationId === notification.id}
                    onClick={() => void openNotification(notification)}
                    type="button"
                  >
                    <span className="notification-item-title">
                      {notification.title}
                    </span>
                    <span className="notification-item-message">
                      {notification.message}
                    </span>
                    <time dateTime={notification.created_at}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(notification.created_at))}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notification-empty">Nenhuma notificação por aqui.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
