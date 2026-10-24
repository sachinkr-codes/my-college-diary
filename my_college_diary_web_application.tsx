import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  Plus, 
  Search, 
  LogOut, 
  GraduationCap, 
  BookMarked, 
  CheckSquare, 
  AlertCircle, 
  Layers, 
  User, 
  X, 
  Paperclip,
  Image as ImageIcon,
  FileText,
  Printer,
  MapPin,
  Clock4,
  Check,
  Eye,
  Download,
  UploadCloud,
  File,
  AlertTriangle,
  ZoomIn,
  Grid,
  List,
  Filter,
  ShieldCheck,
  FolderOpen,
  Heart,
  Award,
  Compass,
  Laptop,
  UserCheck
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';

// --- Firebase Initialization ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "demo-api-key",
      authDomain: "demo-app.firebaseapp.com",
      projectId: "demo-app",
      storageBucket: "demo-app.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:college-diary-app"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'my-college-diary';

const COMMON_SUBJECTS = [
  'Data Structures & Algorithms',
  'Operating Systems',
  'Database Management Systems',
  'Computer Networks',
  'Mathematics & Statistics',
  'Software Engineering',
  'Artificial Intelligence & Machine Learning',
  'Web & Cloud Technologies'
];

const SESSION_TYPES = ['Lecture', 'Practical Lab', 'Tutorial', 'Seminar / Workshop'];

// Initial seed entry for immediate onboarding demonstration
const SAMPLE_DIARY_ENTRY = {
  date: new Date().toISOString().split('T')[0],
  sessionType: 'Lecture',
  subject: 'Data Structures & Algorithms',
  professor: 'Prof. Alan Turing',
  roomTime: 'Room 304 - 10:00 AM',
  topic: 'Binary Search Trees & AVL Balancing Rotations',
  notes: 'Analyzed balanced search trees with emphasis on left-right (LR) and right-left (RL) rotation criteria. Remember that height difference balance factor should stay strictly between -1 and +1.',
  keyTakeaways: 'Height balance formula: BF = Height(Left) - Height(Right). Rebalancing time complexity remains O(log N).',
  noteAttachments: [],
  hasHomework: true,
  homework: {
    title: 'Exercise 4.2: Implement AVL Insertion with Tree Balancing',
    description: 'Complete questions 1 to 8 from textbook chapter 4. Write C++/Java code showing AVL node rotations after 5 consecutive inserts.',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    priority: 'High',
    status: 'In Progress',
    isCompleted: false,
    completedAt: null,
    attachments: []
  }
};

const INITIAL_FORM_STATE = {
  date: new Date().toISOString().split('T')[0],
  sessionType: 'Lecture',
  subject: '',
  professor: '',
  roomTime: '',
  topic: '',
  notes: '',
  keyTakeaways: '',
  noteAttachments: [], // [{ id, name, size, type, dataUrl, isImage }]
  hasHomework: false,
  homework: {
    title: '',
    description: '',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: 'Medium',
    status: 'Pending',
    isCompleted: false,
    completedAt: null,
    attachments: []
  }
};

