"use client";

import {
  Check,
  CircleAlert,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileCode,
  FolderPlus,
  KeyRound,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  Switch,
} from "@reminder/ui";
import { parseEnvFile, type Project, type ProjectEnvironment, type ProjectSecret } from "@reminder/domain";

export function SecretsDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<ProjectSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [newEnvOpen, setNewEnvOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");

  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<ProjectSecret | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [secretComment, setSecretComment] = useState("");
  const [secretIsMasked, setSecretIsMasked] = useState(true);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importRawContent, setImportRawContent] = useState("");
  const [importPreviewCount, setImportPreviewCount] = useState(0);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportCopied, setExportCopied] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{
    type: "project" | "environment" | "secret";
    id: string;
    name: string;
  } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/secrets/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      const list = (await res.json()) as Project[];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId((prev) => prev ?? list[0]?.id ?? null);
      } else {
        setSelectedProjectId(null);
        setEnvironments([]);
        setSelectedEnvId(null);
        setSecrets([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Load project environments
  const loadEnvironments = useCallback(async (projId: string) => {
    try {
      const res = await fetch(`/api/v1/secrets/projects/${projId}/environments`);
      if (!res.ok) throw new Error("Failed to load environments");
      const envs = (await res.json()) as ProjectEnvironment[];
      setEnvironments(envs);
      if (envs.length > 0) {
        setSelectedEnvId((prev) => (envs.some((e) => e.id === prev) ? prev : (envs[0]?.id ?? null)));
      } else {
        setSelectedEnvId(null);
        setSecrets([]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load environments.");
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      void loadEnvironments(selectedProjectId);
    }
  }, [selectedProjectId, loadEnvironments]);

  // Load secrets for active project and environment
  const loadSecrets = useCallback(async (projId: string, envId: string) => {
    try {
      const res = await fetch(`/api/v1/secrets/projects/${projId}/environments/${envId}/secrets`);
      if (!res.ok) throw new Error("Failed to load secrets");
      const sec = (await res.json()) as ProjectSecret[];
      setSecrets(sec);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load secrets.");
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId && selectedEnvId) {
      void loadSecrets(selectedProjectId, selectedEnvId);
    }
  }, [selectedProjectId, selectedEnvId, loadSecrets]);

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const activeEnvironment = environments.find((e) => e.id === selectedEnvId);

  // Toggle reveal
  const toggleReveal = (id: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy secret value
  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      alert("Failed to copy to clipboard.");
    }
  };

  // Create project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secrets/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const proj = (await res.json()) as Project;
      setNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectDesc("");
      await loadProjects();
      setSelectedProjectId(proj.id);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error creating project.");
    } finally {
      setActionLoading(false);
    }
  };

  // Create environment
  const handleCreateEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newEnvName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/secrets/projects/${selectedProjectId}/environments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEnvName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create environment");
      const env = (await res.json()) as ProjectEnvironment;
      setNewEnvOpen(false);
      setNewEnvName("");
      await loadEnvironments(selectedProjectId);
      setSelectedEnvId(env.id);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error creating environment.");
    } finally {
      setActionLoading(false);
    }
  };

  // Upsert secret
  const handleSaveSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedEnvId || !secretKey.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/secrets/projects/${selectedProjectId}/environments/${selectedEnvId}/secrets`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key: secretKey.trim(),
            value: secretValue,
            comment: secretComment.trim() || null,
            isSecret: secretIsMasked,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to save secret");
      setSecretModalOpen(false);
      void loadSecrets(selectedProjectId, selectedEnvId);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error saving secret variable.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open edit modal
  const openEditSecret = (sec: ProjectSecret) => {
    setEditingSecret(sec);
    setSecretKey(sec.key);
    setSecretValue(sec.value);
    setSecretComment(sec.comment ?? "");
    setSecretIsMasked(sec.isSecret);
    setSecretModalOpen(true);
  };

  // Open create modal
  const openCreateSecret = () => {
    setEditingSecret(null);
    setSecretKey("");
    setSecretValue("");
    setSecretComment("");
    setSecretIsMasked(true);
    setSecretModalOpen(true);
  };

  // Bulk import
  const handleImportEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !selectedEnvId || !importRawContent.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/secrets/projects/${selectedProjectId}/environments/${selectedEnvId}/import-env`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawContent: importRawContent }),
        },
      );
      if (!res.ok) throw new Error("Failed to import .env");
      setImportModalOpen(false);
      setImportRawContent("");
      void loadSecrets(selectedProjectId, selectedEnvId);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error importing .env file.");
    } finally {
      setActionLoading(false);
    }
  };

  // Open export modal
  const handleOpenExport = async () => {
    if (!selectedProjectId || !selectedEnvId) return;
    try {
      const res = await fetch(
        `/api/v1/secrets/projects/${selectedProjectId}/environments/${selectedEnvId}/export-env`,
      );
      if (!res.ok) throw new Error("Failed to export .env");
      const text = await res.text();
      setExportContent(text);
      setExportCopied(false);
      setExportModalOpen(true);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error preparing .env export.");
    }
  };

  // Delete item
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      if (deleteTarget.type === "project") {
        await fetch(`/api/v1/secrets/projects/${deleteTarget.id}`, { method: "DELETE" });
        await loadProjects();
      } else if (deleteTarget.type === "environment" && selectedProjectId) {
        await fetch(`/api/v1/secrets/projects/${selectedProjectId}/environments/${deleteTarget.id}`, {
          method: "DELETE",
        });
        await loadEnvironments(selectedProjectId);
      } else if (deleteTarget.type === "secret" && selectedProjectId && selectedEnvId) {
        await fetch(
          `/api/v1/secrets/projects/${selectedProjectId}/environments/${selectedEnvId}/secrets/${deleteTarget.id}`,
          { method: "DELETE" },
        );
        await loadSecrets(selectedProjectId, selectedEnvId);
      }
      setDeleteTarget(null);
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error deleting item.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered secrets
  const filteredSecrets = secrets.filter(
    (s) =>
      s.key.toLowerCase().includes(search.toLowerCase()) ||
      (s.comment && s.comment.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="app-shell">
      <main className="app-main">
        {error && (
          <div className="status-banner status-banner--error">
            <CircleAlert aria-hidden="true" size={18} />
            {error}
            <Button variant="ghost" onClick={loadProjects}>
              Retry
            </Button>
          </div>
        )}

        {/* Project Selector Bar */}
        <section className="secrets-header-panel">
          <div className="secrets-project-picker">
            <label className="field-group">
              <span className="field-label">Active project</span>
              <div className="picker-row">
                <Select
                  aria-label="Active Project"
                  value={selectedProjectId ?? "none"}
                  onValueChange={(val) => setSelectedProjectId(val === "none" ? null : val)}
                  options={
                    projects.length === 0
                      ? [{ value: "none", label: "No projects created yet" }]
                      : projects.map((p) => ({ value: p.id, label: p.name }))
                  }
                />
                <Button variant="secondary" onClick={() => setNewProjectOpen(true)}>
                  <FolderPlus size={16} /> New project
                </Button>
              </div>
            </label>
          </div>

          {activeProject && (
            <div className="secrets-project-meta">
              <div className="meta-text">
                <h2>{activeProject.name}</h2>
                <p>{activeProject.description || "No description provided."}</p>
              </div>
              <Button
                variant="destructive"
                onClick={() =>
                  setDeleteTarget({
                    type: "project",
                    id: activeProject.id,
                    name: activeProject.name,
                  })
                }
                aria-label="Delete project"
              >
                <Trash2 size={16} /> Delete project
              </Button>
            </div>
          )}
        </section>

        {activeProject && (
          <>
            {/* Environment Tabs */}
            <div className="env-tabs-bar">
              <div className="env-tabs-list">
                {environments.map((env) => (
                  <button
                    type="button"
                    key={env.id}
                    className={`env-tab ${env.id === selectedEnvId ? "env-tab--active" : ""}`}
                    onClick={() => setSelectedEnvId(env.id)}
                  >
                    <span>{env.name}</span>
                    <span className="env-pill">{env.secretCount}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="env-tab env-tab--add"
                  onClick={() => setNewEnvOpen(true)}
                  title="Add Environment"
                >
                  <Plus size={14} /> Add env
                </button>
              </div>
            </div>

            {/* Controls Toolbar */}
            <section className="dashboard-controls" aria-label="Secrets controls">
              <div className="dashboard-actions">
                <Button variant="secondary" onClick={handleOpenExport} disabled={secrets.length === 0}>
                  <Download aria-hidden="true" size={16} />
                  Export .env
                </Button>
                <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                  <Upload aria-hidden="true" size={16} />
                  Import .env
                </Button>
                <Button variant="primary" onClick={openCreateSecret}>
                  <Plus aria-hidden="true" size={16} />
                  Add variable
                </Button>
              </div>

              <div className="toolbar">
                <label className="toolbar-field toolbar-field--search">
                  Search variables
                  <span className="search-field">
                    <Search aria-hidden="true" size={18} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by key name or comment"
                    />
                  </span>
                </label>
              </div>
            </section>

            {/* Secrets Table */}
            {secrets.length === 0 ? (
              <div className="empty-state">
                <KeyRound aria-hidden="true" size={40} />
                <p>No environment variables defined in {activeEnvironment?.name ?? "this environment"}.</p>
                <div className="empty-actions">
                  <Button variant="primary" onClick={openCreateSecret}>
                    <Plus size={16} /> Add variable
                  </Button>
                  <Button variant="secondary" onClick={() => setImportModalOpen(true)}>
                    <Upload size={16} /> Import from .env
                  </Button>
                </div>
              </div>
            ) : (
              <div className="secrets-table-container">
                <table className="secrets-table">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Key</th>
                      <th style={{ width: "40%" }}>Value</th>
                      <th style={{ width: "20%" }}>Comment</th>
                      <th style={{ width: "10%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSecrets.map((secret) => {
                      const isRevealed = revealedSecrets[secret.id] || !secret.isSecret;
                      const isCopied = copiedKey === secret.key;

                      return (
                        <tr key={secret.id} className="secret-row">
                          <td className="secret-key-cell">
                            <code>{secret.key}</code>
                          </td>
                          <td className="secret-value-cell">
                            <div className="secret-value-box">
                              <span className="secret-value-text">
                                {isRevealed ? (
                                  secret.value || <em className="text-muted">(empty)</em>
                                ) : (
                                  "••••••••••••••••"
                                )}
                              </span>
                              <div className="secret-value-buttons">
                                {secret.isSecret && (
                                  <button
                                    type="button"
                                    className="icon-button"
                                    onClick={() => toggleReveal(secret.id)}
                                    title={isRevealed ? "Mask secret" : "Reveal secret"}
                                    aria-label={isRevealed ? "Mask secret" : "Reveal secret"}
                                  >
                                    {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={() => copyValue(secret.key, secret.value)}
                                  title="Copy to clipboard"
                                  aria-label="Copy to clipboard"
                                >
                                  {isCopied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="secret-comment-cell">
                            {secret.comment ? (
                              <span className="secret-comment-badge">{secret.comment}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="secret-actions-cell">
                            <div className="row-actions">
                              <Button
                                variant="ghost"
                                onClick={() => openEditSecret(secret)}
                                aria-label="Edit secret"
                              >
                                <Edit3 size={15} />
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "secret",
                                    id: secret.id,
                                    name: secret.key,
                                  })
                                }
                                aria-label="Delete secret"
                                className="text-destructive"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {projects.length === 0 && !loading && (
          <div className="empty-state">
            <FileCode aria-hidden="true" size={44} />
            <h2>No Projects Yet</h2>
            <p>Create a project to start managing its environment variables and secrets securely.</p>
            <Button variant="primary" onClick={() => setNewProjectOpen(true)}>
              <FolderPlus size={16} /> Create your first project
            </Button>
          </div>
        )}
      </main>

      {/* New Project Modal */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>
                A project holds separate environments (dev, staging, prod) and their encrypted `.env` secrets.
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-fields">
              <label className="field field--wide">
                Project name
                <input
                  required
                  placeholder="e.g. Workspace App, Store Backend"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </label>
              <label className="field field--wide">
                Description (optional)
                <textarea
                  rows={3}
                  placeholder="Brief description of the service or repo"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setNewProjectOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading || !newProjectName.trim()}>
                {actionLoading && <LoaderCircle className="spin" size={16} />}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Environment Modal */}
      <Dialog open={newEnvOpen} onOpenChange={setNewEnvOpen}>
        <DialogContent>
          <form onSubmit={handleCreateEnv}>
            <DialogHeader>
              <DialogTitle>Add environment</DialogTitle>
              <DialogDescription>
                Create a distinct environment for variables (e.g. `test`, `local`, `production`).
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-fields">
              <label className="field field--wide">
                Environment name
                <input
                  required
                  placeholder="e.g. testing, local, production-eu"
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setNewEnvOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading || !newEnvName.trim()}>
                {actionLoading && <LoaderCircle className="spin" size={16} />}
                Add environment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Secret Variable Modal */}
      <Dialog open={secretModalOpen} onOpenChange={setSecretModalOpen}>
        <DialogContent>
          <form onSubmit={handleSaveSecret}>
            <DialogHeader>
              <DialogTitle>{editingSecret ? "Edit variable" : "Add environment variable"}</DialogTitle>
              <DialogDescription>
                Secrets are encrypted at rest in PostgreSQL with AES-256-GCM.
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-fields">
              <label className="field field--wide">
                Key name
                <input
                  required
                  placeholder="e.g. DATABASE_URL, API_KEY"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
              </label>
              <label className="field field--wide">
                Value
                <textarea
                  rows={4}
                  placeholder="Secret value or configuration"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                />
              </label>
              <label className="field field--wide">
                Comment (optional)
                <input
                  placeholder="Brief note or hint about this variable"
                  value={secretComment}
                  onChange={(e) => setSecretComment(e.target.value)}
                />
              </label>
              <div className="channel-toggles field--wide">
                <label>
                  <Switch
                    checked={secretIsMasked}
                    onCheckedChange={(val) => setSecretIsMasked(val)}
                  />
                  <span>Mask value by default in UI</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setSecretModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading || !secretKey.trim()}>
                {actionLoading && <LoaderCircle className="spin" size={16} />}
                {editingSecret ? "Save changes" : "Add variable"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import .env Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent>
          <form onSubmit={handleImportEnv}>
            <DialogHeader>
              <DialogTitle>Import .env file</DialogTitle>
              <DialogDescription>
                Paste the contents of a `.env` file. Key-value pairs and comments will be parsed and encrypted.
              </DialogDescription>
            </DialogHeader>
            <div className="dialog-fields">
              <label className="field field--wide">
                <span>Raw .env text ({importPreviewCount} variables detected)</span>
                <textarea
                  rows={10}
                  placeholder={`# Example\nPORT=3000\nDATABASE_URL="postgres://localhost:5432/db"\nSECRET_KEY='my-key'`}
                  value={importRawContent}
                  onChange={(e) => {
                    setImportRawContent(e.target.value);
                    const parsed = parseEnvFile(e.target.value);
                    setImportPreviewCount(parsed.length);
                  }}
                  className="font-mono text-sm"
                />
              </label>
            </div>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={actionLoading || importPreviewCount === 0}>
                {actionLoading && <LoaderCircle className="spin" size={16} />}
                Import {importPreviewCount} variables
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Export .env Modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export .env for {activeEnvironment?.name}</DialogTitle>
            <DialogDescription>
              Copy or download this file to use directly as your `.env` in development or deployment.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-fields">
            <textarea
              readOnly
              rows={12}
              value={exportContent}
              className="font-mono text-sm export-textarea"
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(exportContent);
                setExportCopied(true);
                setTimeout(() => setExportCopied(false), 2000);
              }}
            >
              {exportCopied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
              {exportCopied ? "Copied to clipboard!" : "Copy to clipboard"}
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => {
                const blob = new Blob([exportContent], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `.env.${activeEnvironment?.name ?? "local"}`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={16} /> Download .env
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.type}?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={handleDeleteConfirm}>
              Delete {deleteTarget?.type}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
