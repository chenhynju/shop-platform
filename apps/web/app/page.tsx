'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { formatDate } from '@toolkit/i18n';
import { LanguageSwitcher, useLocale } from '@/components/locale-provider';
import { localizeError } from '@/lib/localize-error';
import type { MessageKey } from '@/lib/messages';
import type { ApiResponse, Project, ProjectStatus, User } from '@repo/types';
import { api, RequestError } from '@/lib/api';

const stages: { id: ProjectStatus; label: MessageKey; caption: MessageKey }[] = [
  { id: 'PLANNED', label: 'Planned', caption: 'Ready for a first step' },
  { id: 'ACTIVE', label: 'In progress', caption: 'Keep the momentum going' },
  { id: 'DONE', label: 'Completed', caption: 'Good work, shipped' }
];
function Mark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'brand-mark small' : 'brand-mark'} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function ProjectDialog({
  project,
  onClose,
  onSave
}: {
  project: Project | null;
  onClose: () => void;
  onSave: (input: { title: string; description: string; status: ProjectStatus }) => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await onSave({
        title: String(data.get('title')),
        description: String(data.get('description')),
        status: data.get('status') as ProjectStatus
      });
      onClose();
    } catch (error) {
      setError(error);
    } finally {
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="project-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">{t('YOUR WORKSPACE')}</span>
            <h2 id="dialog-title">{project ? t('Edit project') : t('Start something new')}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t('Close project form')}
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <label>
          {t('Project title')}
          <input
            name="title"
            required
            minLength={1}
            maxLength={120}
            defaultValue={project?.title}
            placeholder={t('What are you building?')}
            autoFocus
          />
        </label>
        <label>
          {t('Description')}
          <textarea
            name="description"
            maxLength={2000}
            rows={4}
            defaultValue={project?.description}
            placeholder={t('A little context goes a long way.')}
          />
        </label>
        <label>
          {t('Status')}
          <select
            aria-label={t('Status')}
            name="status"
            defaultValue={project?.status ?? 'PLANNED'}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {t(stage.label)}
              </option>
            ))}
          </select>
        </label>
        {Boolean(error) && (
          <p role="alert" className="form-error">
            {localizeError(error, locale)}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" disabled={saving} onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? t('Saving…') : project ? t('Save changes') : t('Create project')}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Home() {
  const { locale, t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<MessageKey | ''>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<User[] | null>(null);
  const [dialog, setDialog] = useState<{ project: Project | null } | null>(null);
  const [search, setSearch] = useState('');
  const [service, setService] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const fail = useCallback((error: unknown) => {
    if (error instanceof RequestError && error.code === 'UNAUTHENTICATED') {
      setUser(null);
      setProjects([]);
    }
    setError(error);
  }, []);
  useEffect(() => {
    let active = true;
    api<ApiResponse<User>>('/auth/me')
      .then((result) => {
        if (active) setUser(result.data);
      })
      .catch((error) => {
        if (active && (!(error instanceof RequestError) || error.code !== 'UNAUTHENTICATED'))
          fail(error);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    api<{ status: string }>('/health')
      .then((result) => {
        if (active) setService(result.status === 'ok' ? 'connected' : 'unavailable');
      })
      .catch(() => {
        if (active) setService('unavailable');
      });
    return () => {
      active = false;
    };
  }, [fail]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    api<ApiResponse<Project[]>>('/projects', { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setProjects(result.data);
      })
      .catch((error) => {
        if (!controller.signal.aborted) fail(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user, fail]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const data = new FormData(event.currentTarget);
    const input = {
      email: String(data.get('email')),
      password: String(data.get('password')),
      ...(mode === 'register' ? { name: String(data.get('name')) } : {})
    };
    try {
      setUser(
        (
          await api<ApiResponse<User>>('/auth/' + mode, {
            method: 'POST',
            body: JSON.stringify(input)
          })
        ).data
      );
      setNotice(mode === 'register' ? 'Your workspace is ready.' : 'Welcome back.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setProjects([]);
      setMembers(null);
      setNotice('You have signed out securely.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function saveProject(input: { title: string; description: string; status: ProjectStatus }) {
    const existing = dialog?.project;
    const result = await api<ApiResponse<Project>>(
      existing ? '/projects/' + existing.id : '/projects',
      { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(input) }
    );
    setProjects((current) =>
      existing
        ? current.map((item) => (item.id === existing.id ? result.data : item))
        : [result.data, ...current]
    );
    setNotice(existing ? 'Project updated.' : 'Project created.');
    setError('');
  }
  async function removeProject(project: Project) {
    if (!window.confirm(t('Delete “{title}”? This cannot be undone.', { title: project.title })))
      return;
    setBusy(true);
    setError('');
    try {
      await api('/projects/' + project.id, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setNotice('Project deleted.');
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  async function showMembers() {
    setBusy(true);
    setError('');
    try {
      setMembers((await api<ApiResponse<User[]>>('/users')).data);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }
  const filtered = projects.filter((project) =>
    (project.title + ' ' + project.description).toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <Mark small />
          <span>
            fullstack<span className="brand-light"> / toolkit</span>
          </span>
        </Link>
        <div className="sidebar-context">
          <span className="context-icon">F</span>
          <div>
            <strong>{t('Foundation')}</strong>
            <span>{t('Your next great project')}</span>
          </div>
          <span className="context-arrow">⌄</span>
        </div>
        <p className="nav-label">{t('WORKSPACE')}</p>
        <nav aria-label={t('Main navigation')}>
          <a
            className={!members ? 'nav-item selected' : 'nav-item'}
            href="#workspace"
            onClick={() => setMembers(null)}
          >
            <span aria-hidden="true">▦</span>
            {t('Projects')} <span className="nav-count">{user ? projects.length : '—'}</span>
          </a>
          <Link href="/shop" className="nav-item">
            <span aria-hidden="true">▧</span>
            {t('Shop')} <Arrow />
          </Link>
          {user?.role === 'ADMIN' && (
            <button
              className={members ? 'nav-item selected' : 'nav-item'}
              disabled={busy}
              onClick={showMembers}
            >
              <span aria-hidden="true">◎</span>
              {t('Members')}
            </button>
          )}
          <a className="nav-item" href="#guide">
            <span aria-hidden="true">≡</span>
            {t('Getting started')} <Arrow />
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="template-note">
            <span className="eyebrow">{t('BUILT TO BE YOURS')}</span>
            <p>
              {t('Less setup.')}
              <br />
              {t('More building.')}
            </p>
            <a href="#guide">
              {t('Explore the foundation')} <Arrow />
            </a>
          </div>
          <div className="service-status" data-testid="api-status">
            <span className={service === 'connected' ? 'status-dot' : 'status-dot muted'} />
            {t(
              service === 'connected'
                ? 'API connected'
                : service === 'unavailable'
                  ? 'API unavailable'
                  : 'Checking API'
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {t('Workspace')} <span>/</span>{' '}
            <strong>{members ? t('Members') : t('Projects')}</strong>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="version-tag">F12 · MONOREPO</span>
            {user && (
              <>
                <span className="avatar" title={user.email}>
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </span>
                <button className="text-button" disabled={busy} onClick={logout}>
                  {t('Sign out')}
                </button>
              </>
            )}
          </div>
        </header>
        <main id="workspace" className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{t('A SOLID START. AN OPEN ROAD.')}</p>
              <h1>
                {user
                  ? members
                    ? t('Your people.')
                    : t('Make room for your next idea.')
                  : t('Start strong. Build what matters.')}
              </h1>
              <p className="subtitle">
                {user
                  ? t('A little structure for the big things you’re working on.')
                  : t('One workspace. A connected stack. A foundation you can make your own.')}
              </p>
            </div>
            <span className="foundation-tag">
              <span /> {t('Foundation')} / 01
            </span>
          </div>
          {Boolean(error) && (
            <div role="alert" className="message error">
              <strong>{t('We couldn’t finish that request.')}</strong>
              <span>{localizeError(error, locale)}</span>
              <button className="text-button" onClick={() => setError('')}>
                {t('Dismiss')}
              </button>
            </div>
          )}
          <div role="status" aria-live="polite" className={notice ? 'message success' : 'sr-only'}>
            {notice ? t(notice) : null}
          </div>
          {checking ? (
            <div className="loading-panel">{t('Opening your workspace…')}</div>
          ) : !user ? (
            <section className="welcome-grid">
              <div className="welcome-panel">
                <div className="intro-badge">{t('THE FULLSTACK STARTER')}</div>
                <h2>
                  {t('From first commit')}
                  <br />
                  {t('to your next launch')}
                  <span>.</span>
                </h2>
                <p>
                  {t(
                    'Authentication, a shared data layer and a real workspace — the essentials, connected from the start.'
                  )}
                </p>
                <div
                  className="stack-diagram"
                  aria-label={t('Next.js frontend connected to Fastify API and Prisma data')}
                >
                  <div>
                    <span>{t('01 / INTERFACE')}</span>
                    <strong>Next.js</strong>
                    <small>React · TypeScript</small>
                  </div>
                  <i aria-hidden="true">↓</i>
                  <div>
                    <span>{t('02 / APPLICATION')}</span>
                    <strong>Fastify</strong>
                    <small>{t('Sessions · Permissions')}</small>
                  </div>
                  <i aria-hidden="true">↓</i>
                  <div>
                    <span>{t('03 / PERSISTENCE')}</span>
                    <strong>Prisma</strong>
                    <small>{t('Your data, connected')}</small>
                  </div>
                </div>
                <div className="welcome-footer">
                  <Mark small />
                  <span>{t('The boring parts, thoughtfully handled.')}</span>
                </div>
              </div>
              <div className="auth-panel">
                <span className="eyebrow">{t('YOUR BUILD STARTS HERE')}</span>
                <h2>
                  {mode === 'register' ? t('Create your workspace') : t('Good to see you again')}
                </h2>
                <p>
                  {mode === 'register'
                    ? t('A personal space to turn ideas into shipped projects.')
                    : t('Sign in to pick up where you left off.')}
                </p>
                <div className="auth-tabs">
                  <button
                    className={mode === 'register' ? 'active' : ''}
                    onClick={() => {
                      setMode('register');
                      setError('');
                    }}
                    disabled={busy}
                  >
                    {t('Create account')}
                  </button>
                  <button
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => {
                      setMode('login');
                      setError('');
                    }}
                    disabled={busy}
                  >
                    {t('Sign in')}
                  </button>
                </div>
                <form onSubmit={authenticate} key={mode}>
                  {mode === 'register' && (
                    <label>
                      {t('Your name')}
                      <input
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={80}
                        placeholder={t('Alex Morgan')}
                      />
                    </label>
                  )}
                  <label>
                    {t('Email address')}
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="you@example.com"
                    />
                  </label>
                  <label>
                    {t('Password')}
                    <input
                      name="password"
                      type="password"
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      required
                      minLength={12}
                      maxLength={128}
                      placeholder={t('At least 12 characters')}
                    />
                  </label>
                  <p className="field-help">
                    {t('Use a unique password with at least 12 characters.')}
                  </p>
                  <button className="button primary full-width" disabled={busy}>
                    {busy
                      ? t('One moment…')
                      : mode === 'register'
                        ? t('Create account')
                        : t('Sign in')}
                    <Arrow />
                  </button>
                </form>
                <div className="auth-footnote">
                  <span aria-hidden="true">◇</span>{' '}
                  {t('Your projects are private to your account.')}
                </div>
              </div>
            </section>
          ) : members ? (
            <section className="members-panel">
              <div className="section-heading">
                <h2>{t('Member directory')}</h2>
                <button className="button secondary" onClick={() => setMembers(null)}>
                  {t('Back to projects')}
                </button>
              </div>
              <p className="subtitle">{t('Administrator view · newest 100 members')}</p>
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.id}>
                    <span className="avatar">
                      {(member.name ?? member.email).slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{member.name ?? t('Unnamed member')}</strong>
                      <span>{member.email}</span>
                    </div>
                    <span className="role-tag">{t(member.role)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="overview" aria-label={t('Workspace overview')}>
                <div>
                  <span>{t('YOUR PROJECTS')}</span>
                  <strong>{projects.length.toString().padStart(2, '0')}</strong>
                  <small>{t('Ideas with a place to grow')}</small>
                </div>
                <div>
                  <span>{t('IN PROGRESS')}</span>
                  <strong>
                    {projects
                      .filter((project) => project.status === 'ACTIVE')
                      .length.toString()
                      .padStart(2, '0')}
                  </strong>
                  <small>{t('A step closer to shipping')}</small>
                </div>
                <div>
                  <span>{t('COMPLETED')}</span>
                  <strong>
                    {projects
                      .filter((project) => project.status === 'DONE')
                      .length.toString()
                      .padStart(2, '0')}
                  </strong>
                  <small>{t('Made it across the finish line')}</small>
                </div>
                <div className="overview-note">
                  <span className="tiny-mark">↗</span>
                  <p>
                    {t('Small steps.')}
                    <br />
                    <strong>{t('Real progress.')}</strong>
                  </p>
                </div>
              </section>
              <section className="workspace-board" aria-label={t('Project board')}>
                <div className="section-heading">
                  <div>
                    <h2>
                      {t('Project board')} <span>{projects.length}</span>
                    </h2>
                    <p>{t('Your work, from possibility to done. Showing up to 100 projects.')}</p>
                  </div>
                  <button className="button primary" onClick={() => setDialog({ project: null })}>
                    {t('+ New project')}
                  </button>
                </div>
                <div className="board-toolbar">
                  <span className="view-label">▦ &nbsp; {t('Board view')}</span>
                  <label className="search-label">
                    <span className="sr-only">{t('Search projects')}</span>
                    <input
                      type="search"
                      placeholder={t('Search projects…')}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                {loading ? (
                  <div className="loading-panel">{t('Loading your projects…')}</div>
                ) : (
                  <div className="board-columns">
                    {stages.map((stage) => {
                      const items = filtered.filter((project) => project.status === stage.id);
                      return (
                        <section
                          className="board-column"
                          key={stage.id}
                          aria-label={t(stage.label)}
                        >
                          <div className="column-heading">
                            <span className={'stage-dot ' + stage.id.toLowerCase()} />
                            <h3>{t(stage.label)}</h3>
                            <span>{items.length}</span>
                          </div>
                          <p className="column-caption">{t(stage.caption)}</p>
                          <div className="project-list">
                            {items.map((project) => (
                              <article className="project-card" key={project.id}>
                                <span className="card-category">{t('PROJECT')}</span>
                                <h4>{project.title}</h4>
                                <p>
                                  {project.description ||
                                    t('Every great project starts with an idea.')}
                                </p>
                                <div className="card-bottom">
                                  <span>
                                    {t('Updated')}{' '}
                                    {formatDate(project.updatedAt, locale, {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </span>
                                  <div>
                                    <button
                                      className="text-button"
                                      disabled={busy}
                                      aria-label={t('Edit {title}', { title: project.title })}
                                      onClick={() => setDialog({ project })}
                                    >
                                      {t('Edit')}
                                    </button>
                                    <button
                                      className="text-button danger"
                                      disabled={busy}
                                      aria-label={t('Delete {title}', { title: project.title })}
                                      onClick={() => removeProject(project)}
                                    >
                                      {t('Delete')}
                                    </button>
                                  </div>
                                </div>
                              </article>
                            ))}
                            {items.length === 0 && (
                              <div className="column-empty">
                                <span aria-hidden="true">＋</span>
                                <p>
                                  {search
                                    ? t('No matching projects')
                                    : t('A little room for possibility')}
                                </p>
                              </div>
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
          <p className="manual-link">
            <Link href="/manual">
              {t('User manual')} <Arrow />
            </Link>
          </p>
          <section id="guide" className="guide-panel">
            <details>
              <summary>
                <span>
                  <span className="eyebrow">{t('MAKE IT YOUR OWN')}</span>
                  <strong>{t('Your next project starts with a good foundation.')}</strong>
                </span>
                <span className="guide-expand">{t('Read the guide +')}</span>
              </summary>
              <div className="guide-grid">
                <div>
                  <span>01</span>
                  <h3>{t('Try the full workflow')}</h3>
                  <p>
                    {t(
                      'Create an account, add a project, edit its status and refresh. Your work is saved to your account. Signing out revokes your session.'
                    )}
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <h3>{t('Keep access deliberate')}</h3>
                  <p>
                    {t(
                      'New accounts have a private workspace. Only an explicitly provisioned administrator can open the member directory.'
                    )}
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <h3>{t('Build your next product')}</h3>
                  <p>
                    {t(
                      'Start with the repository README and docs/reuse.md. Share API contracts in packages/types and keep authorization in the API.'
                    )}
                  </p>
                </div>
              </div>
            </details>
          </section>
          <footer className="page-footer">
            <span>fullstack / toolkit</span>
            <span>Next.js · Fastify · Prisma · Turborepo</span>
            <span>
              {t('Built for what comes next.')} <Arrow />
            </span>
          </footer>
        </main>
      </div>
      {dialog && (
        <ProjectDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onSave={saveProject}
        />
      )}
    </div>
  );
}
