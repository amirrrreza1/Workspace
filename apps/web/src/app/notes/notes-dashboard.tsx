"use client";

import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Bold,
  CheckSquare,
  CircleAlert,
  Code,
  Edit3,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Minus,
  Pin,
  Plus,
  Quote,
  Search,
  SlidersHorizontal,
  Strikethrough,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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
import type { Note, NotesSummary } from "@reminder/domain";
import { MarkdownRenderer } from "./markdown-renderer";

type FilterState = {
  q: string;
  tag: string;
  status: "active" | "pinned" | "archived";
  sort: "updated_desc" | "updated_asc" | "title_asc";
};

type NoteDraft = {
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
};

const initialDraft: NoteDraft = {
  title: "",
  content: "",
  tags: [],
  isPinned: false,
  isArchived: false,
};

export function NotesDashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [summary, setSummary] = useState<NotesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterState>({
    q: "",
    tag: "",
    status: "active",
    sort: "updated_desc",
  });

  const [allTags, setAllTags] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const activeFiltersCount =
    (filter.tag ? 1 : 0) +
    (filter.status !== "active" ? 1 : 0) +
    (filter.sort !== "updated_desc" ? 1 : 0);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState<NoteDraft>(initialDraft);
  const [newTagInput, setNewTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollingSourceRef = useRef<"editor" | "preview" | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncScroll, setSyncScroll] = useState(true);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.q.trim()) params.set("q", filter.q.trim());
      if (filter.tag) params.set("tag", filter.tag);
      if (filter.status === "pinned") params.set("isPinned", "true");
      if (filter.status === "archived") params.set("isArchived", "true");
      else if (filter.status === "active") params.set("isArchived", "false");
      params.set("sort", filter.sort);

      const res = await fetch(`/api/v1/notes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load notes");
      const data = (await res.json()) as { items: Note[]; summary: NotesSummary };
      setNotes(data.items);
      setSummary(data.summary);

      const tagSet = new Set<string>();
      for (const item of data.items) {
        for (const t of item.tags) tagSet.add(t);
      }
      setAllTags(Array.from(tagSet).sort());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load notes.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const openCreateModal = () => {
    setViewingNote(null);
    setEditingNote(null);
    setDraft(initialDraft);
    setNewTagInput("");
    setModalOpen(true);
  };

  const openEditModal = (note: Note) => {
    setViewingNote(null);
    setEditingNote(note);
    setDraft({
      title: note.title,
      content: note.content,
      tags: [...note.tags],
      isPinned: note.isPinned,
      isArchived: note.isArchived,
    });
    setNewTagInput("");
    setModalOpen(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      if (editingNote) {
        const res = await fetch(`/api/v1/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            content: draft.content,
            tags: draft.tags,
            isPinned: draft.isPinned,
            isArchived: draft.isArchived,
            expectedUpdatedAt: editingNote.updatedAt,
          }),
        });
        if (!res.ok) throw new Error("Failed to update note");
        setViewingNote((prev) =>
          prev?.id === editingNote.id
            ? {
                ...prev,
                title: draft.title.trim(),
                content: draft.content,
                tags: draft.tags,
                isPinned: draft.isPinned,
                isArchived: draft.isArchived,
                updatedAt: new Date().toISOString(),
              }
            : prev,
        );
      } else {
        const res = await fetch("/api/v1/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draft.title.trim(),
            content: draft.content,
            tags: draft.tags,
            isPinned: draft.isPinned,
          }),
        });
        if (!res.ok) throw new Error("Failed to create note");
      }
      setModalOpen(false);
      void loadNotes();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error saving note.");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (note: Note) => {
    try {
      const nextPinned = !note.isPinned;
      const res = await fetch(`/api/v1/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: nextPinned }),
      });
      if (!res.ok) throw new Error("Failed to toggle pin");
      setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, isPinned: nextPinned } : n)));
      setViewingNote((prev) => (prev?.id === note.id ? { ...prev, isPinned: nextPinned } : prev));
      void loadNotes();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error updating note pin.");
    }
  };

  const toggleArchive = async (note: Note) => {
    try {
      const nextArchived = !note.isArchived;
      const res = await fetch(`/api/v1/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      if (!res.ok) throw new Error("Failed to toggle archive");
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, isArchived: nextArchived } : n)),
      );
      setViewingNote((prev) =>
        prev?.id === note.id ? { ...prev, isArchived: nextArchived } : prev,
      );
      void loadNotes();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error archiving note.");
    }
  };

  const handleDelete = async () => {
    if (!noteToDelete) return;
    try {
      const res = await fetch(`/api/v1/notes/${noteToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete note");
      if (viewingNote?.id === noteToDelete.id) {
        setViewingNote(null);
      }
      setNoteToDelete(null);
      void loadNotes();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Error deleting note.");
    }
  };

  const addTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (trimmed && !draft.tags.includes(trimmed)) {
      setDraft({ ...draft, tags: [...draft.tags, trimmed] });
      setNewTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setDraft({ ...draft, tags: draft.tags.filter((t) => t !== tagToRemove) });
  };

  // Interactive task toggle on card / detail
  const handleToggleTaskInNote = async (note: Note, lineIndex: number, checked: boolean) => {
    const lines = note.content.split(/\r?\n/);
    if (lines[lineIndex] !== undefined) {
      const targetLine = lines[lineIndex]!;
      lines[lineIndex] = checked
        ? targetLine.replace(/\[ \]/, "[x]")
        : targetLine.replace(/\[[xX]\]/, "[ ]");
      const updatedContent = lines.join("\n");

      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, content: updatedContent } : n)),
      );
      setViewingNote((prev) =>
        prev?.id === note.id ? { ...prev, content: updatedContent } : prev,
      );

      try {
        await fetch(`/api/v1/notes/${note.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: updatedContent }),
        });
      } catch {
        void loadNotes();
      }
    }
  };

  const handleToggleTaskInViewingNote = (lineIndex: number, checked: boolean) => {
    if (!viewingNote) return;
    void handleToggleTaskInNote(viewingNote, lineIndex, checked);
  };

  // Interactive task toggle inside modal editor
  const handleToggleTaskInDraft = (lineIndex: number, checked: boolean) => {
    const lines = draft.content.split(/\r?\n/);
    if (lines[lineIndex] !== undefined) {
      const targetLine = lines[lineIndex]!;
      lines[lineIndex] = checked
        ? targetLine.replace(/\[ \]/, "[x]")
        : targetLine.replace(/\[[xX]\]/, "[ ]");
      setDraft({ ...draft, content: lines.join("\n") });
    }
  };

  // Synchronized scroll handlers between editor and preview
  const handleEditorScroll = () => {
    if (!syncScroll) return;
    if (scrollingSourceRef.current === "preview") return;

    scrollingSourceRef.current = "editor";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingSourceRef.current = null;
    }, 120);

    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    const previewScrollable = preview.scrollHeight - preview.clientHeight;

    if (editorScrollable > 0 && previewScrollable > 0) {
      const ratio = editor.scrollTop / editorScrollable;
      preview.scrollTop = ratio * previewScrollable;
    }
  };

  const handlePreviewScroll = () => {
    if (!syncScroll) return;
    if (scrollingSourceRef.current === "editor") return;

    scrollingSourceRef.current = "preview";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingSourceRef.current = null;
    }, 120);

    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const editorScrollable = editor.scrollHeight - editor.clientHeight;
    const previewScrollable = preview.scrollHeight - preview.clientHeight;

    if (editorScrollable > 0 && previewScrollable > 0) {
      const ratio = preview.scrollTop / previewScrollable;
      editor.scrollTop = ratio * editorScrollable;
    }
  };

  // Helper to insert markdown at cursor
  const insertMarkdown = (prefix: string, suffix = "", defaultText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = draft.content;

    const selected = currentText.slice(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const nextContent = currentText.slice(0, start) + replacement + currentText.slice(end);
    setDraft({ ...draft, content: nextContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // Helper to insert line prefix (e.g. headings or lists)
  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = draft.content;

    // Find start of current line
    const lastNewline = currentText.lastIndexOf("\n", start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    const nextContent = currentText.slice(0, lineStart) + prefix + currentText.slice(lineStart);
    setDraft({ ...draft, content: nextContent });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  // Helper to insert numbered list (detects Persian context)
  const insertNumberedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const currentText = draft.content;
    const lastNewline = currentText.lastIndexOf("\n", start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const currentLine = currentText.slice(lineStart, start);
    const isPersian = /[\u0600-\u06FF]/.test(currentLine || currentText);
    insertLinePrefix(isPersian ? "۱. " : "1. ");
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        {error && (
          <div className="status-banner status-banner--error">
            <CircleAlert aria-hidden="true" size={18} />
            {error}
            <Button variant="ghost" onClick={loadNotes}>
              Retry
            </Button>
          </div>
        )}

        <section className="summary-grid" aria-label="Notes summary">
          <div className="summary-card">
            <span>Total notes</span>
            <strong>{summary?.totalCount ?? "—"}</strong>
            <p>Active notes in your workspace</p>
          </div>
          <div className="summary-card">
            <span>Pinned notes</span>
            <strong>{summary?.pinnedCount ?? "—"}</strong>
            <p>Notes pinned for fast access</p>
          </div>
          <div className="summary-card">
            <span>Tags</span>
            <strong>{summary?.tagsCount ?? allTags.length}</strong>
            <p>Categorized labels</p>
          </div>
        </section>

        <section className="dashboard-controls" aria-label="Notes controls">
          <div className="dashboard-actions">
            <Button variant="primary" onClick={openCreateModal}>
              <Plus aria-hidden="true" size={18} />
              Add note
            </Button>
          </div>

          <div className="toolbar">
            <label className="toolbar-field toolbar-field--search">
              Search
              <span className="search-field">
                <Search aria-hidden="true" size={18} />
                <input
                  value={filter.q}
                  onChange={(e) => setFilter({ ...filter, q: e.target.value })}
                  placeholder="Search by title, content, or tag"
                  dir="auto"
                />
              </span>
            </label>

            <button
              type="button"
              className={`filter-toggle-btn ${activeFiltersCount > 0 ? "filter-toggle-btn--active" : ""} ${mobileFiltersOpen ? "filter-toggle-btn--open" : ""}`}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-label={mobileFiltersOpen ? "Hide filters" : "Show filters"}
              aria-expanded={mobileFiltersOpen}
            >
              <SlidersHorizontal aria-hidden="true" size={16} />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="filter-badge" aria-label={`${activeFiltersCount} active filters`}>
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div
              className={`toolbar-filters-group ${mobileFiltersOpen ? "toolbar-filters-group--open" : ""}`}
            >
              <label className="toolbar-field">
                Filter by tag
                <Select
                  aria-label="Filter by tag"
                  value={filter.tag || "all"}
                  onValueChange={(val) => setFilter({ ...filter, tag: val === "all" ? "" : val })}
                  options={[
                    { value: "all", label: "All tags" },
                    ...allTags.map((t) => ({ value: t, label: `#${t}` })),
                  ]}
                />
              </label>

              <label className="toolbar-field">
                Status
                <Select
                  aria-label="Status"
                  value={filter.status}
                  onValueChange={(val) =>
                    setFilter({ ...filter, status: val as FilterState["status"] })
                  }
                  options={[
                    { value: "active", label: "Active notes" },
                    { value: "pinned", label: "Pinned only" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              </label>

              <label className="toolbar-field">
                Sort
                <Select
                  aria-label="Sort"
                  value={filter.sort}
                  onValueChange={(val) =>
                    setFilter({ ...filter, sort: val as FilterState["sort"] })
                  }
                  options={[
                    { value: "updated_desc", label: "Recently updated" },
                    { value: "updated_asc", label: "Oldest updated" },
                    { value: "title_asc", label: "Title (A–Z)" },
                  ]}
                />
              </label>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="empty-state">
            <LoaderCircle className="spin" aria-hidden="true" size={28} />
            <p>Loading notes…</p>
          </div>
        ) : notes.length === 0 ? (
          <div className="empty-state">
            <FileText aria-hidden="true" size={40} />
            <p>No notes found.</p>
            <Button variant="secondary" onClick={openCreateModal}>
              <Plus aria-hidden="true" size={16} /> Create your first note
            </Button>
          </div>
        ) : (
          <div className="card-grid">
            {notes.map((note) => (
              <article
                key={note.id}
                className={`note-card note-card--clickable font-shabnam ${note.isPinned ? "note-card--pinned" : ""}`}
                onClick={() => setViewingNote(note)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setViewingNote(note);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open note: ${note.title}`}
              >
                <div className="note-card-header">
                  <div className="note-card-title-group">
                    {note.isPinned && (
                      <span className="pinned-badge" title="Pinned note">
                        <Pin size={13} aria-hidden="true" />
                        Pinned
                      </span>
                    )}
                    <h3 className="note-card-title" dir="auto">
                      {note.title}
                    </h3>
                  </div>
                  <div className="note-card-quick-actions">
                    <button
                      type="button"
                      className={`icon-button ${note.isPinned ? "icon-button--active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void togglePin(note);
                      }}
                      title={note.isPinned ? "Unpin note" : "Pin note"}
                      aria-label={note.isPinned ? "Unpin note" : "Pin note"}
                    >
                      <Pin size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleArchive(note);
                      }}
                      title={note.isArchived ? "Unarchive note" : "Archive note"}
                      aria-label={note.isArchived ? "Unarchive note" : "Archive note"}
                    >
                      {note.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                  </div>
                </div>

                {note.tags.length > 0 && (
                  <div className="note-tags-list">
                    {note.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        className="tag-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilter({ ...filter, tag });
                        }}
                        title={`Filter by #${tag}`}
                        dir="auto"
                      >
                        <Tag size={12} aria-hidden="true" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="note-card-footer">
                  <span className="note-timestamp">
                    Updated {new Date(note.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="note-actions">
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(note);
                      }}
                      aria-label="Edit note"
                      title="Edit note"
                    >
                      <Edit3 size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNoteToDelete(note);
                      }}
                      aria-label="Delete note"
                      title="Delete note"
                      className="text-destructive"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Note View / Detail Modal */}
      <Dialog open={viewingNote !== null} onOpenChange={(open) => !open && setViewingNote(null)}>
        <DialogContent className="ui-dialog-content--wide">
          {viewingNote && (
            <div className="note-detail-modal font-shabnam">
              <DialogHeader>
                <div className="note-detail-header">
                  <div className="note-detail-title-group">
                    <div className="note-detail-badges">
                      {viewingNote.isPinned && (
                        <span className="pinned-badge" title="Pinned note">
                          <Pin size={13} aria-hidden="true" />
                          Pinned
                        </span>
                      )}
                      {viewingNote.isArchived && (
                        <span className="pinned-badge pinned-badge--archived" title="Archived note">
                          <Archive size={13} aria-hidden="true" />
                          Archived
                        </span>
                      )}
                    </div>
                    <DialogTitle className="note-detail-title font-shabnam" dir="auto">
                      {viewingNote.title}
                    </DialogTitle>
                  </div>
                </div>
                <DialogDescription>
                  Created {new Date(viewingNote.createdAt).toLocaleDateString()} · Updated{" "}
                  {new Date(viewingNote.updatedAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              {viewingNote.tags.length > 0 && (
                <div className="note-detail-meta">
                  <div className="note-tags-list">
                    {viewingNote.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        className="tag-chip"
                        onClick={() => {
                          setFilter({ ...filter, tag });
                          setViewingNote(null);
                        }}
                        title={`Filter by #${tag}`}
                        dir="auto"
                      >
                        <Tag size={12} aria-hidden="true" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="note-detail-content-wrapper">
                <div className="note-detail-content">
                  <MarkdownRenderer
                    content={viewingNote.content}
                    fontClass="font-shabnam"
                    dir="auto"
                    placeholder="No content in this note."
                    onToggleTask={handleToggleTaskInViewingNote}
                  />
                </div>
              </div>

              <DialogFooter className="note-detail-footer">
                <div className="note-detail-footer-actions">
                  <Button variant="secondary" type="button" onClick={() => togglePin(viewingNote)}>
                    <Pin size={15} />
                    {viewingNote.isPinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => toggleArchive(viewingNote)}
                  >
                    {viewingNote.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                    {viewingNote.isArchived ? "Unarchive" : "Archive"}
                  </Button>
                  <Button
                    variant="destructive"
                    type="button"
                    onClick={() => setNoteToDelete(viewingNote)}
                  >
                    <Trash2 size={15} />
                    Delete
                  </Button>
                </div>

                <div className="note-detail-footer-main">
                  <Button variant="secondary" type="button" onClick={() => setViewingNote(null)}>
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={() => openEditModal(viewingNote)}
                  >
                    <Edit3 size={15} />
                    Edit note
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Note Edit / Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="ui-dialog-content--full">
          <form onSubmit={handleSaveNote}>
            <DialogHeader>
              <DialogTitle>{editingNote ? "Edit note" : "Create note"}</DialogTitle>
              <DialogDescription>
                Write your note in Markdown. The preview updates in real time.
              </DialogDescription>
            </DialogHeader>

            <div className="dialog-fields">
              <label className="field field--wide">
                Title
                <input
                  required
                  placeholder="Note title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  dir="auto"
                  className="font-shabnam"
                />
              </label>

              <div className="field field--wide">
                <span>Tags</span>
                <div className="tags-input-container">
                  <div className="tags-chips-area">
                    {draft.tags.map((tag) => (
                      <span key={tag} className="tag-chip tag-chip--removable" dir="auto">
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="tag-add-row">
                    <input
                      placeholder="Add tag and press Enter"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      dir="auto"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(newTagInput);
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => addTag(newTagInput)}
                      disabled={!newTagInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {/* Editor Container with Live Preview */}
              <div className="field field--wide">
                <div className="editor-split-container">
                  <div
                    className="editor-write-pane"
                    onMouseEnter={() => {
                      if (scrollingSourceRef.current !== "editor") {
                        scrollingSourceRef.current = null;
                      }
                    }}
                  >
                    <div className="editor-toolbar" role="toolbar" aria-label="Formatting tools">
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("# ")}
                        title="Heading 1 (# Title)"
                        aria-label="Heading 1"
                      >
                        <Heading1 size={16} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("## ")}
                        title="Heading 2 (## Subtitle)"
                        aria-label="Heading 2"
                      >
                        <Heading2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("### ")}
                        title="Heading 3 (### Section)"
                        aria-label="Heading 3"
                      >
                        <Heading3 size={16} />
                      </button>

                      <span className="toolbar-separator" />

                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("**", "**", "bold text")}
                        title="Bold (**text**)"
                        aria-label="Bold"
                      >
                        <Bold size={15} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("*", "*", "italic text")}
                        title="Italic (*text*)"
                        aria-label="Italic"
                      >
                        <Italic size={15} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("~~", "~~", "strikethrough")}
                        title="Strikethrough (~~text~~)"
                        aria-label="Strikethrough"
                      >
                        <Strikethrough size={15} />
                      </button>

                      <span className="toolbar-separator" />

                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={insertNumberedList}
                        title="Numbered list (1. 2. 3. / ۱. ۲. ۳.)"
                        aria-label="Numbered list"
                      >
                        <ListOrdered size={16} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("- ")}
                        title="Bullet list (- item)"
                        aria-label="Bullet list"
                      >
                        <List size={16} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("- [ ] ")}
                        title="Task Checklist (- [ ] task)"
                        aria-label="Task Checklist"
                      >
                        <CheckSquare size={16} />
                      </button>

                      <span className="toolbar-separator" />

                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertLinePrefix("> ")}
                        title="Quote (> quote)"
                        aria-label="Quote"
                      >
                        <Quote size={15} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("```\n", "\n```", "code")}
                        title="Code block (```code```)"
                        aria-label="Code block"
                      >
                        <Code size={15} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("\n---\n")}
                        title="Horizontal line (---)"
                        aria-label="Divider"
                      >
                        <Minus size={15} />
                      </button>
                      <button
                        type="button"
                        className="toolbar-btn"
                        onClick={() => insertMarkdown("[", "](https://)", "link text")}
                        title="Link ([text](url))"
                        aria-label="Link"
                      >
                        <Link2 size={15} />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      rows={14}
                      placeholder="Write your note here using Markdown…"
                      value={draft.content}
                      onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                      onScroll={handleEditorScroll}
                      className="editor-textarea font-shabnam"
                      dir="auto"
                    />
                  </div>

                  <div
                    className="editor-preview-pane"
                    onMouseEnter={() => {
                      if (scrollingSourceRef.current !== "preview") {
                        scrollingSourceRef.current = null;
                      }
                    }}
                  >
                    <div className="editor-preview-header">
                      <span>Preview</span>
                      <button
                        type="button"
                        className={`editor-sync-btn ${syncScroll ? "editor-sync-btn--active" : ""}`}
                        onClick={() => setSyncScroll((prev) => !prev)}
                        title={
                          syncScroll
                            ? "Synchronized scrolling active (click to disable)"
                            : "Synchronized scrolling disabled (click to enable)"
                        }
                        aria-pressed={syncScroll}
                      >
                        <ArrowUpDown size={13} aria-hidden="true" />
                        <span>Sync scroll</span>
                      </button>
                    </div>
                    <div
                      ref={previewRef}
                      onScroll={handlePreviewScroll}
                      className="editor-preview-panel"
                    >
                      <MarkdownRenderer
                        content={draft.content}
                        fontClass="font-shabnam"
                        dir="auto"
                        placeholder="Preview will appear here as you write…"
                        onToggleTask={handleToggleTaskInDraft}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="channel-toggles field--wide">
                <label>
                  <Switch
                    checked={draft.isPinned}
                    onCheckedChange={(val) => setDraft({ ...draft, isPinned: val })}
                  />
                  <span>Pin note to top</span>
                </label>
                {editingNote && (
                  <label>
                    <Switch
                      checked={draft.isArchived}
                      onCheckedChange={(val) => setDraft({ ...draft, isArchived: val })}
                    />
                    <span>Archived</span>
                  </label>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={saving || !draft.title.trim()}>
                {saving && <LoaderCircle className="spin" size={16} />}
                {editingNote ? "Save changes" : "Create note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={noteToDelete !== null} onOpenChange={(open) => !open && setNoteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{noteToDelete?.title}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setNoteToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={handleDelete}>
              Delete note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
