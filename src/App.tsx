import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { 
  User as UserIcon, 
  LayoutDashboard, 
  LogOut, 
  Save, 
  ExternalLink, 
  QrCode, 
  Download, 
  Plus, 
  Trash2, 
  Globe, 
  MessageCircle, 
  Linkedin, 
  Twitter, 
  Instagram,
  BarChart3,
  ChevronRight,
  Share2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile, Order } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Error Handling ---
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) message = `Database Error: ${parsed.error}`;
      } catch (e) {
        message = this.state.error.message || message;
      }

      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-12 text-center">
          <div className="space-y-8 max-w-xl">
            <h2 className="text-6xl font-black tracking-tighter uppercase text-white">SYSTEM ERROR.</h2>
            <p className="text-zinc-500 font-black uppercase tracking-widest text-sm leading-relaxed">
              {message}
            </p>
            <Button onClick={() => window.location.reload()} className="w-full h-20">REBOOT SYSTEM.</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LOGO_URL = "https://storage.googleapis.com/static.mira.ai/agent_attachments/9364409d-092b-4786-9a2c-901804369792/input_file_0.png";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- VCF Generator ---
const generateVCF = (profile: UserProfile) => {
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${profile.displayName}`,
    `TITLE:${profile.title || ''}`,
    `TEL;TYPE=CELL,VOICE:${profile.whatsapp || ''}`,
    `EMAIL;TYPE=PREF,INTERNET:${profile.email || ''}`,
    `URL:${profile.website || ''}`,
    `NOTE:${profile.bio || ''}`,
    'END:VCARD'
  ].join('\n');

  const blob = new Blob([vcf], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${profile.username}.vcf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' }) => {
  const variants = {
    primary: 'bg-white text-black hover:bg-zinc-200',
    secondary: 'bg-black text-white border-2 border-white hover:bg-zinc-900',
    outline: 'border-2 border-white text-white hover:bg-white hover:text-black'
  };

  return (
    <button 
      className={cn(
        'px-8 py-5 rounded-none font-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 uppercase tracking-tighter text-base',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div className="space-y-3 w-full">
    <label className="text-[12px] uppercase tracking-[0.4em] text-zinc-400 font-black">{label}</label>
    <input 
      className="w-full bg-black border-2 border-white px-6 py-5 focus:bg-zinc-900 outline-none transition-all text-lg font-black tracking-tight text-white placeholder:text-zinc-700"
      {...props}
    />
  </div>
);

const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="space-y-2 mb-10">
    <h3 className="text-4xl font-black tracking-tighter uppercase leading-none text-white">{title}</h3>
    {subtitle && <p className="text-[11px] text-zinc-500 uppercase tracking-[0.4em] font-black">{subtitle}</p>}
  </div>
);

const Card = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("bg-black border-2 border-white p-10 shadow-[12px_12px_0px_0px_rgba(255,255,255,1)] relative overflow-hidden", className)} {...props}>
    <img 
      src={LOGO_URL} 
      alt="" 
      className="absolute -bottom-4 -right-4 w-24 h-24 opacity-[0.03] invert pointer-events-none" 
      referrerPolicy="no-referrer" 
    />
    <div className="relative z-10">
      {children}
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Immediate route detection
  const path = window.location.pathname;
  const isPublicView = path.startsWith('/u/');
  const publicUsername = isPublicView ? path.split('/u/')[1] : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && !isPublicView) {
        await fetchProfile(u.uid);
        setIsAdmin(u.email === 'jevuniverse@gmail.com');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [isPublicView]);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'profiles', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `profiles/${uid}`);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("Popup blocked. Please allow popups for this site.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignore, usually means another request was started
      } else if (error.code === 'auth/popup-closed-by-user') {
        // Ignore
      } else {
        setAuthError("Login failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  // Public profile takes precedence and doesn't require auth
  // We check this BEFORE the loading state to ensure instant access
  if (isPublicView && publicUsername) {
    return <PublicProfile username={publicUsername} />;
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="flex flex-col items-center gap-4"
      >
        <img src={LOGO_URL} alt="TACTIK" className="w-16 h-16 invert" referrerPolicy="no-referrer" />
        <div className="text-2xl font-black tracking-tighter text-white">TACTIK.</div>
      </motion.div>
    </div>
  );

  if (!user) return <Landing onLogin={handleLogin} isLoggingIn={isLoggingIn} authError={authError} />;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black text-white font-sans">
        <nav className="bg-black border-b border-zinc-900 px-12 py-8 flex justify-between items-center sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <img src={LOGO_URL} alt="TACTIK" className="w-12 h-12 invert" referrerPolicy="no-referrer" />
            <div className="font-black text-3xl tracking-tighter uppercase">TACTIK.</div>
          </div>
          <div className="flex items-center gap-8">
            {isAdmin && (
              <div className="px-4 py-2 bg-white text-black text-[10px] font-black tracking-widest uppercase">Admin Mode</div>
            )}
            <button onClick={handleLogout} className="text-zinc-500 hover:text-white transition-colors">
              <LogOut size={28} />
            </button>
          </div>
        </nav>

        <main className="max-w-4xl mx-auto p-6 space-y-12 pb-24">
          {!profile ? (
            <Onboarding uid={user.uid} onComplete={() => fetchProfile(user.uid)} />
          ) : (
            <>
              {isAdmin ? (
                <div className="space-y-12">
                  <Dashboard profile={profile} onUpdate={setProfile} />
                  <AdminOrders isAdmin={isAdmin} />
                </div>
              ) : (
                <Dashboard profile={profile} onUpdate={setProfile} />
              )}
            </>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

function Landing({ onLogin, isLoggingIn, authError }: { onLogin: () => void; isLoggingIn: boolean; authError: string | null }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* Auth Error Toast */}
      <AnimatePresence>
        {authError && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-8 py-4 font-black uppercase tracking-widest text-sm shadow-2xl border-2 border-white"
          >
            {authError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex justify-between items-center px-12 py-16">
        <div className="flex items-center gap-6">
          <img src={LOGO_URL} alt="TACTIK" className="w-16 h-16 invert" referrerPolicy="no-referrer" />
          <div className="font-black text-5xl tracking-tighter uppercase">TACTIK.</div>
        </div>
        <div className="flex gap-4 md:gap-6">
          <Button onClick={onLogin} disabled={isLoggingIn} variant="outline" className="h-12 md:h-16 px-6 md:px-12 text-sm md:text-base">
            {isLoggingIn ? '...' : 'Log In'}
          </Button>
          <Button onClick={onLogin} disabled={isLoggingIn} className="h-12 md:h-16 px-6 md:px-12 text-sm md:text-base">
            {isLoggingIn ? '...' : 'Get Started'}
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-12 py-32 md:py-56 flex flex-col items-center text-center space-y-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <img src={LOGO_URL} alt="TACTIK Logo" className="w-56 h-56 md:w-80 md:h-80 invert" referrerPolicy="no-referrer" />
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-10 max-w-7xl"
        >
          <h1 className="text-8xl md:text-[14rem] font-black tracking-tighter leading-[0.75] uppercase">
            FUTURE.<br />IDENTITY.<br />NOW.
          </h1>
          <p className="text-zinc-500 text-lg md:text-2xl tracking-[0.5em] uppercase max-w-4xl mx-auto font-black">
            NFC-POWERED PROFESSIONAL BRANDING.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          viewport={{ once: true }}
          className="pt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          <div className="space-y-6">
            <Button onClick={onLogin} disabled={isLoggingIn} className="w-full h-32 text-3xl shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]">
              {isLoggingIn ? 'WAITING...' : 'SIGN UP'} <ChevronRight size={40} />
            </Button>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">New to TACTIK? Claim your handle now.</p>
          </div>
          <div className="space-y-6">
            <Button onClick={onLogin} disabled={isLoggingIn} variant="outline" className="w-full h-32 text-3xl">
              {isLoggingIn ? '...' : 'LOG IN.'}
            </Button>
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Already have an identity? Access your vault.</p>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="bg-zinc-950 text-white px-12 py-40 border-y-[40px] border-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-24">
          <FeatureCard 
            title="DYNAMIC." 
            desc="Update your identity in real-time. Your card is never obsolete."
            icon={<UserIcon size={64} />}
          />
          <FeatureCard 
            title="INSTANT." 
            desc="One tap shares everything. No apps, no friction, just connection."
            icon={<Share2 size={64} />}
          />
          <FeatureCard 
            title="ANALYTIC." 
            desc="Measure your impact. See every engagement with your brand."
            icon={<BarChart3 size={64} />}
          />
        </div>
      </section>

      {/* How it Works */}
      <section className="px-12 py-40 max-w-7xl mx-auto space-y-32">
        <h2 className="text-8xl font-black tracking-tighter uppercase leading-none">THE PROCESS.</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16">
          <Step num="01" title="CLAIM" desc="Secure your unique TACTIK handle." />
          <Step num="02" title="BUILD" desc="Construct your professional profile." />
          <Step num="03" title="LINK" desc="Sync with NFC hardware." />
          <Step num="04" title="DOMINATE" desc="Share your identity with the world." />
        </div>
      </section>

      {/* Mid-Page CTA / Auth Section */}
      <section className="px-12 py-60 bg-black border-y-[40px] border-zinc-900 flex flex-col items-center text-center space-y-24">
        <div className="space-y-8">
          <h2 className="text-7xl md:text-[10rem] font-black tracking-tighter uppercase leading-none">JOIN THE<br />ELITE.</h2>
          <p className="text-zinc-500 text-base md:text-xl tracking-[0.4em] uppercase font-black max-w-3xl mx-auto">
            Choose your path to digital dominance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-6xl">
          <div className="p-16 border-4 border-white space-y-10 text-left bg-zinc-950 group hover:bg-white hover:text-black transition-all cursor-pointer" onClick={() => !isLoggingIn && onLogin()}>
            <div className="w-20 h-20 bg-white text-black flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
              <Plus size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-5xl font-black tracking-tighter uppercase">NEW IDENTITY.</h3>
              <p className="text-sm font-black uppercase tracking-widest opacity-60">Create your professional profile and claim your handle.</p>
            </div>
            <Button disabled={isLoggingIn} className="w-full h-20 text-xl group-hover:bg-black group-hover:text-white">
              {isLoggingIn ? '...' : 'SIGN UP NOW'}
            </Button>
          </div>

          <div className="p-16 border-4 border-zinc-800 space-y-10 text-left bg-black group hover:border-white transition-all cursor-pointer" onClick={() => !isLoggingIn && onLogin()}>
            <div className="w-20 h-20 bg-zinc-900 text-white flex items-center justify-center group-hover:bg-white group-hover:text-black transition-colors">
              <LayoutDashboard size={48} />
            </div>
            <div className="space-y-4">
              <h3 className="text-5xl font-black tracking-tighter uppercase">EXISTING USER.</h3>
              <p className="text-sm font-black uppercase tracking-widest opacity-60">Access your dashboard and manage your TACTIK card.</p>
            </div>
            <Button disabled={isLoggingIn} variant="outline" className="w-full h-20 text-xl">
              {isLoggingIn ? '...' : 'LOG IN HERE'}
            </Button>
          </div>
        </div>
      </section>

      {/* Login Portal Section */}
      <section className="px-12 py-40 bg-zinc-950 flex flex-col items-center text-center space-y-16 border-t-[20px] border-white">
        <div className="space-y-4">
          <h2 className="text-6xl font-black tracking-tighter uppercase">LOGIN PORTAL.</h2>
          <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.5em]">Secure access to your digital vault.</p>
        </div>
        <div className="w-full max-w-xl p-12 border-2 border-zinc-800 bg-black space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-full border-2 border-zinc-800 flex items-center justify-center">
              <UserIcon size={32} className="text-zinc-500" />
            </div>
            <p className="text-zinc-400 text-xs font-black uppercase tracking-widest">Authorized Personnel Only</p>
          </div>
          <Button onClick={onLogin} disabled={isLoggingIn} className="w-full h-20 text-xl">
            {isLoggingIn ? 'AUTHENTICATING...' : 'AUTHENTICATE WITH GOOGLE'}
          </Button>
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
            <span>Encrypted</span>
            <span>•</span>
            <span>Secure</span>
            <span>•</span>
            <span>Identity Verified</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white px-12 py-32 flex flex-col md:flex-row justify-between items-center gap-16">
        <div className="flex items-center gap-8">
          <img src={LOGO_URL} alt="TACTIK" className="w-16 h-16 invert" referrerPolicy="no-referrer" />
          <div className="font-black text-5xl tracking-tighter uppercase">TACTIK.</div>
        </div>
        <div className="text-[12px] uppercase tracking-[0.6em] text-zinc-600 font-black text-center md:text-left">
          © 2026 TACTIK DIGITAL IDENTITY.
        </div>
        <Button onClick={onLogin} disabled={isLoggingIn} variant="secondary" className="h-20 px-16">
          {isLoggingIn ? '...' : 'GET STARTED'}
        </Button>
      </footer>
    </div>
  );
}

function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-8 p-12 border-4 border-zinc-800 hover:border-white transition-all group bg-zinc-950">
      <div className="text-white group-hover:scale-110 transition-transform">{icon}</div>
      <h3 className="text-4xl font-black tracking-tighter uppercase leading-none">{title}</h3>
      <p className="text-zinc-400 text-sm font-black uppercase tracking-widest leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="space-y-6 p-10 border-4 border-zinc-900 hover:border-white transition-colors group">
      <div className="text-7xl font-black tracking-tighter text-white leading-none group-hover:scale-110 transition-transform origin-left">{num}</div>
      <h3 className="text-2xl font-black tracking-tighter uppercase leading-none text-white">{title}</h3>
      <p className="text-zinc-500 text-sm font-black uppercase tracking-widest group-hover:text-zinc-300 transition-colors">{desc}</p>
    </div>
  );
}

function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-black w-full max-w-sm p-12 space-y-12 relative border-4 border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={32} />
        </button>

        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black tracking-tighter uppercase leading-none text-white">Share Profile.</h2>
          <p className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-black">Scan to view your digital identity</p>
        </div>

        <div className="flex justify-center p-8 bg-zinc-950 border-4 border-white">
          <QRCodeSVG 
            value={url} 
            size={240} 
            level="H" 
            includeMargin 
            imageSettings={{
              src: LOGO_URL,
              x: undefined,
              y: undefined,
              height: 40,
              width: 40,
              excavate: true,
            }}
          />
        </div>

        <div className="space-y-6">
          <Button 
            variant="primary" 
            className="w-full h-20" 
            onClick={() => {
              navigator.clipboard.writeText(url);
              alert('Link copied to clipboard');
            }}
          >
            Copy Profile Link
          </Button>
          <p className="text-[10px] text-center uppercase tracking-[0.3em] text-zinc-600 font-black">
            {url.replace('https://', '')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Onboarding({ uid, onComplete }: { uid: string; onComplete: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!username || !displayName) return setError('All fields required');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return setError('Invalid username format');

    try {
      // Check if username taken
      const userRef = doc(db, 'usernames', username);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) return setError('Username already taken');

      const newProfile: UserProfile = {
        uid,
        username,
        displayName,
        viewCount: 0,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'profiles', uid), newProfile);
      await setDoc(userRef, { uid });
      onComplete();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `profiles/${uid}`);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl space-y-16">
        <div className="flex flex-col items-center text-center space-y-8">
          <img src={LOGO_URL} alt="TACTIK" className="w-32 h-32 invert" referrerPolicy="no-referrer" />
          <div className="space-y-4">
            <h2 className="text-7xl font-black tracking-tighter leading-none uppercase text-white">INITIALIZE.</h2>
            <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.5em]">Claim your unique identity.</p>
          </div>
        </div>
        
        <Card className="space-y-12 p-16 border-4 border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]">
          <Input 
            label="Unique Handle" 
            placeholder="e.g. jdoe" 
            value={username} 
            onChange={e => setUsername(e.target.value.toLowerCase())} 
          />
          <Input 
            label="Display Name" 
            placeholder="e.g. John Doe" 
            value={displayName} 
            onChange={e => setDisplayName(e.target.value)} 
          />
          {error && (
            <div className="p-6 bg-red-950 border-4 border-red-600 text-red-500 text-xs font-black uppercase tracking-widest">
              {error}
            </div>
          )}
          <Button onClick={handleSubmit} className="w-full h-24 text-2xl">
            CREATE PROFILE <ChevronRight size={32} />
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}

function Dashboard({ profile, onUpdate }: { profile: UserProfile; onUpdate: (p: UserProfile) => void }) {
  const [editing, setEditing] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [userOrder, setUserOrder] = useState<Order | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), where('uid', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setUserOrder({ id: snap.docs[0].id, ...snap.docs[0].data() } as Order);
      } else {
        setUserOrder(null);
      }
    }, (error) => {
      console.error("Order listener error:", error);
    });
    return unsubscribe;
  }, [profile.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'profiles', profile.uid);
      await updateDoc(docRef, { ...editing, updatedAt: new Date().toISOString() });
      onUpdate(editing);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `profiles/${profile.uid}`);
    }
    setSaving(false);
  };

  const profileUrl = `${window.location.origin}/u/${profile.username}`;

  return (
    <div className="space-y-16 pb-32">
      {/* App Header */}
      <div className="flex justify-between items-center bg-black text-white p-12 -mx-6 -mt-8 mb-16 border-b-[16px] border-zinc-900">
        <div className="flex items-center gap-10">
          <img src={LOGO_URL} alt="" className="w-24 h-24 invert opacity-20" referrerPolicy="no-referrer" />
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-500">System Online</span>
            </div>
            <h2 className="text-7xl font-black tracking-tighter leading-none">DASHBOARD.</h2>
          </div>
        </div>
        <div className="flex gap-6">
          <button 
            onClick={() => setShowQR(true)}
            className="w-20 h-20 bg-white text-black flex items-center justify-center transition-transform active:scale-90"
          >
            <QrCode size={36} />
          </button>
          <button 
            onClick={() => window.open(profileUrl, '_blank')}
            className="w-20 h-20 bg-white text-black flex items-center justify-center transition-transform active:scale-90"
          >
            <ExternalLink size={36} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showQR && <QRModal url={profileUrl} onClose={() => setShowQR(false)} />}
        {showOrder && <OrderModal profile={profile} onClose={() => setShowOrder(false)} onOrderSuccess={() => {}} />}
      </AnimatePresence>

      {/* Stats Bento */}
      <div className="grid grid-cols-6 gap-8">
        <Card className="col-span-3 flex flex-col justify-between p-10 h-64 relative overflow-hidden bg-zinc-950 text-white border-4 border-white shadow-none">
          <img src={LOGO_URL} alt="" className="absolute -right-12 -bottom-12 w-56 h-56 opacity-10 pointer-events-none invert" referrerPolicy="no-referrer" />
          <BarChart3 className="text-zinc-500" size={32} />
          <div>
            <span className="block text-8xl font-black tracking-tighter leading-none">{profile.viewCount}</span>
            <span className="text-[12px] uppercase tracking-[0.4em] font-black text-zinc-500">Total Taps</span>
          </div>
        </Card>
        
        <Card className="col-span-3 flex flex-col justify-between p-10 h-64 relative overflow-hidden border-4 border-white shadow-none bg-black text-white">
          <Share2 className="text-zinc-500" size={32} />
          <div className="space-y-2">
            <span className="block text-3xl font-black tracking-tighter uppercase truncate">/{profile.username}</span>
            <span className="text-[12px] uppercase tracking-[0.4em] font-black text-zinc-500">Handle</span>
          </div>
        </Card>

        {userOrder ? (
          <Card className="col-span-6 p-10 flex justify-between items-center border-4 border-white bg-zinc-950 shadow-none">
            <div className="space-y-3">
              <h3 className="font-black tracking-tighter uppercase text-4xl text-white">Status: {userOrder.status}</h3>
              <p className="text-[12px] text-zinc-500 uppercase tracking-[0.4em] font-black">Ordered {new Date(userOrder.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="px-10 py-5 bg-white text-black text-sm font-black uppercase tracking-[0.3em]">
              {userOrder.status}
            </div>
          </Card>
        ) : (
          <Card className="col-span-6 p-0 overflow-hidden border-4 border-white group cursor-pointer shadow-none" onClick={() => setShowOrder(true)}>
            <div className="bg-zinc-950 text-white p-12 flex justify-between items-center group-hover:bg-zinc-900 transition-colors">
              <div className="space-y-2">
                <h3 className="font-black tracking-tighter uppercase text-5xl leading-none">Order Card.</h3>
                <p className="text-[12px] text-zinc-500 uppercase tracking-[0.5em] font-black">NFC Technology</p>
              </div>
              <div className="w-24 h-24 bg-white text-black flex items-center justify-center">
                <Plus size={48} />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Profile Modules */}
      <div className="space-y-20">
        <section className="space-y-10">
          <SectionHeader title="Core Identity" subtitle="Basic profile information" />
          <Card className="space-y-12">
            <Input label="Display Name" value={editing.displayName} onChange={e => setEditing({...editing, displayName: e.target.value})} />
            <Input label="Professional Title" value={editing.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
            <div className="space-y-3 w-full">
              <label className="text-[12px] uppercase tracking-[0.4em] text-zinc-400 font-black">Bio</label>
              <textarea 
                className="w-full bg-black border-2 border-white px-6 py-6 focus:bg-zinc-900 outline-none transition-all text-lg font-black min-h-[160px] text-white"
                value={editing.bio || ''} 
                onChange={e => setEditing({...editing, bio: e.target.value})}
              />
            </div>
          </Card>
        </section>

        <section className="space-y-10">
          <SectionHeader title="Contact Channels" subtitle="How people reach you" />
          <Card className="space-y-12">
            <Input label="WhatsApp" placeholder="+1234567890" value={editing.whatsapp || ''} onChange={e => setEditing({...editing, whatsapp: e.target.value})} />
            <Input label="Email" value={editing.email || ''} onChange={e => setEditing({...editing, email: e.target.value})} />
            <Input label="Website" placeholder="https://..." value={editing.website || ''} onChange={e => setEditing({...editing, website: e.target.value})} />
          </Card>
        </section>

        <section className="space-y-10">
          <SectionHeader title="Social Ecosystem" subtitle="Your digital footprint" />
          <Card className="space-y-12">
            <Input label="LinkedIn URL" value={editing.socialLinks?.linkedin || ''} onChange={e => setEditing({...editing, socialLinks: {...editing.socialLinks, linkedin: e.target.value}})} />
            <Input label="Twitter / X URL" value={editing.socialLinks?.twitter || ''} onChange={e => setEditing({...editing, socialLinks: {...editing.socialLinks, twitter: e.target.value}})} />
            <Input label="Instagram URL" value={editing.socialLinks?.instagram || ''} onChange={e => setEditing({...editing, socialLinks: {...editing.socialLinks, instagram: e.target.value}})} />
          </Card>
        </section>

        <div className="sticky bottom-12 left-0 right-0 z-40">
          <Button onClick={handleSave} disabled={saving} className="w-full h-28 text-3xl shadow-[16px_16px_0px_0px_rgba(255,255,255,1)] border-4 border-white">
            {saving ? 'SYNCHRONIZING...' : <><Save size={40} /> DEPLOY CHANGES.</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PublicProfile({ username }: { username: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const q = query(collection(db, 'profiles'), where('username', '==', username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data() as UserProfile;
        setProfile(data);
        // Increment view count
        await updateDoc(doc(db, 'profiles', snap.docs[0].id), {
          viewCount: increment(1)
        });
      } else {
        setNotFound(true);
      }
    };
    fetch();
  }, [username]);

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-12 bg-black text-white">
      <h1 className="text-[12rem] font-black tracking-tighter leading-none">404.</h1>
      <p className="text-zinc-500 uppercase tracking-[0.5em] text-sm font-black">Identity not found.</p>
      <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full max-w-xs h-20">Go Home</Button>
    </div>
  );

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-white selection:text-black">
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <div className="p-12 pt-24 space-y-12 flex-grow">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <img src={LOGO_URL} alt="TACTIK" className="w-20 h-20 mb-12 invert" referrerPolicy="no-referrer" />
            <div className="w-32 h-4 bg-white mb-12" />
            <h1 className="text-7xl md:text-8xl font-black tracking-tighter leading-[0.8] uppercase">
              {profile.displayName}
            </h1>
            {profile.title && (
              <p className="text-zinc-500 font-black tracking-[0.4em] uppercase text-sm">
                {profile.title}
              </p>
            )}
          </motion.div>

          {profile.bio && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-medium leading-tight text-white border-l-[12px] border-white pl-8 py-4"
            >
              {profile.bio}
            </motion.p>
          )}

          <div className="grid grid-cols-1 gap-6 pt-12">
            {profile.whatsapp && (
              <ProfileLink icon={<MessageCircle size={32} />} label="WhatsApp" href={`https://wa.me/${profile.whatsapp}`} />
            )}
            {profile.email && (
              <ProfileLink icon={<UserIcon size={32} />} label="Email" href={`mailto:${profile.email}`} />
            )}
            {profile.website && (
              <ProfileLink icon={<Globe size={32} />} label="Website" href={profile.website} />
            )}
            {profile.socialLinks?.linkedin && (
              <ProfileLink icon={<Linkedin size={32} />} label="LinkedIn" href={profile.socialLinks.linkedin} />
            )}
            {profile.socialLinks?.twitter && (
              <ProfileLink icon={<Twitter size={32} />} label="Twitter" href={profile.socialLinks.twitter} />
            )}
            {profile.socialLinks?.instagram && (
              <ProfileLink icon={<Instagram size={32} />} label="Instagram" href={profile.socialLinks.instagram} />
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-12 space-y-8 bg-zinc-950 text-white border-t-[16px] border-black">
          <Button onClick={() => generateVCF(profile)} variant="primary" className="w-full h-24 text-xl shadow-[12px_12px_0px_0px_rgba(255,255,255,1)]">
            <Download size={32} /> SAVE IDENTITY.
          </Button>
          <div className="flex flex-col items-center gap-4 opacity-30">
            <img src={LOGO_URL} alt="" className="w-10 h-10 invert" referrerPolicy="no-referrer" />
            <div className="text-[12px] font-black tracking-[0.6em] uppercase">
              Powered by TACTIK.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileLink({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <motion.a 
      whileHover={{ x: 15, backgroundColor: '#fff', color: '#000' }}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between p-8 border-4 border-white transition-all group bg-black text-white"
    >
      <div className="flex items-center gap-8">
        <span className="transition-colors">{icon}</span>
        <span className="text-base font-black uppercase tracking-tighter">{label}</span>
      </div>
      <ChevronRight size={28} className="transition-transform group-hover:translate-x-2" />
    </motion.a>
  );
}

function OrderModal({ profile, onClose, onOrderSuccess }: { profile: UserProfile; onClose: () => void; onOrderSuccess: () => void }) {
  const [address, setAddress] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleOrder = async () => {
    if (!address) return alert('Please enter shipping address');
    setOrdering(true);
    try {
      const orderData = {
        uid: profile.uid,
        username: profile.username,
        status: 'pending',
        amount: 29.99,
        shippingAddress: address,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, orderData);
      setSuccess(true);
      onOrderSuccess();
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'orders');
    }
    setOrdering(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-black w-full max-w-sm p-12 space-y-12 relative border-4 border-white shadow-[20px_20px_0px_0px_rgba(255,255,255,1)]"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-white hover:scale-110 transition-transform">
          <X size={40} />
        </button>

        {success ? (
          <div className="text-center space-y-10 py-12">
            <div className="w-32 h-32 bg-white rounded-none flex items-center justify-center mx-auto text-black">
              <img src={LOGO_URL} alt="" className="w-16 h-16" referrerPolicy="no-referrer" />
            </div>
            <div className="space-y-6">
              <h2 className="text-5xl font-black tracking-tighter uppercase leading-none text-white">ORDER<br />LOGGED.</h2>
              <p className="text-[12px] text-zinc-500 font-black uppercase tracking-[0.3em] leading-relaxed">
                Your request for a TACTIK card has been registered. We will contact you for payment.
              </p>
            </div>
            <Button onClick={onClose} className="w-full h-24 text-xl">CLOSE.</Button>
          </div>
        ) : (
          <>
            <div className="text-center space-y-8">
              <img src={LOGO_URL} alt="TACTIK" className="w-20 h-20 mx-auto invert" referrerPolicy="no-referrer" />
              <div className="space-y-3">
                <h2 className="text-5xl font-black tracking-tighter uppercase leading-none text-white">ORDER CARD.</h2>
                <p className="text-[12px] uppercase tracking-[0.4em] text-zinc-500 font-black">Premium NFC Hardware</p>
              </div>
            </div>

            <div className="space-y-10">
              <div className="p-8 bg-zinc-950 border-4 border-white text-white flex justify-between items-center">
                <span className="text-[12px] font-black uppercase tracking-[0.4em] text-zinc-500">Price</span>
                <span className="text-4xl font-black tracking-tighter">$29.99</span>
              </div>

              <div className="space-y-4">
                <label className="text-[12px] uppercase tracking-[0.4em] text-zinc-500 font-black">Shipping Address</label>
                <textarea 
                  className="w-full bg-black border-2 border-white p-6 focus:bg-zinc-900 outline-none transition-all text-base font-black min-h-[160px] text-white placeholder:text-zinc-800"
                  placeholder="Enter full delivery address..."
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              <Button onClick={handleOrder} disabled={ordering} className="w-full h-24 text-xl">
                {ordering ? 'PROCESSING...' : 'REQUEST & PAY'}
              </Button>
              
              <p className="text-[11px] text-center uppercase tracking-[0.3em] text-zinc-600 font-black leading-relaxed">
                Manual payment verification required.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function AdminOrders({ isAdmin }: { isAdmin: boolean }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Admin orders listener error:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status, updatedAt: new Date().toISOString() });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm('Permanently delete this order?')) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `orders/${id}`);
    }
  };

  if (!isAdmin) return null;
  if (loading) return (
    <div className="py-20 text-center text-zinc-500 font-black uppercase tracking-widest animate-pulse">
      Loading Secure Data...
    </div>
  );

  return (
    <div className="space-y-16 pt-16 border-t-8 border-zinc-900">
      <div className="flex items-center gap-12">
        <img src={LOGO_URL} alt="" className="w-16 h-16 invert opacity-20" referrerPolicy="no-referrer" />
        <h2 className="text-5xl font-black tracking-tighter uppercase text-white shrink-0">ADMIN: ORDERS.</h2>
        <div className="h-2 flex-grow bg-zinc-900" />
      </div>

      <div className="space-y-12">
        {orders.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm font-black uppercase tracking-[0.6em] py-32 border-8 border-dashed border-zinc-900">No orders yet.</p>
        ) : (
          orders.map(order => (
            <Card key={order.id} className="space-y-10 border-4 border-white shadow-none bg-zinc-950">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Order ID</span>
                    <p className="text-xs font-mono text-zinc-400">{order.id}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">User ID</span>
                    <p className="text-xs font-mono text-zinc-400">{order.uid}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Username</span>
                    <p className="text-2xl font-black tracking-tighter text-white uppercase">{order.username}</p>
                  </div>
                </div>
                
                <div className="space-y-6 text-right md:text-right">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Amount</span>
                    <p className="text-4xl font-black tracking-tighter text-white">${order.amount}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Status</span>
                    <div className="flex justify-end gap-2 flex-wrap">
                      {['pending', 'paid', 'shipped', 'cancelled'].map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(order.id, s)}
                          className={cn(
                            "text-[10px] px-4 py-1 font-black uppercase tracking-widest transition-all border-2",
                            order.status === s 
                              ? "bg-white text-black border-white" 
                              : "bg-transparent text-zinc-600 border-zinc-800 hover:border-zinc-500"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-black border-2 border-zinc-800 text-base font-black leading-relaxed text-white">
                <span className="font-black uppercase tracking-[0.4em] block mb-4 text-zinc-600 text-[10px]">Shipping Destination:</span>
                <p className="text-sm opacity-80">{order.shippingAddress}</p>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-8 pt-6 border-t border-zinc-900">
                <div className="flex gap-12">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700">Created</span>
                    <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700">Updated</span>
                    <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest">
                      {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => deleteOrder(order.id)}
                  className="w-16 h-16 border-2 border-red-900/30 text-red-900/50 hover:border-red-600 hover:text-red-500 flex items-center justify-center transition-all group"
                  title="Delete Order"
                >
                  <Trash2 size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

