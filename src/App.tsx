import React, { useState, useEffect, useRef } from 'react';
import EvidencePage from './components/EvidencePage';
import { Chatbot } from './components/Chatbot';
import { GoogleGenAI, Type } from "@google/genai";
import { Network, Upload, Search, Activity, Clock, Shield, AlertTriangle, CheckCircle2, FileText, Users, MapPin, Building2, Link2, ChevronLeft, ChevronRight, MessageSquare, Github, Download, RefreshCw, History, X, Trash2, LogIn, LogOut } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import ForceGraph2D from 'react-force-graph-2d';
import { db, auth } from './firebase';
import { 
  collection, doc, getDocs, addDoc, updateDoc, onSnapshot, 
  query, orderBy, setDoc, getDocFromServer, deleteDoc
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---
type Entity = { id: string; name: string; type: string; status: string };
type Relationship = { source: string; target: string; type: string };
type GraphData = { nodes: Entity[]; links: Relationship[] };

let globalNextAnonId = 1;

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [verifiedHandle, setVerifiedHandle] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [investigations, setInvestigations] = useState<any[]>([]);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.email === 'amd949609@gmail.com' && currentUser.emailVerified) {
          setIsAdmin(true);
        } else {
          try {
            const userDoc = await getDocFromServer(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (e) {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const fetchInvestigations = async () => {
    try {
      const q = query(collection(db, 'investigations'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvestigations(data);
      if (data.length > 0 && !selectedInvestigationId) {
        setSelectedInvestigationId(data[0].id);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'investigations');
    }
  };

  useEffect(() => {
    // Test Firestore Connection
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    // Set up real-time listener for investigations
    const q = query(collection(db, 'investigations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvestigations(data);
      if (data.length > 0 && !selectedInvestigationId) {
        setSelectedInvestigationId(data[0].id);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'investigations');
    });

    return () => unsubscribe();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('osint_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('osint_search_history', JSON.stringify(newHistory));
    setSearchQuery(query);
    setIsSearchFocused(false);
  };

  const removeHistoryItem = (e: React.MouseEvent, queryToRemove: string) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(q => q !== queryToRemove);
    setSearchHistory(newHistory);
    localStorage.setItem('osint_search_history', JSON.stringify(newHistory));
  };

  const handleSyncToGitHub = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-github', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert('Successfully synced to GitHub!');
      } else {
        alert('Sync failed: ' + (data.error || 'Unknown error') + '\n\nMake sure you have added your GITHUB_TOKEN to the AI Studio Secrets menu.');
      }
    } catch (error) {
      alert('Network error while syncing.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost')) return;
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const user = event.data.user;
        setVerifiedHandle(user.login);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGitHubConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(`/api/auth/url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (!response.ok) {
        alert('GitHub OAuth is not configured. Please set CLIENT_ID and CLIENT_SECRET in the AI Studio Secrets panel.');
        return;
      }
      const { url } = await response.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-100 text-neutral-900 font-sans">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-neutral-900 text-neutral-300 flex flex-col relative`}>
        <div className={`p-6 flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} text-white border-b border-neutral-800`}>
          <Network className="w-6 h-6 text-blue-500 shrink-0" />
          {isSidebarOpen && <h1 className="font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden">OSINTNeoAiX</h1>}
        </div>
        
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 bg-neutral-800 text-white rounded-full p-1 border border-neutral-700 hover:bg-neutral-700 z-20"
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
          <SidebarItem icon={<Activity />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<FileText />} label="Evidence Report" active={activeTab === 'evidence'} onClick={() => setActiveTab('evidence')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<Network />} label="Entity Graph" active={activeTab === 'graph'} onClick={() => setActiveTab('graph')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<Upload />} label="Evidence Upload" active={activeTab === 'upload'} onClick={() => setActiveTab('upload')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<Search />} label="Search Monitor" active={activeTab === 'search'} onClick={() => setActiveTab('search')} isOpen={isSidebarOpen} />
          <SidebarItem icon={<MessageSquare />} label="Public Comments" active={activeTab === 'comments'} onClick={() => setActiveTab('comments')} isOpen={isSidebarOpen} />
        </nav>
        
        <div className={`p-4 border-t border-neutral-800 text-xs text-neutral-500 ${isSidebarOpen ? '' : 'text-center'}`}>
          {isSidebarOpen ? (
            <div className="space-y-3">
              <div>
                <p>System Status: <span className="text-green-500">Online</span></p>
                <p>Nodes: 1,243 | Edges: 4,892</p>
              </div>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors bg-neutral-800/50 p-2 rounded-md border border-neutral-700/50 hover:border-neutral-600">
                <Github className="w-4 h-4 shrink-0" />
                <span className="font-medium truncate">OSINTNeoAiX/core</span>
              </a>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-green-500" title="System Online"></div>
              <a href="https://github.com" target="_blank" rel="noreferrer" title="GitHub Repository" className="text-neutral-400 hover:text-white transition-colors">
                <Github className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-neutral-50">
        <header className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-neutral-800 capitalize">{activeTab.replace('-', ' ')}</h2>
            {investigations.length > 0 && (
              <select 
                className="ml-4 bg-neutral-100 border border-neutral-200 text-neutral-800 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedInvestigationId || ''}
                onChange={(e) => setSelectedInvestigationId(e.target.value)}
              >
                <option value="" disabled>Select Investigation...</option>
                {investigations.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={handleSyncToGitHub}
              disabled={isSyncing}
              className="flex items-center gap-2 text-sm text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-full border border-neutral-200 hover:bg-neutral-200 transition-colors shrink-0 disabled:opacity-50" 
              title="Sync to GitHub"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="font-medium hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync to GitHub'}</span>
            </button>
            <a href="/api/download-zip" className="flex items-center gap-2 text-sm text-blue-700 bg-blue-100 px-3 py-1.5 rounded-full border border-blue-200 hover:bg-blue-200 transition-colors shrink-0" title="Download Source Code">
              <Download className="w-4 h-4" />
              <span className="font-medium hidden sm:inline">Download Code</span>
            </a>
            <div className="relative hidden md:block" ref={searchContainerRef}>
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <Input 
                className="pl-9 w-64 bg-neutral-100 border-transparent focus:bg-white focus:border-neutral-300 transition-colors" 
                placeholder="Global search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(searchQuery);
                  }
                }}
              />
              
              {isSearchFocused && searchHistory.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-md shadow-lg overflow-hidden z-50">
                  <div className="px-3 py-2 text-xs font-semibold text-neutral-500 bg-neutral-50 border-b border-neutral-100 flex justify-between items-center">
                    <span>Recent Searches</span>
                    <button 
                      onClick={() => {
                        setSearchHistory([]);
                        localStorage.removeItem('osint_search_history');
                      }}
                      className="hover:text-neutral-800 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <ul className="max-h-64 overflow-y-auto">
                    {searchHistory.map((query, idx) => (
                      <li key={idx} className="group flex items-center justify-between px-3 py-2 hover:bg-neutral-50 cursor-pointer border-b border-neutral-50 last:border-0" onClick={() => handleSearchSubmit(query)}>
                        <div className="flex items-center gap-2 text-sm text-neutral-700">
                          <History className="w-3.5 h-3.5 text-neutral-400" />
                          <span className="truncate max-w-[180px]">{query}</span>
                        </div>
                        <button 
                          onClick={(e) => removeHistoryItem(e, query)}
                          className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from history"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {verifiedHandle ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-full border border-green-200">
                <Github className="w-4 h-4" />
                <span className="font-medium">{verifiedHandle}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-100 px-3 py-1.5 rounded-full cursor-pointer hover:bg-neutral-200 transition-colors" onClick={handleGitHubConnect} title="Verify handle with GitHub">
                <Users className="w-4 h-4" />
                <span>Public Access</span>
              </div>
            )}
            
            {user ? (
              <div className="flex items-center gap-2">
                {isAdmin && <Badge variant="default" className="bg-purple-600">Admin</Badge>}
                <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleLogin} className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Admin Login
              </Button>
            )}
          </div>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && <HomeView setActiveTab={setActiveTab} investigations={investigations} selectedInvestigationId={selectedInvestigationId} setSelectedInvestigationId={setSelectedInvestigationId} isAdmin={isAdmin} />}
          {activeTab === 'evidence' && <EvidencePage />}
          {activeTab === 'investigation-detail' && <InvestigationDetailView investigationId={selectedInvestigationId} setActiveTab={setActiveTab} />}
          {activeTab === 'upload' && <UploadView verifiedHandle={verifiedHandle} selectedInvestigationId={selectedInvestigationId} isAdmin={isAdmin} />}
          {activeTab === 'search' && <SearchView />}
          {activeTab === 'comments' && <CommentsView verifiedHandle={verifiedHandle} selectedInvestigationId={selectedInvestigationId} isAdmin={isAdmin} />}
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, isOpen }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, isOpen: boolean }) {
  return (
    <button
      onClick={onClick}
      title={!isOpen ? label : undefined}
      className={`w-full flex items-center ${isOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-md transition-colors text-sm font-medium ${
        active ? 'bg-blue-600 text-white' : 'hover:bg-neutral-800 hover:text-white'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5 shrink-0' })}
      {isOpen && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
    </button>
  );
}

// --- Views ---

function InvestigationDetailView({ investigationId, setActiveTab }: { investigationId: string, setActiveTab: any }) {
  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center gap-4">
        <Button variant="outline" className="rounded-none border-neutral-300" onClick={() => setActiveTab('dashboard')}>← Back</Button>
        <h2 className="font-serif italic text-2xl text-neutral-900">Investigation Details</h2>
      </div>
      <div className="border border-neutral-300 bg-white">
        <div className="p-4 border-b border-neutral-300 bg-neutral-100">
          <h2 className="font-serif italic text-sm text-neutral-600 uppercase tracking-widest">Entity Graph</h2>
        </div>
        <div className="p-4">
          <GraphView />
        </div>
      </div>
    </div>
  );
}

function HomeView({ setActiveTab, investigations, selectedInvestigationId, setSelectedInvestigationId, isAdmin }: any) {
  const [activities, setActivities] = useState<any[]>([]);
  const [stats, setStats] = useState({ activeInvestigations: 0, totalEntities: 0, provenLinks: 0 });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newInvName, setNewInvName] = useState('');
  const [newInvDesc, setNewInvDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatMessage, setChatMessage] = useState('');

  const handleDeleteInvestigation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this investigation?")) return;
    try {
      await deleteDoc(doc(db, 'investigations', id));
      if (selectedInvestigationId === id) {
        setSelectedInvestigationId(null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `investigations/${id}`);
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this activity?")) return;
    try {
      await deleteDoc(doc(db, 'activities', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `activities/${id}`);
    }
  };

  const addNote = async (noteContent: string) => {
    if (!selectedInvestigationId) return;
    try {
      await addDoc(collection(db, `investigations/${selectedInvestigationId}/notes`), {
        content: noteContent,
        createdAt: new Date().toISOString(),
        author: 'Bridget'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `investigations/${selectedInvestigationId}/notes`);
    }
  };

  const fetchData = async () => {
    try {
      const statRes = await fetch('/api/stats');
      setStats(await statRes.json());
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    }
  };

  useEffect(() => {
    fetchData();
    
    const q = query(collection(db, 'activities'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
    });

    return () => unsubscribe();
  }, []);

  const handleCreateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvName.trim()) return;
    setIsSubmitting(true);
    try {
      const newInv = {
        name: newInvName,
        description: newInvDesc,
        updated: 'Just now',
        entities: 0,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'investigations'), newInv);
      
      await addDoc(collection(db, 'activities'), {
        action: 'Investigation Created',
        target: newInvName,
        type: 'investigation',
        time: 'Just now',
        createdAt: new Date().toISOString()
      });
      
      setNewInvName('');
      setNewInvDesc('');
      setIsCreateModalOpen(false);
      setSelectedInvestigationId(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'investigations');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Investigations List */}
        <div className="lg:col-span-2 border border-neutral-300 bg-white">
          <div className="p-4 border-b border-neutral-300 flex flex-row items-center justify-between bg-neutral-100">
            <div>
              <h2 className="font-serif italic text-sm text-neutral-600 uppercase tracking-widest">Active Investigations</h2>
            </div>
            <Button size="sm" variant="outline" className="border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white" onClick={() => setIsCreateModalOpen(true)}>Start New</Button>
          </div>
          <div className="p-4">
            {investigations.length === 0 ? (
              <div className="text-center py-12 bg-neutral-50 border border-neutral-200">
                <Activity className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-neutral-900">No active investigations</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {investigations.map((inv: any, i: number) => (
                  <div 
                    key={i} 
                    onClick={() => { setSelectedInvestigationId(inv.id); setActiveTab('investigation-detail'); }}
                    className={`p-4 border border-neutral-300 transition-colors cursor-pointer ${selectedInvestigationId === inv.id ? 'bg-neutral-900 text-white' : 'bg-white hover:bg-neutral-100'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-mono font-bold text-sm tracking-tighter">{inv.name}</h4>
                      {isAdmin && (
                        <button onClick={(e) => handleDeleteInvestigation(e, inv.id)} className="text-neutral-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">{inv.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AI Chatbox */}
        <div className="border border-neutral-300 bg-white flex flex-col">
          <div className="p-4 border-b border-neutral-300 bg-neutral-100">
            <h2 className="font-serif italic text-sm text-neutral-600 uppercase tracking-widest">AI Analysis Chat</h2>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex-1 bg-neutral-50 border border-neutral-200 p-4 mb-4 overflow-y-auto min-h-[300px] font-mono text-xs text-neutral-600">
              <p>{'>'} System ready.</p>
              <p>{'>'} Type information to submit for analysis...</p>
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder="Type information..." 
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 border-neutral-300 rounded-none"
              />
              <Button className="rounded-none bg-neutral-900 text-white">Submit</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="border border-neutral-300 bg-white">
        <div className="p-4 border-b border-neutral-300 bg-neutral-100">
          <h2 className="font-serif italic text-sm text-neutral-600 uppercase tracking-widest">Direct Evidence Upload</h2>
        </div>
        <div className="p-8">
          <div className="border-2 border-dashed border-neutral-400 p-12 text-center hover:border-neutral-900 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-4" />
            <p className="text-sm text-neutral-600 font-medium">Click or drag files to upload</p>
            <p className="text-xs text-neutral-400 mt-1 font-mono">Supports PDF, JPG, PNG, ZIP</p>
          </div>
        </div>
      </div>

      {/* Create Investigation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-neutral-900">Start New Investigation</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInvestigation} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Investigation Name</label>
                <Input 
                  value={newInvName} 
                  onChange={(e) => setNewInvName(e.target.value)} 
                  placeholder="e.g., Operation Shell Game" 
                  autoFocus
                  required
                  className="h-12 text-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Description (Optional)</label>
                <textarea 
                  className="w-full min-h-[150px] p-4 rounded-md border border-neutral-200 focus:border-neutral-300 focus:ring-1 focus:ring-neutral-300 outline-none resize-y text-lg"
                  value={newInvDesc} 
                  onChange={(e) => setNewInvDesc(e.target.value)} 
                  placeholder="Briefly describe the target or scope of this investigation..." 
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={!newInvName.trim() || isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Investigation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-neutral-500 mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-neutral-900">{value}</h3>
          </div>
          <div className="p-2 bg-neutral-50 rounded-lg">{icon}</div>
        </div>
        <p className="text-xs text-neutral-500 mt-4">{trend}</p>
      </CardContent>
    </Card>
  );
}

function GraphView() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    fetch('/api/graph/entity/1')
      .then(res => res.json())
      .then(data => setGraphData(data))
      .catch(err => console.error(err));
      
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <Card className="h-[calc(100vh-10rem)] flex flex-col">
      <CardHeader className="border-b pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Entity Graph Visualization</CardTitle>
            <CardDescription>Interactive force-directed graph of entities and relationships</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Filter</Button>
            <Button variant="outline" size="sm">Export</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 relative" ref={containerRef}>
        {graphData ? (
          <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel="name"
            nodeColor={node => {
              if (node.type === 'person') return '#3b82f6';
              if (node.type === 'organization') return '#10b981';
              return '#8b5cf6';
            }}
            nodeRelSize={6}
            linkColor={() => '#cbd5e1'}
            linkWidth={2}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
            Loading graph data...
          </div>
        )}
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg border shadow-sm text-xs space-y-2">
          <div className="font-semibold mb-1">Entity Types</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Person</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> Organization</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Document</div>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadView({ verifiedHandle, selectedInvestigationId, isAdmin }: { verifiedHandle: string | null, selectedInvestigationId: string | null, isAdmin: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [handle, setHandle] = useState(verifiedHandle || '');
  const [recentUploads, setRecentUploads] = useState<any[]>([]);

  const handleDeleteUpload = async (uploadId: string) => {
    if (!selectedInvestigationId || !window.confirm("Are you sure you want to delete this upload?")) return;
    try {
      await deleteDoc(doc(db, `investigations/${selectedInvestigationId}/uploads`, uploadId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `investigations/${selectedInvestigationId}/uploads/${uploadId}`);
    }
  };

  useEffect(() => {
    if (selectedInvestigationId) {
      const q = query(collection(db, `investigations/${selectedInvestigationId}/uploads`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setRecentUploads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `investigations/${selectedInvestigationId}/uploads`);
      });
      return () => unsubscribe();
    } else {
      setRecentUploads([]);
    }
  }, [selectedInvestigationId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => {
    if (!selectedInvestigationId) {
      alert("Please select or create an investigation first.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(async () => {
            setUploading(false);
            let authorName = handle.trim();
            if (!authorName) {
              authorName = `anon${globalNextAnonId++}`;
            }
            
            try {
              const docRef = await addDoc(collection(db, `investigations/${selectedInvestigationId}/uploads`), {
                name: file.name,
                size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
                uploader: authorName,
                date: 'Just now',
                createdAt: new Date().toISOString(),
                processingStatus: 'Processing...'
              });

              // Simulate AI processing
              setTimeout(async () => {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
                const response = await ai.models.generateContent({
                  model: "gemini-3-flash-preview",
                  contents: `Extract entities from a file named "${file.name}". Return them as a JSON array of strings.`,
                  config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  }
                });
                const entities = JSON.parse(response.text || "[]");
                await updateDoc(doc(db, `investigations/${selectedInvestigationId}/uploads`, docRef.id), {
                  processingStatus: 'Completed',
                  entities: entities
                });
              }, 3000);
              
              await addDoc(collection(db, 'activities'), {
                action: 'Evidence Uploaded',
                target: file.name,
                type: 'upload',
                time: 'Just now',
                createdAt: new Date().toISOString()
              });
            } catch (error) {
              handleFirestoreError(error, OperationType.CREATE, `investigations/${selectedInvestigationId}/uploads`);
            }
          }, 500);
          return 100;
        }
        return p + 5;
      });
    }, 100);
  };

  if (!selectedInvestigationId) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12 bg-white rounded-lg border border-dashed border-neutral-300">
        <h3 className="text-lg font-medium text-neutral-900">No Investigation Selected</h3>
        <p className="text-neutral-500 mt-2">Please select an investigation from the top menu to upload evidence.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Direct Evidence Upload</CardTitle>
          <CardDescription>Upload documents, images, or archives for automated processing and entity extraction.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <label className="text-sm font-medium text-neutral-700 mb-1.5 block">Your Handle (Optional)</label>
            <div className="flex gap-2 max-w-md">
              <Input 
                placeholder="e.g. Investigator_X (defaults to anon...)" 
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                disabled={!!verifiedHandle}
                className={`${verifiedHandle ? "bg-green-50 border-green-200 text-green-800" : ""} h-12 text-lg`}
              />
              {verifiedHandle && (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified
                </Badge>
              )}
            </div>
          </div>
          <div className="border-2 border-dashed border-neutral-300 rounded-xl p-12 flex flex-col items-center justify-center text-center bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900 mb-1">Drag & drop files here</h3>
            <p className="text-sm text-neutral-500 mb-6">or click to browse from your computer</p>
            <p className="text-xs text-neutral-400 max-w-sm">
              Supported formats: PDF, DOCX, JPG, PNG, CSV. Max file size: 50MB.
              Unrestricted upload enabled. No content filtering applied.
            </p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <Button className="mt-6" onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Processing...' : 'Select Files'}
            </Button>
          </div>

          {uploading && (
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-neutral-700">Uploading and Scanning...</span>
                <span className="text-neutral-500">{progress}%</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-neutral-500 pt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" /> Processing raw evidence...
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentUploads.map((file, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-neutral-100 rounded-md">
                    <FileText className="w-5 h-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-neutral-900">{file.name}</p>
                    <p className="text-xs text-neutral-500">{file.size} • Uploaded {file.date} by <span className="font-medium text-neutral-700">{file.uploader}</span></p>
                    {file.processingStatus === 'Completed' && (
                      <Badge variant="outline" className="mt-1 text-[10px] bg-green-50 text-green-700">
                        Completed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <button onClick={() => handleDeleteUpload(file.id)} className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <CommentsView verifiedHandle={verifiedHandle} selectedInvestigationId={selectedInvestigationId} isAdmin={isAdmin} />
    </div>
  );
}

function SearchView() {
  const [queries, setQueries] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/search/status')
      .then(res => res.json())
      .then(data => setQueries(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Active Search Queries</CardTitle>
          <CardDescription>Monitor automated OSINT queries across external databases and search engines.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {queries.map((q, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-neutral-500" />
                    <span className="font-medium text-sm">"{q.query}"</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={q.progress} className="flex-1" />
                  <span className="text-xs text-neutral-500 w-12 text-right">{q.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New Query</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input placeholder="Enter entity name, alias, or keyword..." className="flex-1" />
            <Button>Start Search</Button>
          </div>
          <div className="mt-4 flex gap-2">
            <Badge variant="outline" className="cursor-pointer hover:bg-neutral-100">Public Records</Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-neutral-100">Social Media</Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-neutral-100">Corporate Filings</Badge>
            <Badge variant="outline" className="cursor-pointer hover:bg-neutral-100">Dark Web</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getRelativeTime(isoString: string) {
  if (!isoString) return '';
  const now = new Date();
  const past = new Date(isoString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function CommentsView({ verifiedHandle, selectedInvestigationId, isAdmin }: { verifiedHandle: string | null, selectedInvestigationId: string | null, isAdmin: boolean }) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [handle, setHandle] = useState(verifiedHandle || '');

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedInvestigationId || !window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      await deleteDoc(doc(db, `investigations/${selectedInvestigationId}/comments`, commentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `investigations/${selectedInvestigationId}/comments/${commentId}`);
    }
  };

  useEffect(() => {
    if (selectedInvestigationId) {
      const q = query(collection(db, `investigations/${selectedInvestigationId}/comments`), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `investigations/${selectedInvestigationId}/comments`);
      });
      return () => unsubscribe();
    } else {
      setComments([]);
    }
  }, [selectedInvestigationId]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !selectedInvestigationId) return;
    let authorName = handle.trim();
    if (!authorName) {
      authorName = `anon${globalNextAnonId++}`;
    }
    
    // AI Entity Extraction
    let entities: string[] = [];
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract entities from the following comment: "${newComment}". Return them as a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      entities = JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("AI Entity Extraction failed", error);
    }

    try {
      await addDoc(collection(db, `investigations/${selectedInvestigationId}/comments`), {
        author: authorName,
        text: newComment,
        entities: entities,
        createdAt: new Date().toISOString()
      });
      
      await addDoc(collection(db, 'activities'), {
        action: 'Comment Added',
        target: newComment.substring(0, 20) + '...',
        type: 'comment',
        time: 'Just now',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
      setNewComment('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `investigations/${selectedInvestigationId}/comments`);
    }
  };

  if (!selectedInvestigationId) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12 bg-white rounded-none border border-neutral-300">
        <h3 className="text-lg font-medium text-neutral-900">No Investigation Selected</h3>
        <p className="text-neutral-500 mt-2">Please select an investigation from the top menu to view or add comments.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      <div className="border border-neutral-300 bg-white">
        <div className="p-4 border-b border-neutral-300 bg-neutral-100">
          <h2 className="font-serif italic text-sm text-neutral-600 uppercase tracking-widest">Public Comments & Queries</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <Input 
              placeholder="Your Handle (defaults to anon...)" 
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={!!verifiedHandle}
              className={`border-neutral-300 rounded-none ${verifiedHandle ? "bg-green-50 text-green-800" : ""}`}
            />
            <div className="flex gap-2">
              <Input 
                placeholder="Enter your theory or query..." 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1 border-neutral-300 rounded-none"
              />
              <Button onClick={handleSubmit} className="rounded-none bg-neutral-900 text-white">Submit Query</Button>
            </div>
          </div>

          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="border border-neutral-300 p-4 relative group">
                {isAdmin && (
                  <button 
                    onClick={() => handleDeleteComment(comment.id)} 
                    className="absolute top-4 right-4 text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <div className="flex justify-between items-start mb-2 pr-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-neutral-200 rounded-none flex items-center justify-center text-xs font-mono font-bold text-neutral-600">
                      {comment.author.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-mono font-semibold">{comment.author}</p>
                      <p className="text-xs text-neutral-500 font-mono">{getRelativeTime(comment.createdAt)}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-none text-xs font-mono">{comment.status || 'Query Active'}</Badge>
                </div>
                <p className="text-neutral-800 mt-2 text-sm">{comment.text}</p>
                <div className="mt-4 flex gap-2 items-center">
                  <span className="text-xs text-neutral-500 font-mono">Entities:</span>
                  {comment.entities.map((ent: string, i: number) => (
                    <Badge key={i} variant="outline" className="rounded-none text-xs font-mono bg-neutral-100 text-neutral-700 border-neutral-300">{ent}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Chatbot />
    </div>
  );
}