// Client-side image compression & document size validation
const processFileToPayload = (file) => {
  return new Promise((resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();

    if (isImage) {
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.72 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.72);
          resolve({
            id: 'file_' + Math.random().toString(36).substring(2, 9),
            name: file.name,
            size: Math.round(compressedDataUrl.length * 0.75),
            type: 'image/jpeg',
            dataUrl: compressedDataUrl,
            isImage: true,
            uploadedAt: new Date().toISOString()
          });
        };
        img.onerror = () => reject(new Error('Image processing failed'));
      };
      reader.onerror = () => reject(new Error('Error reading image file'));
      reader.readAsDataURL(file);
    } else {
      // Document file check (capped at 800KB for comfortable Firestore payload size)
      if (file.size > 800 * 1024) {
        reject(new Error('Document files must be smaller than 800KB.'));
        return;
      }
      reader.onload = (e) => {
        resolve({
          id: 'file_' + Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: e.target.result,
          isImage: false,
          uploadedAt: new Date().toISOString()
        });
      };
      reader.onerror = () => reject(new Error('Error reading document file'));
      reader.readAsDataURL(file);
    }
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export default function App() {
  // Authentication states
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Primary navigation views: 'feed' | 'homework-hub' | 'gallery' | 'ledger'
  const [activeTab, setActiveTab] = useState('feed');
  const [feedViewMode, setFeedViewMode] = useState('cards'); // 'cards' | 'table'

  // Data states
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Search & Filter controls
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [homeworkStatusFilter, setHomeworkStatusFilter] = useState('ALL');
  const [filterOnlyWithHw, setFilterOnlyWithHw] = useState(false);
  const [filterOnlyWithFiles, setFilterOnlyWithFiles] = useState(false);

  // Modals & editor state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [deleteModal, setDeleteModal] = useState({ open: false, id: '', title: '' });
  const [uploadingTarget, setUploadingTarget] = useState(null); // 'notes' | 'homework' | null

  // Lightbox / File Preview Modal
  const [previewFile, setPreviewFile] = useState(null);

  // Soft toast banner notification state
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const noteFileInputRef = useRef(null);
  const hwFileInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3200);
  };

  // 1. Initialize Firebase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth init exception:", err);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch User Data from Firestore
  useEffect(() => {
    if (!user) {
      setDiaryEntries([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const diaryRef = collection(db, 'artifacts', appId, 'users', user.uid, 'diaryEntries');

    const unsubscribe = onSnapshot(
      diaryRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setDiaryEntries(list);
        setDataLoading(false);

        // Auto-seed starter entry if account has 0 records
        if (list.length === 0 && !snapshot.metadata.hasPendingWrites) {
          addDoc(diaryRef, {
            ...SAMPLE_DIARY_ENTRY,
            createdAt: new Date().toISOString()
          }).catch((e) => console.log('Sample seed skipped:', e));
        }
      },
      (err) => {
        console.error("Diary sync error:", err);
        showToast("Error synchronizing your diary entries.", "error");
        setDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Dynamic Subject list
  const availableSubjects = useMemo(() => {
    const set = new Set(COMMON_SUBJECTS);
    diaryEntries.forEach((e) => {
      if (e.subject?.trim()) set.add(e.subject.trim());
    });
    return Array.from(set).sort();
  }, [diaryEntries]);

  // Global Statistics Summary
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let totalClasses = diaryEntries.length;
    let hwPending = 0;
    let hwCompleted = 0;
    let hwOverdue = 0;
    let totalAttachments = 0;

    diaryEntries.forEach((entry) => {
      totalAttachments += (entry.noteAttachments?.length || 0);
      if (entry.hasHomework && entry.homework) {
        totalAttachments += (entry.homework.attachments?.length || 0);
        if (entry.homework.isCompleted) {
          hwCompleted++;
        } else {
          hwPending++;
          if (entry.homework.dueDate && entry.homework.dueDate < today) {
            hwOverdue++;
          }
        }
      }
    });

    const completionRate = (hwCompleted + hwPending) > 0 
      ? Math.round((hwCompleted / (hwCompleted + hwPending)) * 100) 
      : 100;

    return { totalClasses, hwPending, hwCompleted, hwOverdue, totalAttachments, completionRate };
  }, [diaryEntries]);

  // Filtered Class Feed
  const filteredEntries = useMemo(() => {
    return diaryEntries.filter((entry) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        entry.topic?.toLowerCase().includes(q) ||
        entry.subject?.toLowerCase().includes(q) ||
        entry.notes?.toLowerCase().includes(q) ||
        entry.professor?.toLowerCase().includes(q) ||
        entry.homework?.title?.toLowerCase().includes(q);

      const matchSubject = subjectFilter === 'ALL' || entry.subject?.toLowerCase() === subjectFilter.toLowerCase();
      const matchSession = sessionFilter === 'ALL' || (entry.sessionType || 'Lecture') === sessionFilter;
      const matchHw = !filterOnlyWithHw || entry.hasHomework;
      const matchFiles = !filterOnlyWithFiles || (
        (entry.noteAttachments && entry.noteAttachments.length > 0) ||
        (entry.homework?.attachments && entry.homework.attachments.length > 0)
      );

      return matchSearch && matchSubject && matchSession && matchHw && matchFiles;
    });
  }, [diaryEntries, searchQuery, subjectFilter, sessionFilter, filterOnlyWithHw, filterOnlyWithFiles]);

  // Consolidated Homework List
  const consolidatedHomeworks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const hwList = [];

    diaryEntries.forEach((entry) => {
      if (entry.hasHomework && entry.homework) {
        const isOverdue = !entry.homework.isCompleted && entry.homework.dueDate && entry.homework.dueDate < today;
        const isDueToday = !entry.homework.isCompleted && entry.homework.dueDate === today;

        hwList.push({
          entryId: entry.id,
          classDate: entry.date,
          subject: entry.subject,
          professor: entry.professor,
          classTopic: entry.topic,
          sessionType: entry.sessionType || 'Lecture',
          ...entry.homework,
          isOverdue,
          isDueToday
        });
      }
    });

    hwList.sort((a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31'));

    return hwList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q);

      const matchSubject = subjectFilter === 'ALL' || item.subject?.toLowerCase() === subjectFilter.toLowerCase();

      let matchStatus = true;
      if (homeworkStatusFilter === 'PENDING') matchStatus = !item.isCompleted;
      if (homeworkStatusFilter === 'COMPLETED') matchStatus = item.isCompleted;
      if (homeworkStatusFilter === 'OVERDUE') matchStatus = item.isOverdue;

      return matchSearch && matchSubject && matchStatus;
    });
  }, [diaryEntries, searchQuery, subjectFilter, homeworkStatusFilter]);

  // Aggregated Attachments Gallery List
  const allAttachments = useMemo(() => {
    const list = [];
    diaryEntries.forEach((entry) => {
      // Notes attachments
      (entry.noteAttachments || []).forEach((att) => {
        list.push({
          ...att,
          sourceType: 'Class Notes',
          subject: entry.subject,
          topic: entry.topic,
          classDate: entry.date,
          entryId: entry.id
        });
      });
      // Homework attachments
      if (entry.hasHomework && entry.homework?.attachments) {
        entry.homework.attachments.forEach((att) => {
          list.push({
            ...att,
            sourceType: 'Homework',
            subject: entry.subject,
            topic: entry.homework.title || entry.topic,
            classDate: entry.date,
            entryId: entry.id
          });
        });
      }
    });

    return list.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || item.name.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q);
      const matchSubject = subjectFilter === 'ALL' || item.subject.toLowerCase() === subjectFilter.toLowerCase();
      return matchSearch && matchSubject;
    });
  }, [diaryEntries, searchQuery, subjectFilter]);

  // Auth Operations
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authEmail || !authPassword) {
      setAuthError('Please enter both email and password.');
      return;
    }
    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        showToast('Successfully signed in.');
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        showToast('Student account registered.');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    }
  };

  const handleGuestLogin = async () => {
    try {
      setAuthError('');
      await signInAnonymously(auth);
      showToast('Logged in as Guest Student.');
    } catch (err) {
      setAuthError('Guest student access is temporarily unavailable.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      showToast('Signed out safely.');
    } catch (err) {
      console.error(err);
    }
  };

  // Open Add/Edit Modal
  const handleOpenAddModal = () => {
    setEditingEntryId(null);
    setFormState(INITIAL_FORM_STATE);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry) => {
    setEditingEntryId(entry.id);
    setFormState({
      date: entry.date || new Date().toISOString().split('T')[0],
      sessionType: entry.sessionType || 'Lecture',
      subject: entry.subject || '',
      professor: entry.professor || '',
      roomTime: entry.roomTime || '',
      topic: entry.topic || '',
      notes: entry.notes || '',
      keyTakeaways: entry.keyTakeaways || '',
      noteAttachments: entry.noteAttachments || [],
      hasHomework: Boolean(entry.hasHomework),
      homework: {
        title: entry.homework?.title || '',
        description: entry.homework?.description || '',
        dueDate: entry.homework?.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        priority: entry.homework?.priority || 'Medium',
        status: entry.homework?.status || (entry.homework?.isCompleted ? 'Completed' : 'Pending'),
        isCompleted: Boolean(entry.homework?.isCompleted),
        completedAt: entry.homework?.completedAt || null,
        attachments: entry.homework?.attachments || []
      }
    });
    setIsModalOpen(true);
  };

  // File Upload Handlers
  const handleFileUpload = async (files, target) => {
    if (!files || files.length === 0) return;
    setUploadingTarget(target);
    try {
      const fileList = Array.from(files);
      const processedPromises = fileList.map(f => processFileToPayload(f));
      const processedFiles = await Promise.all(processedPromises);

      if (target === 'notes') {
        setFormState((prev) => ({
          ...prev,
          noteAttachments: [...prev.noteAttachments, ...processedFiles]
        }));
        showToast(`${processedFiles.length} file(s) attached to Class Notes.`);
      } else if (target === 'homework') {
        setFormState((prev) => ({
          ...prev,
          homework: {
            ...prev.homework,
            attachments: [...(prev.homework.attachments || []), ...processedFiles]
          }
        }));
        showToast(`${processedFiles.length} file(s) attached to Homework.`);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error processing attachments.', 'error');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleRemoveAttachment = (attachmentId, target) => {
    if (target === 'notes') {
      setFormState((prev) => ({
        ...prev,
        noteAttachments: prev.noteAttachments.filter(a => a.id !== attachmentId)
      }));
    } else {
      setFormState((prev) => ({
        ...prev,
        homework: {
          ...prev.homework,
          attachments: prev.homework.attachments.filter(a => a.id !== attachmentId)
        }
      }));
    }
  };

  // Save / Update Class Entry
  const handleSaveEntry = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!formState.subject.trim() || !formState.topic.trim()) {
      showToast('Subject name and Class Topic are required.', 'error');
      return;
    }

    if (formState.hasHomework && !formState.homework.title.trim()) {
      showToast('Please specify the Homework Title.', 'error');
      return;
    }

    try {
      const payload = {
        date: formState.date,
        sessionType: formState.sessionType || 'Lecture',
        subject: formState.subject.trim(),
        professor: formState.professor.trim(),
        roomTime: formState.roomTime.trim(),
        topic: formState.topic.trim(),
        notes: formState.notes.trim(),
        keyTakeaways: formState.keyTakeaways.trim(),
        noteAttachments: formState.noteAttachments || [],
        hasHomework: formState.hasHomework,
        homework: formState.hasHomework
          ? {
              title: formState.homework.title.trim(),
              description: formState.homework.description.trim(),
              dueDate: formState.homework.dueDate,
              priority: formState.homework.priority,
              status: formState.homework.isCompleted ? 'Completed' : formState.homework.status,
              isCompleted: formState.homework.isCompleted,
              completedAt: formState.homework.completedAt,
              attachments: formState.homework.attachments || []
            }
          : null,
        updatedAt: new Date().toISOString()
      };

      if (editingEntryId) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'diaryEntries', editingEntryId);
        await updateDoc(docRef, payload);
        showToast('Class entry and attachments updated!');
      } else {
        payload.createdAt = new Date().toISOString();
        const colRef = collection(db, 'artifacts', appId, 'users', user.uid, 'diaryEntries');
        await addDoc(colRef, payload);
        showToast('New class note & attachments recorded!');
      }

      setIsModalOpen(false);
      setFormState(INITIAL_FORM_STATE);
      setEditingEntryId(null);
    } catch (err) {
      console.error("Save failed:", err);
      showToast('Could not save diary entry.', 'error');
    }
  };

  // Instant Homework Checkbox toggle on card
  const handleToggleHomeworkStatus = async (entryId, currentHomework) => {
    if (!user || !currentHomework) return;
    const nextStatus = !currentHomework.isCompleted;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'diaryEntries', entryId);
      await updateDoc(docRef, {
        'homework.isCompleted': nextStatus,
        'homework.status': nextStatus ? 'Completed' : 'Pending',
        'homework.completedAt': nextStatus ? new Date().toISOString() : null
      });
      showToast(nextStatus ? 'Homework marked as completed!' : 'Homework re-opened as pending.');
    } catch (err) {
      console.error(err);
      showToast('Failed to update status.', 'error');
    }
  };

  // Delete Action
  const handleExecuteDelete = async () => {
    if (!user || !deleteModal.id) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'diaryEntries', deleteModal.id);
      await deleteDoc(docRef);
      showToast('Lecture entry and files deleted.');
      setDeleteModal({ open: false, id: '', title: '' });
    } catch (err) {
      console.error(err);
      showToast('Failed to delete entry.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Soft Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
          toast.type === 'error' 
            ? 'bg-rose-950/90 border-rose-700/80 text-rose-200' 
            : 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" /> : <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Header & Prominent Branding */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-600/25 shrink-0">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  My College Diary
                </h1>
                {/* CLEAN AUTHOR BADGE WITHOUT AI/SPARKLE LOGO */}
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-indigo-950/80 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold shadow-sm">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Created by Sachin Kumar</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Class notes, whiteboard photos &amp; homework organizer</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/60 rounded-full py-1.5 px-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                  {user.email ? user.email.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                </div>
                <div className="hidden md:block text-left pr-1">
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                    {user.email || 'Guest Student'}
                  </p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ID: {user.uid.slice(0, 8)}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-full transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthMode('signin')}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl shadow-md transition"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between border-t border-slate-800/60 py-2.5 overflow-x-auto">
            <nav className="flex space-x-1 sm:space-x-2 shrink-0">
              <button
                onClick={() => setActiveTab('feed')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'feed'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <BookMarked className="w-4 h-4" />
                <span>Class Diary</span>
                <span className="bg-slate-800 text-slate-300 text-[11px] px-1.5 py-0.5 rounded-md border border-slate-700 font-mono">
                  {diaryEntries.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('homework-hub')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'homework-hub'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Homework &amp; Tasks</span>
                {stats.hwPending > 0 && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] px-2 py-0.2 rounded-full font-bold">
                    {stats.hwPending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('gallery')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-2 ${
                  activeTab === 'gallery'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Snaps &amp; Documents</span>
                <span className="bg-slate-800 text-slate-300 text-[11px] px-1.5 py-0.5 rounded-md border border-slate-700 font-mono">
                  {stats.totalAttachments}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`hidden md:flex px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition items-center gap-2 ${
                  activeTab === 'ledger'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Semester Overview</span>
              </button>
            </nav>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <button
                onClick={() => window.print()}
                className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={handleOpenAddModal}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs sm:text-sm font-semibold px-3.5 py-1.5 rounded-xl shadow-lg shadow-indigo-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Log Class &amp; Media</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!user ? (
          /* Authentication Screen */
          <div className="max-w-md mx-auto my-10 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            {/* Ambient Background glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="text-center mb-6 relative">
              <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30 text-white">
                <GraduationCap className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {authMode === 'signin' ? 'Sign In to Your Diary' : 'Create Student Diary'}
              </h2>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-amber-300 font-semibold">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Created by Sachin Kumar</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Securely store lecture notes, whiteboard snapshots, PDFs, and track homework tasks.
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 transition"
              >
                {authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              {authMode === 'signin' ? (
                <span>No account yet?{' '}
                  <button onClick={() => setAuthMode('signup')} className="text-indigo-400 hover:underline font-semibold">
                    Register
                  </button>
                </span>
              ) : (
                <span>Already registered?{' '}
                  <button onClick={() => setAuthMode('signin')} className="text-indigo-400 hover:underline font-semibold">
                    Sign In
                  </button>
                </span>
              )}
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-3 text-slate-500">or instant demo</span>
              </div>
            </div>

            <button
              onClick={handleGuestLogin}
              type="button"
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Continue as Guest Student</span>
            </button>
          </div>
        ) : (
          /* Dashboard Content */
          <div className="space-y-6">
            {/* Top Welcome / Creator Banner */}
            <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/40 border border-indigo-500/20 rounded-3xl p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-white">Student Academic Workspace</h2>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                      Cloud Sync Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Designed and built with passion by <strong className="text-amber-300 font-semibold">Sachin Kumar</strong> for everyday college workflow.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Homework Completion</span>
                  <span className="text-sm font-bold text-emerald-400">{stats.completionRate}% Done</span>
                </div>
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Class Note</span>
                </button>
              </div>
            </div>

            {/* Quick Statistics Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Lectures</span>
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{stats.totalClasses}</span>
                  <span className="text-xs text-slate-400">classes</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Homework</span>
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-amber-300">{stats.hwPending}</span>
                  <span className="text-xs text-slate-400">tasks to do</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completed Tasks</span>
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300">{stats.hwCompleted}</span>
                  <span className="text-xs text-slate-400">finished</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uploaded Snaps &amp; Files</span>
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Paperclip className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-extrabold text-purple-300">{stats.totalAttachments}</span>
                  <span className="text-xs text-slate-400">files saved</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-md flex flex-col md:flex-row items-center justify-between gap-3 print:hidden">
              <div className="w-full md:w-auto flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                {/* Search */}
                <div className="relative w-full sm:w-60">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search topics, faculty, homework..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Subject Selector */}
                <div className="w-full sm:w-auto">
                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Subjects</option>
                    {availableSubjects.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Session Type Filter */}
                <div className="w-full sm:w-auto">
                  <select
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">All Session Types</option>
                    {SESSION_TYPES.map((st, idx) => (
                      <option key={idx} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                {/* Feed Tab Filters */}
                {activeTab === 'feed' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterOnlyWithHw}
                        onChange={(e) => setFilterOnlyWithHw(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>With Homework</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterOnlyWithFiles}
                        onChange={(e) => setFilterOnlyWithFiles(e.target.checked)}
                        className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                      />
                      <span>With Snaps/Files</span>
                    </label>

                    {/* View Switcher */}
                    <div className="hidden sm:flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
                      <button
                        onClick={() => setFeedViewMode('cards')}
                        className={`p-1.5 rounded-lg ${feedViewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Cards View"
                      >
                        <Grid className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setFeedViewMode('table')}
                        className={`p-1.5 rounded-lg ${feedViewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Table View"
                      >
                        <List className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Homework Filters */}
                {activeTab === 'homework-hub' && (
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
                    {[
                      { key: 'ALL', label: 'All' },
                      { key: 'PENDING', label: 'Pending' },
                      { key: 'OVERDUE', label: 'Overdue' },
                      { key: 'COMPLETED', label: 'Completed' }
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        onClick={() => setHomeworkStatusFilter(btn.key)}
                        className={`px-2.5 py-1 rounded-lg font-medium transition whitespace-nowrap ${
                          homeworkStatusFilter === btn.key
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleOpenAddModal}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl shadow-md transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Class Entry</span>
              </button>
            </div>

            {/* TAB 1: INTEGRATED CLASS DIARY */}
            {activeTab === 'feed' && (
              <div className="space-y-4">
                {dataLoading ? (
                  <div className="py-20 text-center text-slate-400 text-sm">Loading college diary...</div>
                ) : filteredEntries.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                    <BookMarked className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-1" />
                    <h3 className="text-lg font-semibold text-slate-200">No Lecture Entries Found</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      {searchQuery || subjectFilter !== 'ALL' || sessionFilter !== 'ALL' || filterOnlyWithHw || filterOnlyWithFiles
                        ? 'No class logs match your filters. Try clearing your search parameters.'
                        : 'Start logging what was taught in class today, upload whiteboard photos, and attach your homework tasks.'}
                    </p>
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition shadow-lg"
                    >
                      Log First Lecture
                    </button>
                  </div>
                ) : feedViewMode === 'cards' ? (
                  /* Cards Grid */
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filteredEntries.map((entry) => {
                      const today = new Date().toISOString().split('T')[0];
                      const hasHw = entry.hasHomework && entry.homework;
                      const isHwOverdue = hasHw && !entry.homework.isCompleted && entry.homework.dueDate && entry.homework.dueDate < today;

                      return (
                        <div
                          key={entry.id}
                          className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
                        >
                          <div>
                            {/* Card Header with Session Type Badge */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                                  {entry.subject}
                                </span>
                                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                                  {entry.sessionType || 'Lecture'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                {entry.roomTime && (
                                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                    <MapPin className="w-3 h-3 text-slate-500" />
                                    {entry.roomTime}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                                  <Calendar className="w-3 h-3 text-slate-500" />
                                  {entry.date}
                                </span>
                              </div>
                            </div>

                            {/* Topic & Faculty */}
                            <h3 className="text-base font-bold text-white tracking-tight mt-1.5">
                              {entry.topic}
                            </h3>
                            {entry.professor && (
                              <p className="text-xs text-slate-400 mt-0.5">
                                Faculty: <span className="text-slate-300 font-medium">{entry.professor}</span>
                              </p>
                            )}

                            {/* Class Notes */}
                            {entry.notes && (
                              <div className="mt-3 text-xs text-slate-300 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed whitespace-pre-wrap font-sans">
                                <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
                                  <FileText className="w-3 h-3 text-indigo-400" /> Class Lecture Notes:
                                </p>
                                {entry.notes}
                              </div>
                            )}

                            {/* Key formulas / takeaways */}
                            {entry.keyTakeaways && (
                              <div className="mt-2 text-xs text-emerald-300/90 bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-800/30">
                                <span className="font-semibold text-[10px] uppercase tracking-wider text-emerald-400 block mb-0.5">
                                  Key Formulas / Takeaway:
                                </span>
                                {entry.keyTakeaways}
                              </div>
                            )}

                            {/* CLASS NOTE PHOTO / FILE ATTACHMENTS STRIP */}
                            {entry.noteAttachments && entry.noteAttachments.length > 0 && (
                              <div className="mt-3 bg-slate-950/40 border border-slate-800/80 rounded-xl p-2.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Paperclip className="w-3 h-3 text-indigo-400" /> Whiteboard Snaps &amp; Documents ({entry.noteAttachments.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {entry.noteAttachments.map((file) => (
                                    <div
                                      key={file.id}
                                      onClick={() => setPreviewFile(file)}
                                      className="group relative cursor-pointer flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-indigo-500/50 p-1.5 rounded-lg transition"
                                      title={`View ${file.name}`}
                                    >
                                      {file.isImage ? (
                                        <div className="w-10 h-10 rounded overflow-hidden bg-slate-950 shrink-0 relative">
                                          <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded bg-slate-950 flex items-center justify-center text-indigo-400 shrink-0">
                                          <FileText className="w-5 h-5" />
                                        </div>
                                      )}
                                      <div className="max-w-[120px] pr-1">
                                        <p className="text-[11px] font-medium text-slate-200 truncate">{file.name}</p>
                                        <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* EMBEDDED HOMEWORK SECTION */}
                            {hasHw ? (
                              <div className={`mt-3.5 rounded-xl border p-3.5 transition ${
                                entry.homework.isCompleted
                                  ? 'bg-slate-950/40 border-slate-800 text-slate-400'
                                  : isHwOverdue
                                  ? 'bg-rose-950/20 border-rose-800/50 text-slate-200'
                                  : 'bg-indigo-950/20 border-indigo-800/40 text-slate-200'
                              }`}>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                                      <CheckSquare className="w-3 h-3" /> Assigned Homework
                                    </span>
                                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                      entry.homework.priority === 'High'
                                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                        : entry.homework.priority === 'Medium'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    }`}>
                                      {entry.homework.priority} Priority
                                    </span>
                                  </div>

                                  <div className={`text-xs flex items-center gap-1 font-mono ${
                                    isHwOverdue ? 'text-rose-400 font-bold' : 'text-slate-400'
                                  }`}>
                                    <Clock4 className="w-3 h-3" />
                                    <span>Due: {entry.homework.dueDate}</span>
                                  </div>
                                </div>

                                <div className="flex items-start gap-3 mt-2">
                                  {/* Direct card checkbox */}
                                  <button
                                    onClick={() => handleToggleHomeworkStatus(entry.id, entry.homework)}
                                    title={entry.homework.isCompleted ? 'Mark Pending' : 'Mark Completed'}
                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                      entry.homework.isCompleted
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-slate-600 hover:border-emerald-400 bg-slate-900'
                                    }`}
                                  >
                                    {entry.homework.isCompleted && <Check className="w-3.5 h-3.5" />}
                                  </button>

                                  <div className="flex-1">
                                    <p className={`text-sm font-semibold ${
                                      entry.homework.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'
                                    }`}>
                                      {entry.homework.title}
                                    </p>
                                    {entry.homework.description && (
                                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                        {entry.homework.description}
                                      </p>
                                    )}

                                    {/* Homework Attached Files */}
                                    {entry.homework.attachments && entry.homework.attachments.length > 0 && (
                                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                                        {entry.homework.attachments.map((f) => (
                                          <button
                                            key={f.id}
                                            onClick={() => setPreviewFile(f)}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-850 text-indigo-300 border border-slate-800 text-[11px]"
                                          >
                                            {f.isImage ? <ImageIcon className="w-3 h-3" /> : <File className="w-3 h-3" />}
                                            <span className="truncate max-w-[110px]">{f.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 py-2 px-3 rounded-xl bg-slate-950/30 border border-slate-800/40 text-[11px] text-slate-500 flex items-center justify-between">
                                <span>No homework assigned for this class</span>
                                <button
                                  onClick={() => handleOpenEditModal(entry)}
                                  className="text-indigo-400 hover:underline font-medium"
                                >
                                  + Attach Homework
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500 font-mono">
                              Entry #{entry.id.slice(0, 6)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleOpenEditModal(entry)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => setDeleteModal({ open: true, id: entry.id, title: `${entry.subject} - ${entry.topic}` })}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Table View */
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Session</th>
                            <th className="px-4 py-3">Subject &amp; Topic</th>
                            <th className="px-4 py-3">Faculty</th>
                            <th className="px-4 py-3">Attachments</th>
                            <th className="px-4 py-3">Homework Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredEntries.map((entry) => {
                            const attCount = (entry.noteAttachments?.length || 0) + (entry.homework?.attachments?.length || 0);
                            return (
                              <tr key={entry.id} className="hover:bg-slate-850/50 transition">
                                <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">{entry.date}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-xs">
                                    {entry.sessionType || 'Lecture'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-100">{entry.topic}</p>
                                  <span className="text-[11px] text-indigo-400 font-medium">{entry.subject}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-400">{entry.professor || '—'}</td>
                                <td className="px-4 py-3">
                                  {attCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-mono">
                                      <Paperclip className="w-3 h-3" /> {attCount}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {entry.hasHomework && entry.homework ? (
                                    <button
                                      onClick={() => handleToggleHomeworkStatus(entry.id, entry.homework)}
                                      className={`px-2 py-0.5 rounded-md text-xs font-medium border flex items-center gap-1.5 ${
                                        entry.homework.isCompleted
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                      }`}
                                    >
                                      {entry.homework.isCompleted ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                      <span>{entry.homework.isCompleted ? 'Completed' : 'Pending'}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-600 text-xs">None</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenEditModal(entry)}
                                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteModal({ open: true, id: entry.id, title: entry.topic })}
                                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: CONSOLIDATED HOMEWORK TRACKER */}
            {activeTab === 'homework-hub' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <CheckSquare className="w-6 h-6 text-indigo-400" />
                      Consolidated Homework &amp; Deadlines
                    </h2>
                    <p className="text-xs text-slate-400">
                      Aggregated list of all assignments and deliverables across every course.
                    </p>
                  </div>
                </div>

                {consolidatedHomeworks.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-1" />
                    <h3 className="text-lg font-semibold text-slate-200">No Homework Found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      No assignments match your selected status filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {consolidatedHomeworks.map((task) => (
                      <div
                        key={task.entryId}
                        className={`p-4 rounded-2xl border transition shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          task.isCompleted
                            ? 'bg-slate-900/40 border-slate-800/40 opacity-75'
                            : task.isOverdue
                            ? 'bg-rose-950/20 border-rose-800/60'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <button
                            onClick={() => handleToggleHomeworkStatus(task.entryId, task)}
                            className={`mt-1 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                              task.isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-600 hover:border-emerald-400 bg-slate-950'
                            }`}
                          >
                            {task.isCompleted && <Check className="w-3.5 h-3.5" />}
                          </button>

                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                                {task.subject}
                              </span>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {task.sessionType}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                                task.priority === 'High'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  : task.priority === 'Medium'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}>
                                {task.priority} Priority
                              </span>
                              {task.isOverdue && (
                                <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded">
                                  OVERDUE
                                </span>
                              )}
                              {task.isDueToday && (
                                <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded">
                                  DUE TODAY
                                </span>
                              )}
                            </div>

                            <h4 className={`text-sm sm:text-base font-semibold ${task.isCompleted ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                              {task.title}
                            </h4>

                            {task.description && (
                              <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Task file attachments */}
                            {task.attachments && task.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {task.attachments.map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => setPreviewFile(f)}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950 text-indigo-300 border border-slate-800 text-[11px] hover:border-indigo-500 transition"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span>{f.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                              <span>Lecture: <strong className="text-slate-400">{task.classTopic}</strong></span>
                              <span>&bull;</span>
                              <span>Class Date: {task.classDate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Due Date</span>
                            <span className={`text-xs font-mono font-semibold ${task.isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                              {task.dueDate}
                            </span>
                          </div>

                          <button
                            onClick={() => handleToggleHomeworkStatus(task.entryId, task)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                              task.isCompleted
                                ? 'bg-slate-800 text-slate-300 border-slate-700'
                                : 'bg-emerald-600/20 text-emerald-300 border-emerald-600/30'
                            }`}
                          >
                            {task.isCompleted ? 'Mark Pending' : 'Mark Done'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ATTACHMENTS GALLERY */}
            {activeTab === 'gallery' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <ImageIcon className="w-6 h-6 text-purple-400" />
                      Class Notes &amp; Homework Snaps Gallery
                    </h2>
                    <p className="text-xs text-slate-400">
                      Visual repository for whiteboard pictures, handwritten notes, and PDF handouts.
                    </p>
                  </div>
                </div>

                {allAttachments.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-600 stroke-1" />
                    <h3 className="text-lg font-semibold text-slate-200">No Attachments Uploaded Yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Upload whiteboard snapshots or PDF assignments when logging or editing any class entry.
                    </p>
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl transition"
                    >
                      Add Entry with Files
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {allAttachments.map((att) => (
                      <div
                        key={att.id}
                        onClick={() => setPreviewFile(att)}
                        className="group bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-2xl overflow-hidden shadow cursor-pointer transition flex flex-col justify-between"
                      >
                        <div className="aspect-square bg-slate-950 relative overflow-hidden flex items-center justify-center">
                          {att.isImage ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="p-4 text-center">
                              <FileText className="w-12 h-12 text-indigo-400 mx-auto mb-1" />
                              <span className="text-[10px] text-slate-500 uppercase font-mono">Document</span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition backdrop-blur-[2px]">
                            <span className="p-2 rounded-full bg-indigo-600 text-white shadow-lg">
                              <Eye className="w-4 h-4" />
                            </span>
                          </div>

                          <span className={`absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow ${
                            att.sourceType === 'Class Notes' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {att.sourceType}
                          </span>
                        </div>

                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-slate-200 truncate">{att.name}</p>
                          <p className="text-[11px] text-indigo-400 truncate mt-0.5">{att.subject}</p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>{formatFileSize(att.size)}</span>
                            <span>{att.classDate}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: SEMESTER OVERVIEW / LEDGER */}
            {activeTab === 'ledger' && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-2">Subject Performance &amp; Ledger</h3>
                <p className="text-xs text-slate-400 mb-6">
                  Overview of course attendance, attached files, and assignment completion percentages.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Subject / Course</th>
                        <th className="px-4 py-3">Lectures</th>
                        <th className="px-4 py-3">Files / Snaps</th>
                        <th className="px-4 py-3">HW Given</th>
                        <th className="px-4 py-3">HW Completed</th>
                        <th className="px-4 py-3">Completion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {availableSubjects.map((sub, idx) => {
                        const subEntries = diaryEntries.filter(e => e.subject?.toLowerCase() === sub.toLowerCase());
                        if (subEntries.length === 0) return null;
                        
                        let filesCount = 0;
                        let hwCount = 0;
                        let hwDone = 0;

                        subEntries.forEach(e => {
                          filesCount += (e.noteAttachments?.length || 0);
                          if (e.hasHomework && e.homework) {
                            filesCount += (e.homework.attachments?.length || 0);
                            hwCount++;
                            if (e.homework.isCompleted) hwDone++;
                          }
                        });

                        const rate = hwCount > 0 ? Math.round((hwDone / hwCount) * 100) : 100;

                        return (
                          <tr key={idx} className="hover:bg-slate-800/40 transition">
                            <td className="px-4 py-3 font-semibold text-indigo-400">{sub}</td>
                            <td className="px-4 py-3 font-mono text-slate-200">{subEntries.length}</td>
                            <td className="px-4 py-3 font-mono text-purple-300">{filesCount}</td>
                            <td className="px-4 py-3 font-mono text-slate-200">{hwCount}</td>
                            <td className="px-4 py-3 font-mono text-emerald-400">{hwDone}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${rate}%` }}></div>
                                </div>
                                <span className="text-xs font-mono">{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- MODAL: Add / Edit Integrated Class Diary & Homework & Attachments --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <BookMarked className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    {editingEntryId ? 'Edit Class, Homework & Media' : 'Log Daily College Class'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Class notes, whiteboard photos &amp; homework assignment</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* SECTION 1: LECTURE DETAILS */}
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Part 1: Lecture Details &amp; Class Notes
                  </h4>
                  <span className="text-[10px] text-slate-500">My College Diary &bull; Sachin Kumar</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.date}
                      onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Session Type
                    </label>
                    <select
                      value={formState.sessionType}
                      onChange={(e) => setFormState({ ...formState, sessionType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {SESSION_TYPES.map((st, i) => (
                        <option key={i} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Subject / Course *
                    </label>
                    <input
                      type="text"
                      required
                      list="subjects-list-modal"
                      placeholder="e.g. Operating Systems"
                      value={formState.subject}
                      onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                    <datalist id="subjects-list-modal">
                      {availableSubjects.map((s, i) => (
                        <option key={i} value={s} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Faculty / Professor
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. John Von Neumann"
                      value={formState.professor}
                      onChange={(e) => setFormState({ ...formState, professor: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Period / Time / Room
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Period 2 (11:00 AM) - Lab 4"
                      value={formState.roomTime}
                      onChange={(e) => setFormState({ ...formState, roomTime: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Topic Taught in Class *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deadlock Detection & Banker's Algorithm"
                    value={formState.topic}
                    onChange={(e) => setFormState({ ...formState, topic: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Class Notes &amp; Summary
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Summarize key points, theory, definitions explained by the lecturer..."
                    value={formState.notes}
                    onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Key Formulas / Important Takeaways (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Safe state condition: Need <= Available"
                    value={formState.keyTakeaways}
                    onChange={(e) => setFormState({ ...formState, keyTakeaways: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* FILE & PHOTO UPLOAD AREA (For Class Notes) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-purple-400" />
                        Class Notes Attachments (Photos &amp; Documents)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Upload whiteboard photos, lecture slides, or handwritten notes.
                      </p>
                    </div>

                    <input
                      type="file"
                      ref={noteFileInputRef}
                      multiple
                      accept="image/*,application/pdf,text/plain"
                      onChange={(e) => handleFileUpload(e.target.files, 'notes')}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingTarget === 'notes'}
                      onClick={() => noteFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'notes' ? 'Processing...' : 'Upload Files'}</span>
                    </button>
                  </div>

                  {formState.noteAttachments.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                      {formState.noteAttachments.map((f) => (
                        <div key={f.id} className="relative group bg-slate-900 border border-slate-800 rounded-xl p-2 flex items-center gap-2">
                          {f.isImage ? (
                            <img src={f.dataUrl} alt={f.name} className="w-9 h-9 object-cover rounded" />
                          ) : (
                            <FileText className="w-9 h-9 p-1 bg-slate-950 text-indigo-400 rounded" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-slate-200 truncate">{f.name}</p>
                            <p className="text-[10px] text-slate-500">{formatFileSize(f.size)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(f.id, 'notes')}
                            className="p-1 text-slate-500 hover:text-rose-400"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: EMBEDDED HOMEWORK & ASSIGNMENTS */}
              <div className="pt-2 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between bg-indigo-950/30 p-3.5 rounded-2xl border border-indigo-800/40">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                      Class Homework &amp; Assignments
                    </h4>
                    <p className="text-xs text-slate-400">Did the professor assign homework, questions, or project tasks?</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formState.hasHomework}
                      onChange={(e) => setFormState({ ...formState, hasHomework: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formState.hasHomework && (
                  <div className="bg-slate-950/60 border border-indigo-800/30 p-4 rounded-2xl space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-1">
                        Homework Title / Task *
                      </label>
                      <input
                        type="text"
                        required={formState.hasHomework}
                        placeholder="e.g. Solve questions 3.1 to 3.7 & prepare lab report"
                        value={formState.homework.title}
                        onChange={(e) => setFormState({
                          ...formState,
                          homework: { ...formState.homework, title: e.target.value }
                        })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                          Submission Deadline (Due Date) *
                        </label>
                        <input
                          type="date"
                          required={formState.hasHomework}
                          value={formState.homework.dueDate}
                          onChange={(e) => setFormState({
                            ...formState,
                            homework: { ...formState.homework, dueDate: e.target.value }
                          })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                          Task Priority
                        </label>
                        <select
                          value={formState.homework.priority}
                          onChange={(e) => setFormState({
                            ...formState,
                            homework: { ...formState.homework, priority: e.target.value }
                          })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="High">High (Urgent)</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                        Task Instructions / Problem Details
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Write down specific questions, page numbers, or guidelines given..."
                        value={formState.homework.description}
                        onChange={(e) => setFormState({
                          ...formState,
                          homework: { ...formState.homework, description: e.target.value }
                        })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Dedicated Homework Attachment Uploader */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" /> Homework Question Paper / Reference Files
                          </p>
                          <p className="text-[10px] text-slate-500">Attach photo of question sheet or syllabus assignment PDF.</p>
                        </div>
                        <input
                          type="file"
                          ref={hwFileInputRef}
                          multiple
                          accept="image/*,application/pdf,text/plain"
                          onChange={(e) => handleFileUpload(e.target.files, 'homework')}
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={uploadingTarget === 'homework'}
                          onClick={() => hwFileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>Attach Files</span>
                        </button>
                      </div>

                      {formState.homework.attachments && formState.homework.attachments.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                          {formState.homework.attachments.map((f) => (
                            <div key={f.id} className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex items-center gap-2">
                              {f.isImage ? (
                                <img src={f.dataUrl} alt={f.name} className="w-7 h-7 object-cover rounded" />
                              ) : (
                                <FileText className="w-7 h-7 text-indigo-400" />
                              )}
                              <span className="text-[11px] text-slate-200 truncate flex-1">{f.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveAttachment(f.id, 'homework')}
                                className="text-slate-500 hover:text-rose-400 p-1"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2.5 text-xs text-slate-300 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.homework.isCompleted}
                        onChange={(e) => setFormState({
                          ...formState,
                          homework: { 
                            ...formState.homework, 
                            isCompleted: e.target.checked,
                            status: e.target.checked ? 'Completed' : 'Pending',
                            completedAt: e.target.checked ? new Date().toISOString() : null
                          }
                        })}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-0 w-4 h-4"
                      />
                      <span>Mark as already completed / submitted</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition"
                >
                  {editingEntryId ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- IMAGE LIGHTBOX & DOCUMENT PREVIEW MODAL --- */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2 truncate pr-2">
                {previewFile.isImage ? <ImageIcon className="w-4 h-4 text-purple-400" /> : <FileText className="w-4 h-4 text-indigo-400" />}
                <span className="text-sm font-semibold text-slate-200 truncate">{previewFile.name}</span>
                <span className="text-xs text-slate-500 font-mono">({formatFileSize(previewFile.size)})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewFile.dataUrl}
                  download={previewFile.name}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950">
              {previewFile.isImage ? (
                <img
                  src={previewFile.dataUrl}
                  alt={previewFile.name}
                  className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-lg"
                />
              ) : previewFile.type === 'application/pdf' ? (
                <div className="text-center p-8 space-y-4">
                  <FileText className="w-16 h-16 text-indigo-400 mx-auto" />
                  <p className="text-sm text-slate-300">PDF Document Ready: <strong>{previewFile.name}</strong></p>
                  <a
                    href={previewFile.dataUrl}
                    download={previewFile.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download &amp; Open PDF</span>
                  </a>
                </div>
              ) : (
                <div className="text-center p-8 space-y-4">
                  <File className="w-16 h-16 text-indigo-400 mx-auto" />
                  <p className="text-sm text-slate-300">{previewFile.name}</p>
                  <a
                    href={previewFile.dataUrl}
                    download={previewFile.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL: Custom In-App Delete (No window.alert/confirm) --- */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Delete Class Entry?</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-200">"{deleteModal.title}"</span>? All notes, attached photos, and homework tasks will be permanently removed.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, id: '', title: '' })}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Sheet View */}
      <div className="hidden print:block p-8 bg-white text-black font-sans">
        <div className="border-b pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">My College Diary - Academic Records</h1>
            <p className="text-xs text-gray-700 font-semibold mt-0.5">Created by Sachin Kumar</p>
          </div>
          <p className="text-xs text-gray-500 text-right">Printed on {new Date().toLocaleDateString()}<br/>Student UID: {user?.uid}</p>
        </div>
        <div className="space-y-6">
          {diaryEntries.map((e) => (
            <div key={e.id} className="border-b pb-4">
              <div className="flex justify-between font-bold text-base">
                <span>[{e.sessionType || 'Lecture'}] {e.subject} — {e.topic}</span>
                <span>{e.date}</span>
              </div>
              <p className="text-xs text-gray-600">Faculty: {e.professor || 'N/A'} | Room: {e.roomTime || 'N/A'}</p>
              {e.notes && <p className="text-sm mt-2"><strong>Notes:</strong> {e.notes}</p>}
              {e.keyTakeaways && <p className="text-xs text-gray-700 mt-1"><strong>Key Formulas:</strong> {e.keyTakeaways}</p>}
              {e.noteAttachments && e.noteAttachments.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Attachments: {e.noteAttachments.map(f => f.name).join(', ')}</p>
              )}
              {e.hasHomework && e.homework && (
                <div className="mt-2 text-sm bg-gray-100 p-2 rounded">
                  <strong>Homework:</strong> {e.homework.title} (Due: {e.homework.dueDate}) — Status: {e.homework.isCompleted ? 'Completed' : 'Pending'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer with Creator Credit */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-5 text-center text-xs text-slate-400 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">My College Diary</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-slate-400">Class notes, whiteboard photos &amp; homework tracker</span>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-pulse" />
            <span>by</span>
            <span className="font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              Sachin Kumar
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}