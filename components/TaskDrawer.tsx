'use client';

import { useEffect, useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  User,
  Tag,
  Flag,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { getRelativeDeadlineLabel } from '../lib/utils';

type TaskStatus = 'todo' | 'done';
type Priority = 'low' | 'medium' | 'high';

interface Task {
  id: string;
  name: string;
  deadline?: string | null;
  person?: string | null;
  status: TaskStatus;
  createdAt: string;
  priority: Priority;
  category?: string | null;
  description?: string | null;
}

interface TaskDrawerProps {
  task: Task | null;
  onClose: () => void;
  onDelete: (id: string, taskName?: string) => Promise<void>;
  uniquePeople: string[];
  uniqueCategories: string[];
}

export default function TaskDrawer({ task, onClose, onDelete, uniquePeople, uniqueCategories }: TaskDrawerProps) {
  const [localTask, setLocalTask] = useState<Task | null>(task);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Local edit states
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editCategory, setEditCategory] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [personInput, setPersonInput] = useState('');

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setEditName(task.name);
      setEditDescription(task.description || '');
      setEditDeadline(task.deadline || '');
      setEditPriority(task.priority);
      setEditCategory(task.category || '');
      setEditStatus(task.status);
      setEditAssignees((task.person || '').split(',').map(p => p.trim()).filter(Boolean));
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setHasChanges(false);
    }
  }, [task]);

  // Track changes
  useEffect(() => {
    if (!task) return;
    const currentAssignees = (task.person || '').split(',').map(p => p.trim()).filter(Boolean);
    const changed =
      editName !== task.name ||
      editDescription !== (task.description || '') ||
      editDeadline !== (task.deadline || '') ||
      editPriority !== task.priority ||
      editCategory !== (task.category || '') ||
      editStatus !== task.status ||
      JSON.stringify(editAssignees.sort()) !== JSON.stringify(currentAssignees.sort());
    setHasChanges(changed);
  }, [editName, editDescription, editDeadline, editPriority, editCategory, editStatus, editAssignees, task]);

  const onSaveChanges = async () => {
    if (!task) return;
    setIsSaving(true);

    const updates = {
      name: editName,
      description: editDescription || null,
      deadline: editDeadline || null,
      priority: editPriority,
      category: editCategory || null,
      status: editStatus,
      person: editAssignees.length > 0 ? editAssignees.join(', ') : 'Me'
    };

    try {
      await updateDoc(doc(db, 'tasks', task.id), updates);
      setHasChanges(false);
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      console.error('Error saving task:', error);
      setIsSaving(false);
      alert('Failed to save changes.');
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && task) onClose();
    };
    if (task) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [task, onClose]);

  if (!task || !localTask) return null;

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return;
    try {
      await onDelete(task.id, task.name);
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const priorityColors = {
    high: 'text-[var(--danger)] bg-[var(--danger)]/10 border-[var(--danger)]/20',
    medium: 'text-[var(--amber)] bg-[var(--amber)]/10 border-[var(--amber)]/20',
    low: 'text-[var(--text-subtle)] bg-[var(--text-subtle)]/10 border-[var(--text-subtle)]/20',
  };

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full sm:max-w-[520px] z-50 bg-[var(--bg)] border-l border-[var(--border-muted)] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="relative p-6 border-b border-[var(--border-muted)] bg-[var(--surface)]/50 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${priorityColors[editPriority]}`}>
                    {editPriority} Priority
                  </div>
                  {hasChanges && (
                    <span className="text-[10px] font-bold text-[var(--amber)] uppercase tracking-widest bg-[var(--amber)]/10 px-2 py-1 rounded-lg">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <textarea
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                rows={2}
                className="w-full text-2xl font-bold bg-transparent border-none outline-none text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:ring-0 p-0 resize-none leading-tight"
                placeholder="Task name"
              />

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${editStatus === 'done'
                    ? 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]'
                    : 'bg-[var(--primary)]/10 border-[var(--primary)]/20 text-[var(--primary)]'
                    }`}
                    onClick={() => setEditStatus(editStatus === 'done' ? 'todo' : 'done')}
                  >
                    {editStatus === 'done' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {editStatus === 'done' ? 'Completed' : 'Mark Done'}
                    </span>
                  </div>
                </div>

                {hasChanges && (
                  <button
                    onClick={onSaveChanges}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-[var(--primary)] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 gap-8">
                {/* Assignees */}
                <div className="group">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                    <User className="w-3 h-3" />
                    Team Assignees
                  </label>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 p-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--card)]/50 min-h-[50px]">
                      {editAssignees.map((p, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] text-[11px] font-bold border border-[var(--primary)]/20">
                          {p}
                          <X className="w-3 h-3 cursor-pointer hover:rotate-90 transition-transform" onClick={() => setEditAssignees(prev => prev.filter((_, idx) => idx !== i))} />
                        </span>
                      ))}
                      <input
                        list="drawer-people"
                        value={personInput}
                        onChange={(e) => setPersonInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && personInput.trim()) {
                            e.preventDefault();
                            if (!editAssignees.includes(personInput.trim())) {
                              setEditAssignees([...editAssignees, personInput.trim()]);
                            }
                            setPersonInput('');
                          }
                        }}
                        placeholder="Add assignee..."
                        className="flex-1 bg-transparent text-sm font-medium outline-none min-w-[100px]"
                      />
                      <datalist id="drawer-people">
                        {uniquePeople.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {uniquePeople.filter(p => !editAssignees.includes(p)).slice(0, 8).map(p => (
                        <button key={p} onClick={() => setEditAssignees([...editAssignees, p])} className="text-[10px] font-bold text-[var(--text-subtle)] bg-[var(--card-hover)]/40 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] px-2 py-1 rounded-lg border border-transparent hover:border-[var(--primary)]/20 transition-all">
                          + {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Date & Category */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="group">
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                      <Calendar className="w-3 h-3" />
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="w-full bg-[var(--card)]/50 border border-[var(--border-muted)] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[var(--primary)]/30"
                    />
                    {editDeadline && (
                      <p className="mt-2 text-[10px] font-bold text-[var(--primary)] opacity-80 uppercase tracking-[0.1em]">
                        {getRelativeDeadlineLabel(editDeadline, new Date().toISOString().slice(0, 10))}
                      </p>
                    )}
                  </div>
                  <div className="group">
                    <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                      <Tag className="w-3 h-3" />
                      Category
                    </label>
                    <div className="relative">
                      <input
                        list="drawer-categories"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="e.g. Design"
                        className="w-full bg-[var(--card)]/50 border border-[var(--border-muted)] rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-[var(--primary)]/30"
                      />
                      <datalist id="drawer-categories">
                        {uniqueCategories.map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                  </div>
                </div>

                {/* Priority Selection */}
                <div className="group">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                    <Flag className="w-3 h-3" />
                    Priority Factor
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-[var(--card)]/30 p-1.5 rounded-2xl border border-[var(--border-muted)]">
                    {(['low', 'medium', 'high'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setEditPriority(p)}
                        className={`text-[10px] font-bold uppercase py-2.5 rounded-xl transition-all ${editPriority === p
                          ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20'
                          : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                          }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="group">
                  <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] mb-3 group-hover:text-[var(--primary)] transition-colors">
                    <Info className="w-3 h-3" />
                    Notes & Details
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Start typing your notes here..."
                    rows={6}
                    className="w-full bg-[var(--card)]/50 border border-[var(--border-muted)] rounded-3xl px-5 py-4 text-sm font-medium leading-relaxed outline-none focus:border-[var(--primary)]/30 resize-none"
                  />
                </div>
              </div>

              {/* Created Info */}
              <div className="pt-6 border-t border-[var(--border-muted)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--card)]/50 rounded-xl border border-[var(--border-muted)]">
                    <Clock className="w-4 h-4 text-[var(--text-subtle)]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-subtle)] uppercase tracking-widest">Date Created</p>
                    <p className="text-xs font-semibold text-[var(--text-muted)]">
                      {new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                {!hasChanges && !isSaving && (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--success)] uppercase tracking-widest opacity-60">
                    <Sparkles className="w-3 h-3" />
                    Synced
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-[var(--border-muted)] bg-[var(--surface)]/30 backdrop-blur-md">
              {!showDeleteConfirm ? (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold text-[var(--danger)] border border-[var(--danger)]/10 hover:bg-[var(--danger)] hover:text-white transition-all transform active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Task
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-[var(--danger)] bg-[var(--danger)]/10 p-4 rounded-2xl border border-[var(--danger)]/20 mb-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-xs font-semibold leading-snug">
                      Are you sure? Type <span className="underline italic">delete</span> to destroy.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type 'delete'..."
                    className="w-full rounded-2xl border-2 border-[var(--danger)]/30 bg-[var(--input)] px-4 py-3 text-sm font-bold outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={deleteConfirmText.trim().toLowerCase() !== 'delete'}
                      className="flex-[2] rounded-2xl px-4 py-3 text-sm font-bold text-white bg-[var(--danger)] hover:opacity-90 disabled:opacity-50 transition-all font-bold"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-[var(--text-muted)] border border-[var(--border-muted)] bg-[var(--card)] transition-all font-bold"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
