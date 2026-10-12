"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  APP_ROLES,
  isAppRole,
  type SystemAdminUser,
} from "@/lib/admin-users";
import type { AppRole } from "@/lib/supabase/database.types";

export default function UsersManager({
  currentUserId,
  initialUsers,
  initialHasMore,
  roleLabels,
}: {
  currentUserId: string;
  initialUsers: SystemAdminUser[];
  initialHasMore: boolean;
  roleLabels: Record<AppRole, string>;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<AppRole>("representative");
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return users;
    return users.filter(
      (user) =>
        user.displayName?.toLocaleLowerCase("pt-BR").includes(term) ||
        user.email?.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [search, users]);

  async function sendRequest(
    url: string,
    method: "POST" | "PATCH",
    payload: Record<string, unknown>,
  ) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      message?: string;
      error?: string;
      user?: SystemAdminUser;
    };
    if (!response.ok) {
      throw new Error(result.error ?? "Não foi possível concluir a operação.");
    }
    return result;
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setErrorMessage(null);
    setActiveOperation("invite");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const result = await sendRequest("/api/admin/users", "POST", {
        displayName: formData.get("displayName"),
        email: formData.get("email"),
        role: selectedRole,
      });
      setNotice(result.message ?? "Convite enviado.");
      form.reset();
      setSelectedRole("representative");
      const invitedUser = result.user;
      if (invitedUser) {
        setUsers((current) => [
          invitedUser,
          ...current.filter((user) => user.id !== invitedUser.id),
        ]);
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o convite.",
      );
    } finally {
      setActiveOperation(null);
    }
  }

  async function loadMoreUsers() {
    setErrorMessage(null);
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const response = await fetch(`/api/admin/users?page=${nextPage}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as {
        users?: SystemAdminUser[];
        hasMore?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Não foi possível carregar usuários.");
      }
      setUsers((current) => [
        ...current,
        ...(result.users ?? []).filter(
          (user) => !current.some((existing) => existing.id === user.id),
        ),
      ]);
      setPage(nextPage);
      setHasMore(result.hasMore ?? false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar usuários.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function changeRole(
    user: SystemAdminUser,
    operation: "assign" | "remove",
    role: AppRole,
  ) {
    if (
      operation === "remove" &&
      !window.confirm(
        `Remover o papel "${roleLabels[role]}" de ${user.displayName || user.email || "este usuário"}?`,
      )
    ) {
      return;
    }

    const operationKey = `${user.id}:${operation === "assign" ? "assign" : role}`;
    setActiveOperation(operationKey);
    setNotice(null);
    setErrorMessage(null);
    try {
      const result = await sendRequest("/api/admin/users", "PATCH", {
        userId: user.id,
        operation,
        role,
      });
      setNotice(result.message ?? "Acesso atualizado.");
      if (operation === "assign") {
        setUsers((current) =>
          current.map((entry) => {
            if (entry.id !== user.id) return entry;
            const changedRoles =
              role === "representative" || role === "promoter"
                ? entry.roles.filter(
                    (entryRole) =>
                      entryRole !== "representative" &&
                      entryRole !== "promoter",
                  )
                : entry.roles;
            return {
              ...entry,
              roles: [
                ...changedRoles.filter((entryRole) => entryRole !== role),
                role,
              ],
            };
          }),
        );
      } else {
        setUsers((current) =>
          current.map((entry) =>
            entry.id === user.id
              ? { ...entry, roles: entry.roles.filter((item) => item !== role) }
              : entry,
          ),
        );
      }
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o acesso.",
      );
    } finally {
      setActiveOperation(null);
    }
  }

  return (
    <>
      <section
        aria-labelledby="invite-user-title"
        className="module-section crm-section"
      >
        <div className="section-heading">
          <div>
            <h2 className="section-title" id="invite-user-title">
              Convidar usuário
            </h2>
            <p>
              O usuário receberá um e-mail para definir a senha e entrar no
              sistema.
            </p>
          </div>
        </div>
        <form className="form system-user-invite-form" onSubmit={handleInvite}>
          <label className="field" htmlFor="system-user-name">
            Nome completo
            <input
              autoComplete="name"
              className="input"
              id="system-user-name"
              maxLength={120}
              name="displayName"
              required
            />
          </label>
          <label className="field" htmlFor="system-user-email">
            E-mail
            <input
              autoComplete="email"
              className="input"
              id="system-user-email"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="field" htmlFor="system-user-role">
            Papel inicial
            <select
              className="input"
              id="system-user-role"
              onChange={(event) => {
                if (isAppRole(event.target.value)) {
                  setSelectedRole(event.target.value);
                }
              }}
              value={selectedRole}
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={activeOperation === "invite"}
            type="submit"
          >
            {activeOperation === "invite" ? "Enviando convite..." : "Convidar"}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="users-list-title"
        className="module-section crm-section"
      >
        <div className="section-heading system-users-heading">
          <div>
            <h2 className="section-title" id="users-list-title">
              Contas e acessos
            </h2>
            <p>
              {users.length} conta(s) carregada(s); a busca filtra esta lista.
            </p>
          </div>
          <label className="field system-user-search" htmlFor="system-user-search">
            Buscar usuário
            <input
              autoComplete="off"
              className="input"
              id="system-user-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome ou e-mail"
              type="search"
              value={search}
            />
          </label>
        </div>

        {notice ? (
          <p className="success-notice system-user-feedback" role="status">
            {notice}
          </p>
        ) : null}
        {errorMessage ? (
          <p className="notice system-user-feedback" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {filteredUsers.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table system-users-table">
              <thead>
                <tr>
                  <th scope="col">Usuário</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Papéis e acessos</th>
                  <th scope="col">Atribuir papel</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  return (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.displayName || "Sem nome cadastrado"}</strong>
                        <small className="table-secondary">
                          {user.email || "Sem e-mail"}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`system-user-status${user.bannedUntil ? " is-blocked" : user.lastSignInAt ? " is-active" : ""}`}
                        >
                          {user.bannedUntil
                            ? `Bloqueio até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(user.bannedUntil))}`
                            : user.lastSignInAt
                              ? "Ativo"
                              : user.invitedAt
                                ? "Convite enviado"
                                : "Nunca acessou"}
                        </span>
                        {user.lastSignInAt ? (
                          <small className="table-secondary">
                            Último acesso:{" "}
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                            }).format(new Date(user.lastSignInAt))}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <div className="system-user-role-list">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <span className="system-user-role" key={role}>
                                {roleLabels[role]}
                                <button
                                  aria-label={`Remover papel ${roleLabels[role]} de ${user.displayName || user.email || "usuário"}`}
                                  disabled={
                                    activeOperation === `${user.id}:${role}` ||
                                    (user.id === currentUserId &&
                                      role === "super_admin")
                                  }
                                  onClick={() =>
                                    void changeRole(user, "remove", role)
                                  }
                                  type="button"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="status-label">
                              Nenhum papel atribuído
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <select
                          aria-label={`Escolher papel para ${user.displayName || user.email || "usuário"}`}
                          className="input system-user-role-select"
                          disabled={activeOperation === `${user.id}:assign`}
                          defaultValue=""
                          onChange={(event) => {
                            const value = event.target.value;
                            if (isAppRole(value)) {
                              void changeRole(
                                user,
                                "assign",
                                value,
                              );
                              event.target.value = "";
                            }
                          }}
                        >
                          <option value="">Adicionar...</option>
                          {APP_ROLES.filter(
                            (role) => !user.roles.includes(role),
                          ).map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">
            {users.length === 0
              ? "Nenhuma conta encontrada."
              : "Nenhuma conta corresponde à busca."}
          </p>
        )}

        {hasMore ? (
          <button
            className="secondary-button system-users-load-more"
            disabled={isLoadingMore}
            onClick={() => void loadMoreUsers()}
            type="button"
          >
            {isLoadingMore ? "Carregando..." : "Carregar mais usuários"}
          </button>
        ) : null}
      </section>
    </>
  );
}
