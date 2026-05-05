import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import AuthScreen from "@/components/AuthScreen";
import { getToken, getStoredUser, logout, saveSession, updateProfile } from "@/lib/auth";

type Section = "chats" | "contacts" | "calls" | "profile";

const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

interface Reaction { emoji: string; count: number }
interface Message {
  id: number;
  text: string;
  time: string;
  out: boolean;
  photo?: string;
  reactions?: Reaction[];
  deleted?: boolean;
}
interface Chat {
  id: number;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: Message[];
  pinned?: boolean;
  customName?: string;
}
interface Contact {
  id: number;
  name: string;
  avatar: string;
  phone: string;
  online: boolean;
  status: string;
  customName?: string;
}
interface Call {
  id: number;
  name: string;
  avatar: string;
  type: "incoming" | "outgoing" | "missed";
  duration: string;
  date: string;
}
interface AppUser {
  id: number;
  login: string;
  name: string;
  bio: string;
  avatarPhoto?: string;
}

const AVATAR_COLORS: Record<string, string> = {};

function getAvatarColor(initials: string) {
  if (AVATAR_COLORS[initials]) return AVATAR_COLORS[initials];
  const palette = [
    "from-orange-400 to-orange-600",
    "from-violet-400 to-violet-600",
    "from-emerald-400 to-emerald-600",
    "from-amber-400 to-amber-600",
    "from-pink-400 to-pink-600",
    "from-cyan-400 to-cyan-600",
    "from-rose-400 to-rose-600",
    "from-teal-400 to-teal-600",
    "from-indigo-400 to-indigo-600",
    "from-lime-400 to-lime-600",
  ];
  const idx = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % palette.length;
  AVATAR_COLORS[initials] = palette[idx];
  return palette[idx];
}

function BeaverLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="10" fill="url(#bgrad)" />
      <defs>
        <linearGradient id="bgrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      {/* ears */}
      <ellipse cx="10" cy="9" rx="3.5" ry="4.5" fill="#fff" opacity="0.9" />
      <ellipse cx="22" cy="9" rx="3.5" ry="4.5" fill="#fff" opacity="0.9" />
      <ellipse cx="10" cy="9" rx="2" ry="3" fill="#fdba74" />
      <ellipse cx="22" cy="9" rx="2" ry="3" fill="#fdba74" />
      {/* head */}
      <ellipse cx="16" cy="17" rx="9" ry="8" fill="#fff" opacity="0.95" />
      {/* eyes */}
      <circle cx="13" cy="15" r="1.5" fill="#1e293b" />
      <circle cx="19" cy="15" r="1.5" fill="#1e293b" />
      <circle cx="13.6" cy="14.5" r="0.5" fill="#fff" />
      <circle cx="19.6" cy="14.5" r="0.5" fill="#fff" />
      {/* nose */}
      <ellipse cx="16" cy="18" rx="1.5" ry="1" fill="#fb923c" />
      {/* teeth */}
      <rect x="14" y="19.5" width="2" height="2.5" rx="0.5" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <line x1="15" y1="19.5" x2="15" y2="22" stroke="#e2e8f0" strokeWidth="0.5" />
      {/* tail hint */}
      <ellipse cx="16" cy="26" rx="5" ry="2" fill="#fdba74" opacity="0.5" />
    </svg>
  );
}

function Avatar({
  initials, size = "md", online, photo
}: { initials: string; size?: "sm" | "md" | "lg"; online?: boolean; photo?: string }) {
  const s = size === "sm" ? "w-9 h-9 text-xs" : size === "lg" ? "w-16 h-16 text-2xl" : "w-11 h-11 text-sm";
  const color = getAvatarColor(initials);
  return (
    <div className="relative shrink-0">
      {photo
        ? <img src={photo} alt={initials} className={`${s} rounded-2xl object-cover shadow-md`} />
        : <div className={`${s} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-semibold text-white shadow-md`}>{initials}</div>
      }
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-emerald-400" : "bg-slate-300"}`} />
      )}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="px-4 pt-4 pb-1 shrink-0">
      <div className="inline-block bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl px-4 py-1.5 shadow-sm">
        <span className="font-montserrat font-semibold text-slate-700 text-base">{title}</span>
      </div>
    </div>
  );
}

