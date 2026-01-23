'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebaseClient';
import TaskDrawer from '../components/TaskDrawer';
import SearchableDropdown from '../components/SearchableDropdown';
import { useTheme } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { formatDeadline, getRelativeDeadlineLabel } from '../lib/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  User,
  Tag,
  Plus,
  Search,
  Filter,
  LayoutGrid,
  MoreHorizontal,
  ChevronRight,
  AlertCircle,
  Trophy,
  Moon,
  Sun,
  X,
  Sparkles,
  Info,
  ArrowUpDown
} from 'lucide-react';


type TaskStatus = 'todo' | 'done';
type Priority = 'low' | 'medium' | 'high';
type ViewMode = 'all' | 'today' | 'upcoming' | 'noDeadline' | 'overdue';

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

const DEFAULT_PERSON = 'Me';



export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignees, setAssignees] = useState<string[]>([]);
  const [personInput, setPersonInput] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [meetingMode, setMeetingMode] = useState(false);
  const [sortBy, setSortBy] = useState<'smart' | 'deadline' | 'priority' | 'name' | 'createdAt' | 'assignee'>('smart');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done'>('todo');

  const [drawerTask, setDrawerTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const taskNameInputRef = useRef<HTMLInputElement>(null);
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null);


  // 🌓 Theme hook
  const { theme, toggleTheme, mounted } = useTheme();

  // 🔥 Live subscription to Firestore
  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data: Task[] = snapshot.docs.map((d) => {
          const t = d.data() as any;
          return {
            id: d.id,
            name: t.name,
            deadline: t.deadline || null,
            person: t.person || null,
            status: (t.status as TaskStatus) || 'todo',
            createdAt: t.createdAt || new Date().toISOString(),
            priority: (t.priority as Priority) || 'medium',
            category: t.category || null,
            description: t.description || null,
          };
        });
        setTasks(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching tasks:', error);
        alert('Failed to load tasks. Please refresh the page.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const peopleFrequencies = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.person && t.person.trim()) {
        t.person.split(',').forEach(p => {
          const part = p.trim();
          if (part) counts.set(part, (counts.get(part) || 0) + 1);
        });
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(entry => entry[0]);
  }, [tasks]);

  const uniquePeople = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.person && t.person.trim()) {
        t.person.split(',').forEach(p => {
          const part = p.trim();
          if (part) set.add(part);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const categoryFrequencies = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => {
      if (t.category && t.category.trim()) {
        const cat = t.category.trim();
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(entry => entry[0]);
  }, [tasks]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category && t.category.trim()) set.add(t.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  // Get today's date string (YYYY-MM-DD) - updates on mount and daily
  const getTodayDateStr = () => new Date().toISOString().slice(0, 10);
  const [todayDateStr, setTodayDateStr] = useState(getTodayDateStr());

  // Update date at midnight or on mount
  useEffect(() => {
    const updateDate = () => setTodayDateStr(getTodayDateStr());
    updateDate(); // Update on mount

    // Calculate ms until next midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timeoutId = setTimeout(() => {
      updateDate();
      // Then update every 24 hours
      const intervalId = setInterval(updateDate, 24 * 60 * 60 * 1000);
      return () => clearInterval(intervalId);
    }, msUntilMidnight);

    return () => clearTimeout(timeoutId);
  }, []);

  // 🔥 This is where a new task is saved to Firestore
  const handleAddTask = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Task name is required.');
      return;
    }

    const finalPerson = assignees.length > 0 ? assignees.join(', ') : DEFAULT_PERSON;

    try {
      await addDoc(collection(db, 'tasks'), {
        name: trimmedName,
        deadline: deadline || null,
        person: finalPerson,
        status: 'todo',
        createdAt: new Date().toISOString(),
        priority,
        category: category.trim() || null,
        description: description.trim() || null,
      });

      setName('');
      setDeadline('');
      setAssignees([]);
      setPersonInput('');
      setPriority('medium');
      setCategory('');
      setDescription('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    }
  };

  // Handle Esc key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };

    if (showAddModal) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [showAddModal]);

  // Handle Ctrl/Cmd+Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        showAddModal &&
        (e.ctrlKey || e.metaKey) &&
        e.key === 'Enter'
      ) {
        e.preventDefault();
        handleAddTask();
      }
    };

    if (showAddModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAddModal, name, deadline, assignees, priority, category, description]);

  // Autofocus task name input when modal opens
  useEffect(() => {
    if (showAddModal && taskNameInputRef.current) {
      taskNameInputRef.current.focus();
    }
  }, [showAddModal]);

  const toggleStatus = async (id: string, current: TaskStatus) => {
    const newStatus: TaskStatus = current === 'todo' ? 'done' : 'todo';

    // 🎉 Confetti effect when completing a task
    if (newStatus === 'done') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#f59e0b']
      });
    }

    try {
      await updateDoc(doc(db, 'tasks', id), { status: newStatus });
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.02,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  const todayPretty = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [todayDateStr] // Recompute when date changes
  );

  const openDrawer = useCallback((task: Task) => setDrawerTask({ ...task }), []);
  const closeDrawer = useCallback(() => setDrawerTask(null), []);

  const saveEdit = async () => {
    // Legacy - removed
  };

  const cancelEdit = () => {
    // Legacy - removed
  };

  const deleteTask = async (id: string, taskName?: string) => {
    const message = taskName
      ? `Delete "${taskName}"? This cannot be undone.`
      : 'Delete this task? This cannot be undone.';
    if (!confirm(message)) return;

    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        // Status filter (Active/Completed/Both)
        if (statusFilter === 'todo' && t.status !== 'todo') return false;
        if (statusFilter === 'done' && t.status !== 'done') return false;


        // Search
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          if (!t.name.toLowerCase().includes(q)) return false;
        }

        if (personFilter.trim()) {
          const taskPeople = (t.person || '').split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
          if (!taskPeople.includes(personFilter.trim().toLowerCase())) return false;
        }

        // Category
        if (categoryFilter.trim()) {
          if ((t.category || '').trim().toLowerCase() !== categoryFilter.trim().toLowerCase()) return false;
        }

        // Priority
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

        // Date Range
        if ((fromDate || toDate) && t.deadline) {
          const d = t.deadline;
          if (fromDate && d < fromDate) return false;
          if (toDate && d > toDate) return false;
        }

        // View Mode (Today, Upcoming, etc)
        if (viewMode === 'today') {
          if (!t.deadline || t.deadline !== todayDateStr) return false;
        } else if (viewMode === 'upcoming') {
          if (!t.deadline || t.deadline <= todayDateStr) return false;
        } else if (viewMode === 'noDeadline') {
          if (t.deadline) return false;
        } else if (viewMode === 'overdue') {
          if (!t.deadline || t.deadline >= todayDateStr) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'assignee') return (a.person || '').localeCompare(b.person || '');
        if (sortBy === 'createdAt') return b.createdAt.localeCompare(a.createdAt);
        if (sortBy === 'deadline') {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return a.deadline.localeCompare(b.deadline);
        }
        if (sortBy === 'priority') {
          const pOrder = { high: 3, medium: 2, low: 1 };
          if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[b.priority] - pOrder[a.priority];
          return b.createdAt.localeCompare(a.createdAt);
        }

        // Default: Smart Hierarchical Sort
        // 0. Status (Pending before Completed) - Essential for functionality
        if (a.status !== b.status) {
          return a.status === 'todo' ? -1 : 1;
        }

        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const da = a.deadline || '';
        const db = b.deadline || '';

        // 1. Deadline (Closest/Overdue first)
        if (da !== db) {
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        }

        // 2. Priority (High to Low)
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }

        // 3. Assignee Name (A-Z)
        return (a.person || '').localeCompare(b.person || '');
      });
  }, [tasks, search, personFilter, categoryFilter, fromDate, toDate, viewMode, sortBy, priorityFilter, statusFilter, todayDateStr]);



  const priorityLabel = (p: Priority) =>
    p === 'high' ? 'High' : p === 'medium' ? 'Medium' : 'Low';

  const priorityStyles = (p: Priority) => {
    // Quiet priority styling - just text color, no background
    return '';
  };

  const viewTabClasses = (mode: ViewMode) =>
    'px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer border transition-colors ' +
    (viewMode === mode
      ? 'bg-[var(--primary)] text-[var(--surface)] border-[var(--primary)] shadow-sm'
      : 'bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--primary)]');

  if (!mounted) return null; // Prevent flash of wrong theme

  // Dashboard Stats
  const activeCount = tasks.filter(t => t.status === 'todo').length;
  const overdueCount = tasks.filter(t => t.status === 'todo' && t.deadline && t.deadline < todayDateStr).length;
  const todayCount = tasks.filter(t => t.status === 'todo' && t.deadline && t.deadline === todayDateStr).length;
  const completedCount = tasks.filter(t => t.status === 'done').length;

  return (
    <main className="h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-hidden transition-colors duration-300">
      {/* suggestion lists for input */}
      <datalist id="person-list">
        {uniquePeople.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <datalist id="category-list">
        {uniqueCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="flex-1 flex flex-col overflow-hidden mx-auto w-full max-w-[1800px] px-3 py-3 md:py-4">
        {/* HEADER */}
        <header className="flex-shrink-0 mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-[var(--primary)]/10 rounded-2xl border border-[var(--primary)]/20 shadow-sm shadow-[var(--primary)]/5">
              <Sparkles className="w-6 h-6 text-[var(--primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl bg-clip-text text-transparent bg-gradient-to-br from-[var(--text)] to-[var(--text-muted)]">
                Task MGMT
              </h1>
              <p className="text-sm text-[var(--text-muted)] font-medium">
                Organize with speed. Deliver with precision.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={() => setMeetingMode(!meetingMode)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 border transition-all text-xs font-semibold shadow-sm overflow-hidden group ${meetingMode
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--primary)]/50'
                }`}
            >
              <Filter className={`w-3.5 h-3.5 transition-transform ${meetingMode ? 'scale-110' : 'group-hover:rotate-12'}`} />
              {meetingMode ? 'Meeting active' : 'Meeting mode'}
            </button>
            <button
              onClick={toggleTheme}
              className="rounded-2xl bg-[var(--surface)] p-2.5 border border-[var(--border)] hover:border-[var(--primary)] transition-all shadow-sm hover:shadow-md group active:scale-90"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors" /> : <Sun className="w-4 h-4 text-[var(-- amber)] group-hover:scale-110 transition-transform" />}
            </button>
            <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-[var(--surface)] px-4 py-2 shadow-sm border border-[var(--border)] group hover:border-[var(--primary)]/30 transition-colors">
              <Calendar className="w-4 h-4 text-[var(--primary)] group-hover:rotate-12 transition-transform" />
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-subtle)] leading-none mb-0.5">
                  Today
                </p>
                <p className="text-[13px] font-bold text-[var(--text)] whitespace-nowrap">
                  {todayPretty}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* QUICK STATS DASHBOARD */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-2xl glass-panel border border-[var(--border-muted)] flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-subtle)] mb-0.5">Active Tasks</p>
              <h3 className="text-xl font-bold text-[var(--text)]">{activeCount}</h3>
            </div>
            <CheckCircle2 className="w-10 h-10 text-[var(--text-muted)]/5 absolute -right-2 transform group-hover:rotate-12 transition-transform" />
          </div>

          <div className="p-3 rounded-2xl glass-panel border border-[var(--danger)]/20 bg-[var(--danger)]/5 flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--danger)]/70 mb-0.5">Overdue</p>
              <h3 className="text-xl font-bold text-[var(--danger)]">{overdueCount}</h3>
            </div>
            <AlertCircle className="w-10 h-10 text-[var(--danger)]/10 absolute -right-2 transform group-hover:-rotate-12 transition-transform" />
          </div>

          <div className="p-3 rounded-2xl glass-panel border border-[var(--amber)]/20 bg-[var(--amber)]/5 flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--amber)]/70 mb-0.5">Due Today</p>
              <h3 className="text-xl font-bold text-[var(--amber)]">{todayCount}</h3>
            </div>
            <Clock className="w-10 h-10 text-[var(--amber)]/10 absolute -right-2 transform group-hover:scale-110 transition-transform" />
          </div>

          <div className="p-3 rounded-2xl glass-panel border border-[var(--success)]/20 bg-[var(--success)]/5 flex items-center justify-between group overflow-hidden relative">
            <div className="relative z-10">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--success)]/70 mb-0.5">Done</p>
              <h3 className="text-xl font-bold text-[var(--success)]">{completedCount}</h3>
            </div>
            <Trophy className="w-10 h-10 text-[var(--success)]/10 absolute -right-2 transform group-hover:rotate-12 transition-transform" />
          </div>
        </div>

        {/* Floating New Task Button - Hidden in Meeting Mode */}
        {!meetingMode && (
          <button
            onClick={() => setShowAddModal(true)}
            className="fixed bottom-6 right-6 z-30 inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[var(--primary-hover)] active:scale-[0.95] transition-all hover:shadow-xl"
            aria-label="Add new task"
          >
            <span className="text-xl mr-2">+</span>
            New task
          </button>
        )}

        {/* Task list - full width with fixed header */}
        <section className="flex-1 flex flex-col overflow-hidden rounded-2xl shadow-sm border border-[var(--border-muted)] backdrop-blur-xl bg-[var(--surface)]/80">
          {/* Fixed Header */}
          {/* Integrated Filter Bar */}
          <div className="flex-shrink-0 p-2.5 border-b border-[var(--border-muted)]">
            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
              {/* Search */}
              <div className="relative w-40 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-subtle)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tasks…"
                  disabled={meetingMode}
                  className={`h-[30px] w-full rounded-xl border border-[var(--border-muted)] bg-[var(--card)]/50 backdrop-blur-md pl-8 pr-3 text-[11px] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/10 transition-all ${meetingMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* View Mode Tabs */}
              <div className="flex items-center gap-0.5 rounded-xl bg-[var(--card)]/30 backdrop-blur-md p-0.5 border border-[var(--border-muted)] h-[30px]">
                {(['overdue', 'today', 'upcoming', 'noDeadline', 'all'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => !meetingMode && setViewMode(mode)}
                    disabled={meetingMode}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all capitalize h-full flex items-center ${viewMode === mode
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--primary)]'
                      } ${meetingMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {mode === 'noDeadline' ? 'None' : mode}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-0.5 rounded-xl bg-[var(--card)]/30 backdrop-blur-md p-0.5 border border-[var(--border-muted)] h-[30px]">
                {(['todo', 'done', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => !meetingMode && setStatusFilter(s)}
                    disabled={meetingMode}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all capitalize h-full flex items-center ${statusFilter === s
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--primary)]'
                      } ${meetingMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {s === 'todo' ? 'Pending' : s === 'done' ? 'Completed' : 'Both'}
                  </button>
                ))}
              </div>

              {/* Priority Dropdown */}
              <SearchableDropdown
                options={[
                  { label: 'Priorities', value: 'all' },
                  { label: 'High Priority', value: 'high' },
                  { label: 'Medium Priority', value: 'medium' },
                  { label: 'Low Priority', value: 'low' },
                ]}
                value={priorityFilter}
                onChange={(val: string) => setPriorityFilter(val as any)}
                placeholder="Priority"
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                disabled={meetingMode}
                searchable={false}
                className="w-32"
              />

              {/* Sort Dropdown */}
              <SearchableDropdown
                options={[
                  { label: 'Smart Sort', value: 'smart' },
                  { label: 'Deadline', value: 'deadline' },
                  { label: 'Priority factor', value: 'priority' },
                  { label: 'Task Name', value: 'name' },
                  { label: 'Assignee Name', value: 'assignee' },
                  { label: 'Newest', value: 'createdAt' },
                ]}
                value={sortBy}
                onChange={(val: string) => setSortBy(val as any)}
                placeholder="Sort By"
                icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                disabled={meetingMode}
                searchable={false}
                className="w-32"
              />

              {/* Person Dropdown */}
              <SearchableDropdown
                options={uniquePeople}
                value={personFilter}
                onChange={setPersonFilter}
                placeholder="All People"
                icon={<User className="w-3.5 h-3.5" />}
                disabled={meetingMode}
                className="w-36"
              />

              {/* Category Dropdown */}
              <SearchableDropdown
                options={uniqueCategories}
                value={categoryFilter}
                onChange={setCategoryFilter}
                placeholder="Categories"
                icon={<Tag className="w-3.5 h-3.5" />}
                disabled={meetingMode}
                className="w-36"
              />

              {/* Date Range Box */}
              <div className="flex items-center gap-1.5 bg-[var(--card)]/30 backdrop-blur-sm px-2.5 rounded-xl border border-[var(--border-muted)] h-[30px] group hover:border-[var(--primary)]/30 transition-all">
                <Calendar className="w-3.5 h-3.5 text-[var(--text-subtle)] group-hover:text-[var(--primary)] flex-shrink-0" />
                <div className="flex items-center">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => !meetingMode && setFromDate(e.target.value)}
                    disabled={meetingMode}
                    className="bg-transparent text-[10px] font-bold text-[var(--text)] outline-none w-[95px] cursor-pointer"
                  />
                  <span className="text-[var(--text-subtle)] mx-0.5 opacity-30">—</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => !meetingMode && setToDate(e.target.value)}
                    disabled={meetingMode}
                    className="bg-transparent text-[10px] font-bold text-[var(--text)] outline-none w-[95px] cursor-pointer"
                  />
                </div>
                {(fromDate || toDate) && (
                  <button
                    onClick={() => { setFromDate(''); setToDate(''); }}
                    className="p-0.5 rounded-full hover:bg-[var(--danger)]/10 text-[var(--text-subtle)] hover:text-[var(--danger)] transition-all"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {(personFilter || categoryFilter || fromDate || toDate || search || priorityFilter !== 'all' || viewMode !== 'all' || statusFilter !== 'todo') && !meetingMode && (
                <button
                  onClick={() => {
                    setPersonFilter('');
                    setCategoryFilter('');
                    setFromDate('');
                    setToDate('');
                    setSearch('');
                    setPriorityFilter('all');
                    setViewMode('all');
                    setStatusFilter('todo');
                  }}
                  className="h-[30px] rounded-xl border border-[var(--danger)]/20 bg-[var(--danger)]/5 px-2.5 text-[10px] font-bold text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-all active:scale-95"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>


          {/* Scrollable Task Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredTasks.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-[var(--text-subtle)]">
                No tasks match the current filters.
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5"
              >
                <AnimatePresence initial={false}>
                  {filteredTasks.map((task, index) => {
                    const overdue =
                      !!task.deadline && task.deadline < todayDateStr && task.status !== 'done';
                    const dueToday =
                      !!task.deadline && task.deadline === todayDateStr && task.status !== 'done';

                    // Subtle grouping: extra spacing before first "Due today" and first "Overdue"
                    const isFirstOverdue = overdue && index > 0 &&
                      !filteredTasks.slice(0, index).some(t =>
                        !!t.deadline && t.deadline < todayDateStr && t.status !== 'done'
                      );
                    const isFirstDueToday = dueToday && index > 0 &&
                      !filteredTasks.slice(0, index).some(t =>
                        !!t.deadline && t.deadline === todayDateStr && t.status !== 'done'
                      ) &&
                      !filteredTasks.slice(0, index).some(t =>
                        !!t.deadline && t.deadline < todayDateStr && t.status !== 'done'
                      );

                    return (
                      <motion.div
                        layout
                        variants={itemVariants}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={task.id}
                        onClick={() => openDrawer(task)}
                        whileHover={{ y: -2, boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        className="relative"
                      >
                        <div className={`task-card group relative bg-[var(--card)] rounded-2xl p-3 pl-4 cursor-pointer shadow-sm border border-l-4 border-[var(--border-muted)] hover:border-r-[var(--primary)]/30 transition-all duration-300 ${task.priority === 'high' ? 'border-l-[var(--danger)]/80' :
                          task.priority === 'medium' ? 'border-l-[var(--amber)]/80' :
                            'border-l-slate-500/50'
                          } ${isFirstOverdue || isFirstDueToday ? 'mt-6' : ''}`}>

                          <div className="flex items-start justify-between gap-2 mb-2.5">
                            <h3 className={`font-bold text-[13px] leading-tight flex-1 line-clamp-2 ${task.status === 'done' ? 'text-[var(--text-subtle)] line-through' : 'text-[var(--text)]'
                              }`}>
                              {task.name}
                            </h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (task.status === 'done') {
                                  toggleStatus(task.id, task.status);
                                } else {
                                  if (confirmingTaskId === task.id) {
                                    toggleStatus(task.id, task.status);
                                    setConfirmingTaskId(null);
                                  } else {
                                    setConfirmingTaskId(task.id);
                                    // Reset after 3 seconds of inactivity
                                    setTimeout(() => {
                                      setConfirmingTaskId(current => current === task.id ? null : current);
                                    }, 3000);
                                  }
                                }
                              }}
                              className={`rounded-xl transition-all flex-shrink-0 flex items-center gap-1.5 ${task.status === 'done'
                                ? 'p-1.5 bg-[var(--success)]/10 text-[var(--success)]'
                                : confirmingTaskId === task.id
                                  ? 'pl-2 pr-1.5 py-1 bg-[var(--success)]/20 text-[var(--success)] ring-2 ring-[var(--success)]/20 shadow-lg shadow-[var(--success)]/10'
                                  : 'p-1.5 text-[var(--text-subtle)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10'
                                }`}
                            >
                              {task.status === 'done' ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : confirmingTaskId === task.id ? (
                                <>
                                  <span className="text-[9px] font-bold uppercase tracking-wider">Confirm?</span>
                                  <CheckCircle2 className="w-4 h-4" />
                                </>
                              ) : (
                                <Circle className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>

                          <div className="space-y-3">
                            {task.person && (
                              <div className="flex items-center gap-2">
                                <div className="flex -space-x-2">
                                  {task.person.split(',').map((p, i) => {
                                    const part = p.trim();
                                    if (!part) return null;
                                    const initials = part.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                                    return (
                                      <div key={i} className="h-5.5 w-5.5 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-2 ring-[var(--card)] flex-shrink-0 group-hover:rotate-3 transition-transform">
                                        {initials}
                                      </div>
                                    );
                                  })}
                                </div>
                                <span className="text-[10px] font-bold text-[var(--text-muted)] line-clamp-1">
                                  {task.person}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-2 flex-wrap">
                              {task.deadline && (
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all ${overdue && task.status !== 'done'
                                  ? 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20'
                                  : dueToday && task.status !== 'done'
                                    ? 'bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]/20'
                                    : 'bg-[var(--card-hover)] text-[var(--text-muted)] border-transparent'
                                  }`}>
                                  <Calendar className="w-2.5 h-2.5" />
                                  <span>{task.status === 'done' ? formatDeadline(task.deadline) : getRelativeDeadlineLabel(task.deadline, todayDateStr)}</span>
                                </div>
                              )}

                              {task.category && (
                                <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--text-subtle)] bg-[var(--card-hover)]/30 px-2 py-0.5 rounded-lg border border-transparent group-hover:border-[var(--border-muted)] transition-all">
                                  <Tag className="w-2.5 h-2.5" />
                                  <span className="line-clamp-1 max-w-[90px]">{task.category}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>



        {/* TASK DRAWER */}
        <TaskDrawer
          task={drawerTask}
          onClose={closeDrawer}
          onDelete={deleteTask}
          uniquePeople={uniquePeople}
          uniqueCategories={uniqueCategories}
        />

        {/* ADD TASK MODAL */}
        <AnimatePresence>
          {showAddModal && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setShowAddModal(false)}
              />

              {/* Modal Container */}
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="w-full max-w-2xl rounded-[32px] bg-[var(--bg)] shadow-2xl border border-[var(--border-muted)] max-h-[95vh] overflow-hidden flex flex-col pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-6 border-b border-[var(--border-muted)] bg-[var(--surface)]/50 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[var(--primary)]/10 rounded-xl border border-[var(--primary)]/20">
                        <Plus className="w-5 h-5 text-[var(--primary)]" />
                      </div>
                      <h2 className="text-xl font-bold text-[var(--text)]">
                        Create New Task
                      </h2>
                    </div>
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="p-2 rounded-xl hover:bg-[var(--card-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all"
                      aria-label="Close modal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Form Content */}
                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    <div className="group">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                        Task Name <span className="text-[var(--danger)]">*</span>
                      </label>
                      <input
                        ref={taskNameInputRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-2xl border border-[var(--border-muted)] bg-[var(--card)]/50 px-4 py-3 text-lg font-semibold text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)]/50 focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10 transition-all"
                        placeholder="What needs to be done?"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="group">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            Expected Date
                          </div>
                        </label>
                        <input
                          type="date"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full rounded-2xl border border-[var(--border-muted)] bg-[var(--card)]/50 px-4 py-3 text-sm font-medium text-[var(--text)] focus:border-[var(--primary)]/50 focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10 transition-all"
                        />
                      </div>
                      <div className="group">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            Assigned Employees
                          </div>
                        </label>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1.5 px-3 py-2.5 min-h-[46px] rounded-2xl border border-[var(--border-muted)] bg-[var(--card)]/50 focus-within:ring-2 focus-within:ring-[var(--primary)]/20 focus-within:border-[var(--primary)]/50 transition-all">
                            {assignees.map((p, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold transition-all shadow-sm animate-in fade-in zoom-in duration-200">
                                {p}
                                <X
                                  className="w-3.5 h-3.5 cursor-pointer hover:scale-125 transition-transform"
                                  onClick={() => setAssignees(prev => prev.filter((_, idx) => idx !== i))}
                                />
                              </span>
                            ))}
                            <input
                              list="person-list"
                              value={personInput}
                              onChange={(e) => setPersonInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && personInput.trim()) {
                                  e.preventDefault();
                                  if (!assignees.includes(personInput.trim())) {
                                    setAssignees([...assignees, personInput.trim()]);
                                  }
                                  setPersonInput('');
                                }
                              }}
                              placeholder={assignees.length === 0 ? "Type and press enter..." : ""}
                              className="flex-1 bg-transparent text-sm font-semibold text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none min-w-[120px]"
                            />
                            {personInput.trim() && (
                              <button
                                onClick={() => {
                                  if (!assignees.includes(personInput.trim())) {
                                    setAssignees([...assignees, personInput.trim()]);
                                  }
                                  setPersonInput('');
                                }}
                                className="p-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white transition-all"
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                          {peopleFrequencies.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[9px] font-black text-[var(--text-subtle)] uppercase tracking-wider self-center mr-1">Frequent:</span>
                              {peopleFrequencies.filter(p => !assignees.includes(p)).slice(0, 8).map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => setAssignees([...assignees, p])}
                                  className="text-[10px] font-bold text-[var(--text)] hover:text-white bg-[var(--card-hover)]/40 hover:bg-[var(--primary)] px-2.5 py-1.5 rounded-lg transition-all border border-black/5 hover:border-transparent active:scale-95"
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="group">
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                        <div className="flex items-center gap-2">
                          <Info className="w-3 h-3" />
                          Task Details
                        </div>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add additional context or requirements..."
                        rows={4}
                        className="w-full rounded-3xl border border-[var(--border-muted)] bg-[var(--card)]/50 px-4 py-3 text-sm font-medium text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--primary)]/50 focus:outline-none focus:ring-4 focus:ring-[var(--primary)]/10 transition-all resize-none"
                      />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="group">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                          Priority
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-[var(--card)]/50 p-1 rounded-2xl border border-[var(--border-muted)]">
                          {(['low', 'medium', 'high'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPriority(p)}
                              className={`text-[10px] font-bold uppercase py-2 rounded-xl transition-all ${priority === p
                                ? 'bg-[var(--surface)] text-[var(--text)] shadow-md'
                                : 'text-[var(--text-subtle)] hover:text-[var(--text)]'
                                }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="group">
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-subtle)] group-hover:text-[var(--primary)] transition-colors">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3 h-3" />
                            Category
                          </div>
                        </label>
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1.5 px-3 py-2.5 min-h-[46px] rounded-2xl border border-[var(--border-muted)] bg-[var(--card)]/50 focus-within:ring-2 focus-within:ring-[var(--primary)]/20 focus-within:border-[var(--primary)]/50 transition-all">
                            {category ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold transition-all shadow-sm">
                                {category}
                                <X
                                  className="w-3.5 h-3.5 cursor-pointer hover:scale-125 transition-transform"
                                  onClick={() => setCategory('')}
                                />
                              </span>
                            ) : null}
                            {!category && (
                              <input
                                list="category-list"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="e.g. Design"
                                className="flex-1 bg-transparent text-sm font-semibold text-[var(--text)] placeholder:text-[var(--text-subtle)] outline-none min-w-[120px]"
                              />
                            )}
                          </div>
                          {categoryFrequencies.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[9px] font-black text-[var(--text-subtle)] uppercase tracking-wider self-center mr-1">Frequent:</span>
                              {categoryFrequencies.filter(cat => cat !== category).slice(0, 8).map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => setCategory(cat)}
                                  className="text-[10px] font-bold text-[var(--text)] hover:text-white bg-[var(--card-hover)]/40 hover:bg-[var(--primary)] px-2.5 py-1.5 rounded-lg transition-all border border-black/5 hover:border-transparent active:scale-95"
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t border-[var(--border-muted)] bg-[var(--surface)]/30 backdrop-blur-md flex gap-4 flex-shrink-0">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] px-4 py-3.5 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--card-hover)] transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddTask}
                      className="flex-[2] rounded-2xl bg-[var(--primary)] px-4 py-3.5 text-sm font-bold text-white shadow-xl shadow-[var(--primary)]/20 hover:bg-[var(--primary-hover)] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Create Portal Task
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