export default function Index() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());
  const [section, setSection] = useState<Section>("chats");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [contacts] = useState<Contact[]>([]);
  const [calls] = useState<Call[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", bio: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  // Message context menu
  const [msgMenu, setMsgMenu] = useState<{ msgId: number; x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat options menu
  const [chatMenu, setChatMenu] = useState<{ chatId: number; x: number; y: number } | null>(null);

  // Contact/chat person profile view
  const [viewProfile, setViewProfile] = useState<{ name: string; avatar: string; customName: string } | null>(null);

  // Photo upload
  const photoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) setCurrentUser(stored);
  }, []);

  useEffect(() => {
    const close = () => { setMsgMenu(null); setChatMenu(null); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleAuth = (user: AppUser) => setCurrentUser(user);
  const handleLogout = async () => { const t = getToken(); if (t) await logout(t); setCurrentUser(null); };

  const handleSaveProfile = async () => {
    const token = getToken();
    if (!token || !currentUser) return;
    setProfileLoading(true);
    await updateProfile(token, { name: profileDraft.name, bio: profileDraft.bio });
    const updated = { ...currentUser, name: profileDraft.name, bio: profileDraft.bio };
    saveSession(token, updated);
    setCurrentUser(updated);
    setEditingProfile(false);
    setProfileLoading(false);
  };

  // Send text message
  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;
    const msg: Message = {
      id: Date.now(), text: newMessage,
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      out: true
    };
    addMessageToChat(msg);
    setNewMessage("");
  };

  const addMessageToChat = (msg: Message) => {
    if (!activeChat) return;
    setChats(prev => prev.map(c =>
      c.id === activeChat.id
        ? { ...c, messages: [...c.messages, msg], lastMessage: msg.photo ? "📷 Фото" : msg.text, time: "сейчас" }
        : c
    ));
    setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
  };

  // Send photo
  const handlePhotoSend = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    const reader = new FileReader();
    reader.onload = () => {
      const msg: Message = {
        id: Date.now(), text: "", photo: reader.result as string,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        out: true
      };
      addMessageToChat(msg);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Avatar photo upload
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const reader = new FileReader();
    reader.onload = () => {
      const updated = { ...currentUser, avatarPhoto: reader.result as string };
      saveSession(getToken()!, updated);
      setCurrentUser(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Long press handlers
  const handleMsgLongPressStart = (e: React.TouchEvent | React.MouseEvent, msgId: number) => {
    const rect = (e.target as HTMLElement).closest("[data-msg]")?.getBoundingClientRect();
    longPressTimer.current = setTimeout(() => {
      const x = rect ? rect.left : 0;
      const y = rect ? rect.bottom + window.scrollY : 0;
      setMsgMenu({ msgId, x, y });
    }, 500);
  };

  const handleMsgLongPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const addReaction = (msgId: number, emoji: string) => {
    if (!activeChat) return;
    setChats(prev => prev.map(c => {
      if (c.id !== activeChat.id) return c;
      return {
        ...c, messages: c.messages.map(m => {
          if (m.id !== msgId) return m;
          const existing = (m.reactions || []).find(r => r.emoji === emoji);
          const reactions = existing
            ? (m.reactions || []).map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r)
            : [...(m.reactions || []), { emoji, count: 1 }];
          return { ...m, reactions };
        })
      };
    }));
    setActiveChat(prev => {
      if (!prev) return null;
      return {
        ...prev, messages: prev.messages.map(m => {
          if (m.id !== msgId) return m;
          const existing = (m.reactions || []).find(r => r.emoji === emoji);
          const reactions = existing
            ? (m.reactions || []).map(r => r.emoji === emoji ? { ...r, count: r.count + 1 } : r)
            : [...(m.reactions || []), { emoji, count: 1 }];
          return { ...m, reactions };
        })
      };
    });
    setMsgMenu(null);
  };

  const deleteMessage = (msgId: number) => {
    if (!activeChat) return;
    const update = (msgs: Message[]) => msgs.map(m => m.id === msgId ? { ...m, deleted: true, text: "Сообщение удалено", photo: undefined } : m);
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, messages: update(c.messages) } : c));
    setActiveChat(prev => prev ? { ...prev, messages: update(prev.messages) } : null);
    setMsgMenu(null);
  };

  // Pin / delete chat
  const togglePinChat = (chatId: number) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, pinned: !c.pinned } : c));
    setChatMenu(null);
  };

  const deleteChat = (chatId: number) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat?.id === chatId) setActiveChat(null);
    setChatMenu(null);
  };

  const handleChatRightClick = useCallback((e: React.MouseEvent, chatId: number) => {
    e.preventDefault();
    setChatMenu({ chatId, x: e.clientX, y: e.clientY });
  }, []);

  // Rename contact in chat
  const handleRenameViewProfile = (newName: string) => {
    if (!viewProfile) return;
    setChats(prev => prev.map(c =>
      c.name === viewProfile.name || c.customName === viewProfile.name
        ? { ...c, customName: newName }
        : c
    ));
    setViewProfile(prev => prev ? { ...prev, customName: newName } : null);
  };

  const totalUnread = chats.reduce((a, c) => a + c.unread, 0);

  const sortedChats = useMemo(() =>
    [...chats].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)),
    [chats]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matchedChats = chats.filter(c => (c.customName || c.name).toLowerCase().includes(q));
    const matchedMessages = chats.flatMap(c =>
      c.messages.filter(m => m.text.toLowerCase().includes(q))
        .map(m => ({ chatId: c.id, name: c.customName || c.name, avatar: c.avatar, ...m }))
    );
    const matchedContacts = contacts.filter(c => (c.customName || c.name).toLowerCase().includes(q) || c.phone.includes(q));
    return { chats: matchedChats, messages: matchedMessages, contacts: matchedContacts };
  }, [searchQuery, chats, contacts]);

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "calls", icon: "Phone", label: "Звонки" },
    { id: "profile", icon: "User", label: "Профиль" },
  ];

  if (!currentUser) return <AuthScreen onAuth={handleAuth} />;

  const userInitials = currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "?";

  return (
    <div className="min-h-screen flex items-center justify-center md:p-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-orange-100/30 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      {/* Context menus */}
      {msgMenu && (
        <div
          className="fixed z-50 bg-white/90 backdrop-blur-xl border border-white/80 rounded-2xl shadow-2xl p-2 animate-slide-up"
          style={{ left: Math.min(msgMenu.x, window.innerWidth - 220), top: Math.min(msgMenu.y + 8, window.innerHeight - 160) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex gap-1 px-1 py-1 mb-1">
            {REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => addReaction(msgMenu.msgId, emoji)}
                className="text-xl hover:scale-125 transition-transform w-9 h-9 flex items-center justify-center rounded-xl hover:bg-orange-50">
                {emoji}
              </button>
            ))}
          </div>
          <div className="border-t border-white/60 pt-1">
            <button onClick={() => deleteMessage(msgMenu.msgId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <Icon name="Trash2" size={14} /> Удалить
            </button>
          </div>
        </div>
      )}

      {chatMenu && (
        <div
          className="fixed z-50 bg-white/90 backdrop-blur-xl border border-white/80 rounded-2xl shadow-2xl p-1.5 animate-slide-up min-w-[160px]"
          style={{ left: Math.min(chatMenu.x, window.innerWidth - 180), top: Math.min(chatMenu.y, window.innerHeight - 120) }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => togglePinChat(chatMenu.chatId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 hover:bg-orange-50 rounded-xl transition-colors">
            <Icon name="Pin" size={14} className="text-orange-500" />
            {chats.find(c => c.id === chatMenu.chatId)?.pinned ? "Открепить" : "Закрепить"}
          </button>
          <button onClick={() => deleteChat(chatMenu.chatId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <Icon name="Trash2" size={14} /> Удалить чат
          </button>
        </div>
      )}

      {/* Person profile modal */}
      {viewProfile && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setViewProfile(null)}>
          <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-3xl shadow-2xl p-6 w-full max-w-xs animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-3 mb-4">
              <Avatar initials={viewProfile.avatar} size="lg" />
              <div className="text-center">
                <p className="font-montserrat font-semibold text-slate-700 text-xl">{viewProfile.customName || viewProfile.name}</p>
                <p className="text-sm text-slate-400">{viewProfile.name}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <input
                defaultValue={viewProfile.customName || viewProfile.name}
                onChange={e => setViewProfile(prev => prev ? { ...prev, customName: e.target.value } : null)}
                placeholder="Переименовать..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 text-sm"
              />
              <button onClick={() => { handleRenameViewProfile(viewProfile.customName || viewProfile.name); setViewProfile(null); }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white text-sm font-semibold shadow transition-all">
                Сохранить имя
              </button>
              <button onClick={() => setViewProfile(null)}
                className="w-full py-2 rounded-xl silver-btn text-slate-600 text-sm font-medium">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-5xl md:h-[88vh] h-screen flex flex-col md:flex-row md:rounded-3xl overflow-hidden animate-fade-in"
        style={{ background: "transparent" }}>

        {/* ── SIDEBAR (desktop) ── */}
        <div className="hidden md:flex w-72 flex-col shrink-0 m-3 mr-0 rounded-3xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: "1px solid rgba(255,255,255,0.75)", boxShadow: "0 8px 32px rgba(200,120,40,0.10)" }}>

          {/* Logo + Search */}
          <div className="p-4 pb-2">
            <div className="flex items-center gap-2.5 mb-3">
              <BeaverLogo size={34} />
              <span className="font-montserrat font-semibold text-slate-700 text-lg tracking-tight flex-1">BobroChat</span>
              <button onClick={() => { setSection("chats"); setActiveChat(null); }} title="Настройки"
                className="silver-btn p-1.5 rounded-lg">
                <Icon name="Settings" size={15} className="text-slate-400" />
              </button>
            </div>
            <div className="relative">
              <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 placeholder:text-slate-400 transition-all" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Search results */}
          {searchResults && (
            <div className="mx-3 mb-2 rounded-2xl bg-white/80 border border-white/90 overflow-hidden shadow-lg animate-slide-up max-h-60 overflow-y-auto scrollbar-thin">
              {searchResults.chats.length === 0 && searchResults.messages.length === 0 && searchResults.contacts.length === 0 && (
                <div className="p-4 text-center text-sm text-slate-400">Ничего не найдено</div>
              )}
              {searchResults.chats.length > 0 && (
                <div>
                  <div className="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Чаты</div>
                  {searchResults.chats.map(c => (
                    <button key={c.id} onClick={() => { setActiveChat(c); setSection("chats"); setSearchQuery(""); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50 transition-colors text-left">
                      <Avatar initials={c.avatar} size="sm" />
                      <span className="text-sm text-slate-700">{c.customName || c.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.messages.length > 0 && (
                <div>
                  <div className="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Сообщения</div>
                  {searchResults.messages.slice(0, 3).map(m => (
                    <button key={m.id} onClick={() => { const c = chats.find(ch => ch.id === m.chatId); if (c) { setActiveChat(c); setSection("chats"); setSearchQuery(""); } }}
                      className="w-full flex flex-col px-3 py-2 hover:bg-orange-50 transition-colors text-left">
                      <span className="text-xs text-slate-400">{m.name}</span>
                      <span className="text-sm text-slate-700 truncate">{m.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-3 py-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setSection(item.id); setActiveChat(null); }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  section === item.id ? "nav-active" : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
                }`}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.id === "chats" && totalUnread > 0 && (
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${section === "chats" ? "bg-white/25 text-white" : "bg-orange-500 text-white"}`}>
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* User footer */}
          <div className="mt-auto p-4 border-t border-white/50">
            <div className="flex items-center gap-3">
              <Avatar initials={userInitials} photo={currentUser.avatarPhoto} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700 truncate">{currentUser.name || currentUser.login}</div>
                <div className="text-xs text-emerald-500 font-medium">В сети</div>
              </div>
              <button onClick={handleLogout} className="silver-btn p-1.5 rounded-lg" title="Выйти">
                <Icon name="LogOut" size={15} className="text-slate-400 hover:text-red-400" />
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 m-3 ml-2 rounded-3xl"
          style={{ background: "rgba(255,255,255,0.50)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.70)", boxShadow: "0 8px 32px rgba(200,120,40,0.08)" }}>

          {/* MOBILE HEADER */}
          <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-white/50 shrink-0">
            <BeaverLogo size={28} />
            <span className="font-montserrat font-semibold text-slate-700 text-base tracking-tight flex-1">BobroChat</span>
            <button onClick={() => setSection("profile")}
              className="shrink-0">
              <Avatar initials={userInitials} size="sm" photo={currentUser.avatarPhoto} />
            </button>
          </div>

          {/* CHATS LIST */}
          {section === "chats" && !activeChat && (
            <div className="flex flex-col h-full overflow-hidden">
              <SectionTitle title="Сообщения" />
              <div className="px-4 pb-3 shrink-0 flex items-center gap-2">
                <div className="relative flex-1 md:hidden">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 placeholder:text-slate-400 transition-all" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="X" size={13} /></button>
                  )}
                </div>
                <button className="silver-btn p-2 rounded-xl shrink-0 ml-auto">
                  <Icon name="Settings" size={16} className="text-slate-500" />
                </button>
                <button className="silver-btn p-2 rounded-xl shrink-0">
                  <Icon name="Plus" size={18} className="text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-2">
                {sortedChats.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="MessageCircle" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет чатов</p>
                    <p className="text-sm text-slate-400">Начни новый разговор, нажав +</p>
                  </div>
                )}
                {sortedChats.map((chat, i) => (
                  <button key={chat.id} onClick={() => setActiveChat(chat)}
                    onContextMenu={e => handleChatRightClick(e, chat.id)}
                    className="w-full flex items-center gap-3.5 px-3 py-3 hover:bg-white/60 transition-all rounded-2xl text-left animate-slide-up mb-0.5"
                    style={{ animationDelay: `${i * 35}ms` }}>
                    <Avatar initials={chat.avatar} online={chat.online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="font-semibold text-slate-700 text-sm truncate flex items-center gap-1">
                          {chat.pinned && <Icon name="Pin" size={11} className="text-orange-400 shrink-0" />}
                          {chat.customName || chat.name}
                        </span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">{chat.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 truncate">{chat.lastMessage}</span>
                        {chat.unread > 0 && (
                          <span className="ml-2 shrink-0 text-xs font-bold bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center">{chat.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT WINDOW */}
          {section === "chats" && activeChat && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/50 shrink-0">
                <button onClick={() => setActiveChat(null)} className="silver-btn p-2 rounded-xl">
                  <Icon name="ChevronLeft" size={18} className="text-slate-500" />
                </button>
                <button onClick={() => setViewProfile({ name: activeChat.name, avatar: activeChat.avatar, customName: activeChat.customName || "" })}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
                  <Avatar initials={activeChat.avatar} online={activeChat.online} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 text-sm">{activeChat.customName || activeChat.name}</div>
                    <div className={`text-xs font-medium ${activeChat.online ? "text-emerald-500" : "text-slate-400"}`}>
                      {activeChat.online ? "В сети" : "Не в сети"}
                    </div>
                  </div>
                </button>
                <div className="flex gap-2">
                  <button className="silver-btn p-2 rounded-xl"><Icon name="Phone" size={16} className="text-slate-500" /></button>
                  <button className="silver-btn p-2 rounded-xl"><Icon name="Video" size={16} className="text-slate-500" /></button>
                  <button onClick={e => { e.stopPropagation(); handleChatRightClick(e as unknown as React.MouseEvent, activeChat.id); }}
                    className="silver-btn p-2 rounded-xl"><Icon name="MoreVertical" size={16} className="text-slate-500" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-2">
                {activeChat.messages.map((msg, i) => (
                  <div key={msg.id} data-msg className={`flex ${msg.out ? "justify-end" : "justify-start"} animate-slide-up`}
                    style={{ animationDelay: `${i * 20}ms` }}
                    onMouseDown={e => !msg.deleted && handleMsgLongPressStart(e, msg.id)}
                    onMouseUp={handleMsgLongPressEnd}
                    onMouseLeave={handleMsgLongPressEnd}
                    onTouchStart={e => !msg.deleted && handleMsgLongPressStart(e, msg.id)}
                    onTouchEnd={handleMsgLongPressEnd}>
                    <div className={`max-w-xs lg:max-w-sm ${msg.deleted ? "opacity-50" : ""}`}>
                      <div className={`px-4 py-2.5 shadow-sm ${msg.out ? "message-out" : "message-in text-slate-700"} ${msg.photo ? "p-1.5" : ""}`}>
                        {msg.photo && !msg.deleted && (
                          <img src={msg.photo} alt="фото" className="rounded-xl max-w-[220px] max-h-[220px] object-cover" />
                        )}
                        {msg.text && <p className={`text-sm leading-relaxed ${msg.photo ? "mt-1 px-2" : ""} ${msg.deleted ? "italic text-slate-400" : ""}`}>{msg.text}</p>}
                        <p className={`text-xs mt-1 text-right ${msg.out ? "text-orange-100" : "text-slate-400"} ${msg.photo ? "px-2 pb-1" : ""}`}>{msg.time}</p>
                      </div>
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className={`flex gap-1 mt-1 flex-wrap ${msg.out ? "justify-end" : "justify-start"}`}>
                          {msg.reactions.map(r => (
                            <span key={r.emoji} className="text-xs bg-white/80 border border-white/60 rounded-full px-2 py-0.5 shadow-sm">
                              {r.emoji} {r.count > 1 && r.count}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-white/50 shrink-0">
                <input type="file" accept="image/*" ref={photoInputRef} className="hidden" onChange={handlePhotoSend} />
                <div className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-2xl px-3 py-2.5">
                  <button onClick={() => photoInputRef.current?.click()}
                    className="text-slate-400 hover:text-orange-500 transition-colors shrink-0">
                    <Icon name="Image" size={18} />
                  </button>
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Написать сообщение..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none min-w-0" />
                  <button className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                    <Icon name="Smile" size={18} />
                  </button>
                  <button onClick={sendMessage}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0">
                    <Icon name="Send" size={14} className="text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONTACTS */}
          {section === "contacts" && (
            <div className="flex flex-col h-full animate-fade-in">
              <SectionTitle title="Контакты" />
              <div className="px-4 pb-2 flex items-center justify-between shrink-0">
                <p className="text-xs text-slate-400">{contacts.filter(c => c.online).length} онлайн · {contacts.length} всего</p>
                <button className="silver-btn p-2 rounded-xl">
                  <Icon name="UserPlus" size={16} className="text-slate-500" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 flex flex-col gap-2">
                {contacts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="Users" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет контактов</p>
                    <p className="text-sm text-slate-400">Добавь первый контакт выше</p>
                  </div>
                )}
                {contacts.map((contact, i) => (
                  <div key={contact.id} className="bg-white/60 border border-white/70 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <button onClick={() => setViewProfile({ name: contact.name, avatar: contact.avatar, customName: contact.customName || "" })}>
                      <Avatar initials={contact.avatar} online={contact.online} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => setViewProfile({ name: contact.name, avatar: contact.avatar, customName: contact.customName || "" })}
                        className="font-semibold text-slate-700 text-sm hover:text-orange-600 transition-colors text-left">
                        {contact.customName || contact.name}
                      </button>
                      <div className="text-xs text-slate-400 mt-0.5">{contact.status}</div>
                      <div className="text-xs text-slate-300">{contact.phone}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="silver-btn p-2 rounded-xl"><Icon name="MessageCircle" size={15} className="text-orange-500" /></button>
                      <button className="silver-btn p-2 rounded-xl"><Icon name="Phone" size={15} className="text-slate-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CALLS */}
          {section === "calls" && (
            <div className="flex flex-col h-full animate-fade-in">
              <SectionTitle title="Звонки" />
              <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3 flex flex-col gap-2">
                {calls.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="Phone" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет звонков</p>
                    <p className="text-sm text-slate-400">История звонков появится здесь</p>
                  </div>
                )}
                {calls.map((call, i) => (
                  <div key={call.id} className="bg-white/60 border border-white/70 rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <Avatar initials={call.avatar} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 text-sm">{call.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon name={call.type === "incoming" ? "PhoneIncoming" : call.type === "outgoing" ? "PhoneOutgoing" : "PhoneMissed"} size={13}
                          className={call.type === "missed" ? "text-red-400" : call.type === "incoming" ? "text-emerald-500" : "text-orange-500"} />
                        <span className={`text-xs ${call.type === "missed" ? "text-red-400" : "text-slate-400"}`}>
                          {call.type === "incoming" ? "Входящий" : call.type === "outgoing" ? "Исходящий" : "Пропущенный"}
                        </span>
                        {call.duration !== "—" && <><span className="text-xs text-slate-300">·</span><span className="text-xs text-slate-400">{call.duration}</span></>}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{call.date}</div>
                    </div>
                    <button className="silver-btn p-2.5 rounded-xl"><Icon name="Phone" size={16} className="text-orange-500" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROFILE */}
          {section === "profile" && (
            <div className="flex flex-col h-full animate-fade-in overflow-y-auto scrollbar-thin">
              <SectionTitle title="Профиль" />
              <div className="p-6 flex flex-col items-center border-b border-white/50 text-center shrink-0">
                <input type="file" accept="image/*" ref={avatarInputRef} className="hidden" onChange={handleAvatarUpload} />
                <button onClick={() => avatarInputRef.current?.click()} className="relative group mb-4">
                  {currentUser.avatarPhoto
                    ? <img src={currentUser.avatarPhoto} alt="avatar" className="w-24 h-24 rounded-3xl object-cover shadow-2xl ring-4 ring-white/80" />
                    : <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-2xl ring-4 ring-white/80">
                        {userInitials}
                      </div>
                  }
                  <div className="absolute inset-0 rounded-3xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon name="Camera" size={20} className="text-white" />
                  </div>
                </button>
                {editingProfile ? (
                  <div className="w-full flex flex-col items-center gap-3">
                    <input value={profileDraft.name} onChange={e => setProfileDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Ваше имя"
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 text-center text-lg font-semibold" />
                    <textarea value={profileDraft.bio} onChange={e => setProfileDraft(d => ({ ...d, bio: e.target.value }))}
                      placeholder="О себе" rows={2}
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-500 text-center text-sm resize-none" />
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} disabled={profileLoading}
                        className="px-5 py-2 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60">
                        {profileLoading ? "Сохраняем..." : "Сохранить"}
                      </button>
                      <button onClick={() => setEditingProfile(false)} className="px-5 py-2 rounded-xl silver-btn text-slate-600 text-sm font-medium">Отмена</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="font-montserrat font-semibold text-slate-700 text-2xl">{currentUser.name || "Нет имени"}</h2>
                    <p className="text-emerald-500 text-sm font-medium mt-1">В сети</p>
                    <p className="text-slate-400 text-sm mt-0.5">@{currentUser.login}</p>
                    <button onClick={() => { setEditingProfile(true); setProfileDraft({ name: currentUser.name || "", bio: currentUser.bio || "" }); }}
                      className="mt-3 px-4 py-1.5 rounded-xl silver-btn text-slate-600 text-sm font-medium flex items-center gap-1.5">
                      <Icon name="Pencil" size={13} /> Редактировать
                    </button>
                  </>
                )}
              </div>
              <div className="p-4 flex flex-col gap-3">
                {[
                  { icon: "AtSign", label: "Логин", value: `@${currentUser.login}` },
                  { icon: "Info", label: "О себе", value: currentUser.bio || "Привет, я использую BobroChat!" },
                ].map(item => (
                  <div key={item.label} className="bg-white/60 border border-white/70 rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <Icon name={item.icon} size={18} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400">{item.label}</div>
                      <div className="text-sm font-medium text-slate-700 mt-0.5">{item.value}</div>
                    </div>
                  </div>
                ))}
                <div className="bg-white/60 border border-white/70 rounded-2xl overflow-hidden">
                  {[
                    { icon: "Bell", label: "Уведомления" },
                    { icon: "Lock", label: "Конфиденциальность" },
                    { icon: "LogOut", label: "Выйти" },
                  ].map((item, j) => (
                    <button key={item.label} onClick={item.label === "Выйти" ? handleLogout : undefined}
                      className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/60 transition-colors text-left ${j > 0 ? "border-t border-white/50" : ""}`}>
                      <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                        <Icon name={item.icon} size={16} className={item.label === "Выйти" ? "text-red-400" : "text-orange-500"} />
                      </div>
                      <span className={`text-sm font-medium flex-1 ${item.label === "Выйти" ? "text-red-400" : "text-slate-700"}`}>{item.label}</span>
                      <Icon name="ChevronRight" size={15} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="md:hidden shrink-0 flex justify-center pb-3 pt-1 px-4"
          style={{ background: "transparent" }}>
          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl px-2 py-1.5 shadow-xl">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setSection(item.id); setActiveChat(null); }}
                className={`relative flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl transition-all duration-200 ${
                  section === item.id ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                }`}>
                <Icon name={item.icon} size={20} />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {item.id === "chats" && totalUnread > 0 && section !== "chats" && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{totalUnread}</span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
