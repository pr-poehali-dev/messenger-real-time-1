import { useState, useMemo, useEffect } from "react";
import Icon from "@/components/ui/icon";
import AuthScreen from "@/components/AuthScreen";
import { getToken, getStoredUser, logout, saveSession, updateProfile } from "@/lib/auth";

type Section = "chats" | "contacts" | "calls" | "profile" | "settings";

interface Message {
  id: number;
  text: string;
  time: string;
  out: boolean;
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
}

interface Contact {
  id: number;
  name: string;
  avatar: string;
  phone: string;
  online: boolean;
  status: string;
}

interface Call {
  id: number;
  name: string;
  avatar: string;
  type: "incoming" | "outgoing" | "missed";
  duration: string;
  date: string;
}

const INITIAL_CHATS: Chat[] = [];

const CONTACTS: Contact[] = [];

const CALLS: Call[] = [];

const avatarColors: Record<string, string> = {
  "АС": "from-orange-400 to-orange-600",
  "МИ": "from-violet-400 to-violet-600",
  "ПX": "from-emerald-400 to-emerald-600",
  "ДК": "from-amber-400 to-amber-600",
  "ЕП": "from-pink-400 to-pink-600",
  "НФ": "from-cyan-400 to-cyan-600",
  "ОС": "from-rose-400 to-rose-600",
  "ПГ": "from-teal-400 to-teal-600",
};

function Avatar({ initials, size = "md", online }: { initials: string; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const s = size === "sm" ? "w-9 h-9 text-sm" : size === "lg" ? "w-16 h-16 text-2xl" : "w-11 h-11 text-sm";
  const color = avatarColors[initials] || "from-slate-400 to-slate-600";
  return (
    <div className="relative shrink-0">
      <div className={`${s} rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center font-semibold text-white shadow-md`}>
        {initials}
      </div>
      {online !== undefined && (
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${online ? "bg-emerald-400" : "bg-slate-300"}`} />
      )}
    </div>
  );
}

interface AppUser {
  id: number;
  login: string;
  name: string;
  bio: string;
}

export default function Index() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredUser());
  const [section, setSection] = useState<Section>("chats");
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", bio: "" });
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) setCurrentUser(stored);
  }, []);

  const handleAuth = (user: AppUser) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    const token = getToken();
    if (token) await logout(token);
    setCurrentUser(null);
  };

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

  const navItems: { id: Section; icon: string; label: string }[] = [
    { id: "chats", icon: "MessageCircle", label: "Чаты" },
    { id: "contacts", icon: "Users", label: "Контакты" },
    { id: "calls", icon: "Phone", label: "Звонки" },
    { id: "profile", icon: "User", label: "Профиль" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const matchedChats = chats.filter(c => c.name.toLowerCase().includes(q));
    const matchedMessages = chats.flatMap(c =>
      c.messages
        .filter(m => m.text.toLowerCase().includes(q))
        .map(m => ({ chatId: c.id, name: c.name, avatar: c.avatar, ...m }))
    );
    const matchedContacts = CONTACTS.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    return { chats: matchedChats, messages: matchedMessages, contacts: matchedContacts };
  }, [searchQuery, chats]);

  const sendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;
    const msg: Message = {
      id: Date.now(),
      text: newMessage,
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      out: true
    };
    setChats(prev => prev.map(c =>
      c.id === activeChat.id ? { ...c, messages: [...c.messages, msg], lastMessage: newMessage, time: "сейчас" } : c
    ));
    setActiveChat(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : null);
    setNewMessage("");
  };

  const totalUnread = chats.reduce((a, c) => a + c.unread, 0);

  if (!currentUser) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center md:p-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-orange-100/30 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl md:h-[88vh] h-screen flex flex-col md:flex-row md:rounded-3xl overflow-hidden glass shadow-2xl animate-fade-in">

        {/* ── SIDEBAR (desktop) ── */}
        <div className="hidden md:flex w-72 flex-col glass-dark border-r border-white/60 shrink-0">

          {/* Logo + Search */}
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
                <Icon name="Zap" size={16} className="text-white" />
              </div>
              <span className="font-montserrat font-semibold text-slate-700 text-lg tracking-tight">BobroChat</span>
            </div>
            <div className="relative">
              <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по всему..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 placeholder:text-slate-400 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Search results dropdown */}
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
                      <span className="text-sm text-slate-700">{c.name}</span>
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
              {searchResults.contacts.length > 0 && (
                <div>
                  <div className="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Контакты</div>
                  {searchResults.contacts.map(c => (
                    <button key={c.id} onClick={() => { setSection("contacts"); setSearchQuery(""); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50 transition-colors text-left">
                      <Avatar initials={c.avatar} size="sm" />
                      <span className="text-sm text-slate-700">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-3 py-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setActiveChat(null); }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200 ${
                  section === item.id
                    ? "nav-active"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
                }`}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.id === "chats" && totalUnread > 0 && (
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                    section === "chats" ? "bg-white/25 text-white" : "bg-orange-500 text-white"
                  }`}>
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* User footer */}
          <div className="mt-auto p-4 border-t border-white/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold shadow">
                {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "?"}
              </div>
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

        {/* ── MOBILE HEADER ── */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 glass-dark border-b border-white/60 shrink-0">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
            <Icon name="Zap" size={14} className="text-white" />
          </div>
          <span className="font-montserrat font-semibold text-slate-700 text-base tracking-tight flex-1">BobroChat</span>
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-semibold shadow">
            {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "?"}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">

          {/* CHATS LIST */}
          {section === "chats" && !activeChat && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 pb-3 border-b border-white/50 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-montserrat font-semibold text-slate-700 text-xl">Сообщения</h2>
                  <button className="silver-btn p-2 rounded-xl">
                    <Icon name="Plus" size={18} className="text-slate-500" />
                  </button>
                </div>
                {/* Search — mobile only */}
                <div className="relative md:hidden">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Поиск..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-sm bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 placeholder:text-slate-400 transition-all"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <Icon name="X" size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {chats.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="MessageCircle" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет чатов</p>
                    <p className="text-sm text-slate-400">Начни новый разговор, нажав кнопку +</p>
                  </div>
                )}
                {chats.map((chat, i) => (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat)}
                    className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/50 transition-all border-b border-white/30 text-left animate-slide-up"
                    style={{ animationDelay: `${i * 35}ms` }}
                  >
                    <Avatar initials={chat.avatar} online={chat.online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between mb-0.5">
                        <span className="font-semibold text-slate-700 text-sm truncate">{chat.name}</span>
                        <span className="text-xs text-slate-400 shrink-0 ml-2">{chat.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 truncate">{chat.lastMessage}</span>
                        {chat.unread > 0 && (
                          <span className="ml-2 shrink-0 text-xs font-bold bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center">
                            {chat.unread}
                          </span>
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
              <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/50 glass-dark shrink-0">
                <button onClick={() => setActiveChat(null)} className="silver-btn p-2 rounded-xl">
                  <Icon name="ChevronLeft" size={18} className="text-slate-500" />
                </button>
                <Avatar initials={activeChat.avatar} online={activeChat.online} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-700 text-sm">{activeChat.name}</div>
                  <div className={`text-xs font-medium ${activeChat.online ? "text-emerald-500" : "text-slate-400"}`}>
                    {activeChat.online ? "В сети" : "Не в сети"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="silver-btn p-2 rounded-xl"><Icon name="Phone" size={16} className="text-slate-500" /></button>
                  <button className="silver-btn p-2 rounded-xl"><Icon name="Video" size={16} className="text-slate-500" /></button>
                  <button className="silver-btn p-2 rounded-xl"><Icon name="MoreVertical" size={16} className="text-slate-500" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 flex flex-col gap-3">
                {activeChat.messages.map((msg, i) => (
                  <div key={msg.id} className={`flex ${msg.out ? "justify-end" : "justify-start"} animate-slide-up`} style={{ animationDelay: `${i * 30}ms` }}>
                    <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 shadow-sm ${msg.out ? "message-out" : "message-in text-slate-700"}`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <p className={`text-xs mt-1 text-right ${msg.out ? "text-orange-100" : "text-slate-400"}`}>{msg.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-white/50 shrink-0">
                <div className="flex items-center gap-3 glass rounded-2xl px-4 py-3">
                  <button className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                    <Icon name="Paperclip" size={18} />
                  </button>
                  <input
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Написать сообщение..."
                    className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none min-w-0"
                  />
                  <button className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                    <Icon name="Smile" size={18} />
                  </button>
                  <button
                    onClick={sendMessage}
                    className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shrink-0"
                  >
                    <Icon name="Send" size={14} className="text-white" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CONTACTS */}
          {section === "contacts" && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="p-5 pb-3 border-b border-white/50 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-montserrat font-semibold text-slate-700 text-xl">Контакты</h2>
                  <button className="silver-btn p-2 rounded-xl">
                    <Icon name="UserPlus" size={18} className="text-slate-500" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">{CONTACTS.filter(c => c.online).length} онлайн · {CONTACTS.length} всего</p>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-2">
                {CONTACTS.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="Users" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет контактов</p>
                    <p className="text-sm text-slate-400">Добавь первый контакт, нажав кнопку выше</p>
                  </div>
                )}
                {CONTACTS.map((contact, i) => (
                  <div key={contact.id} className="glass rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <Avatar initials={contact.avatar} online={contact.online} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 text-sm">{contact.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{contact.status}</div>
                      <div className="text-xs text-slate-300">{contact.phone}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="silver-btn p-2 rounded-xl">
                        <Icon name="MessageCircle" size={15} className="text-orange-500" />
                      </button>
                      <button className="silver-btn p-2 rounded-xl">
                        <Icon name="Phone" size={15} className="text-slate-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CALLS */}
          {section === "calls" && (
            <div className="flex flex-col h-full animate-fade-in">
              <div className="p-5 pb-3 border-b border-white/50 shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="font-montserrat font-semibold text-slate-700 text-xl">Звонки</h2>
                  <button className="silver-btn p-2 rounded-xl">
                    <Icon name="PhoneCall" size={18} className="text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-2">
                {CALLS.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center">
                      <Icon name="Phone" size={28} className="text-orange-300" />
                    </div>
                    <p className="font-montserrat font-semibold text-slate-600">Нет звонков</p>
                    <p className="text-sm text-slate-400">История звонков появится здесь</p>
                  </div>
                )}
                {CALLS.map((call, i) => (
                  <div key={call.id} className="glass rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <Avatar initials={call.avatar} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-700 text-sm">{call.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Icon
                          name={call.type === "incoming" ? "PhoneIncoming" : call.type === "outgoing" ? "PhoneOutgoing" : "PhoneMissed"}
                          size={13}
                          className={call.type === "missed" ? "text-red-400" : call.type === "incoming" ? "text-emerald-500" : "text-orange-500"}
                        />
                        <span className={`text-xs ${call.type === "missed" ? "text-red-400" : "text-slate-400"}`}>
                          {call.type === "incoming" ? "Входящий" : call.type === "outgoing" ? "Исходящий" : "Пропущенный"}
                        </span>
                        {call.duration !== "—" && <span className="text-xs text-slate-300">·</span>}
                        {call.duration !== "—" && <span className="text-xs text-slate-400">{call.duration}</span>}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5">{call.date}</div>
                    </div>
                    <button className="silver-btn p-2.5 rounded-xl">
                      <Icon name="Phone" size={16} className="text-orange-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PROFILE */}
          {section === "profile" && (
            <div className="flex flex-col h-full animate-fade-in overflow-y-auto scrollbar-thin">
              <div className="p-8 flex flex-col items-center border-b border-white/50 text-center shrink-0">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl font-bold shadow-2xl mb-4 ring-4 ring-white/80">
                  {currentUser.name ? currentUser.name.slice(0, 2).toUpperCase() : "?"}
                </div>
                {editingProfile ? (
                  <div className="w-full flex flex-col items-center gap-3 mt-1">
                    <input
                      value={profileDraft.name}
                      onChange={e => setProfileDraft(d => ({ ...d, name: e.target.value }))}
                      placeholder="Ваше имя"
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-700 text-center text-lg font-semibold"
                    />
                    <textarea
                      value={profileDraft.bio}
                      onChange={e => setProfileDraft(d => ({ ...d, bio: e.target.value }))}
                      placeholder="О себе"
                      rows={2}
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-orange-300/50 text-slate-500 text-center text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} disabled={profileLoading}
                        className="px-5 py-2 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-white text-sm font-semibold shadow hover:shadow-md transition-all disabled:opacity-60">
                        {profileLoading ? "Сохраняем..." : "Сохранить"}
                      </button>
                      <button onClick={() => setEditingProfile(false)} className="px-5 py-2 rounded-xl silver-btn text-slate-600 text-sm font-medium">
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="font-montserrat font-semibold text-slate-700 text-2xl">{currentUser.name || "Нет имени"}</h2>
                    <p className="text-emerald-500 text-sm font-medium mt-1">В сети</p>
                    <p className="text-slate-400 text-sm mt-0.5">@{currentUser.login}</p>
                    <button onClick={() => { setEditingProfile(true); setProfileDraft({ name: currentUser.name || "", bio: currentUser.bio || "" }); }}
                      className="mt-3 px-4 py-1.5 rounded-xl silver-btn text-slate-600 text-sm font-medium flex items-center gap-1.5">
                      <Icon name="Pencil" size={13} />
                      Редактировать
                    </button>
                  </>
                )}
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  { icon: "AtSign", label: "Логин", value: `@${currentUser.login}` },
                  { icon: "Info", label: "О себе", value: currentUser.bio || "Привет, я использую BobroChat!" },
                ].map(item => (
                  <div key={item.label} className="glass rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <Icon name={item.icon} size={18} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400">{item.label}</div>
                      <div className="text-sm font-medium text-slate-700 mt-0.5">{item.value}</div>
                    </div>
                    <div className="silver-btn p-1.5 rounded-lg shrink-0 opacity-0">
                      <Icon name="ChevronRight" size={15} className="text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {section === "settings" && (
            <div className="flex flex-col h-full animate-fade-in overflow-y-auto scrollbar-thin">
              <div className="p-5 pb-3 border-b border-white/50 shrink-0">
                <h2 className="font-montserrat font-semibold text-slate-700 text-xl">Настройки</h2>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {[
                  { group: "Приватность", items: [{ icon: "Lock", label: "Конфиденциальность" }, { icon: "Bell", label: "Уведомления" }] },
                  { group: "Внешний вид", items: [{ icon: "Palette", label: "Тема оформления" }, { icon: "Type", label: "Размер шрифта" }] },
                  { group: "Аккаунт", items: [{ icon: "Shield", label: "Безопасность" }, { icon: "HelpCircle", label: "Помощь" }, { icon: "LogOut", label: "Выйти" }] },
                ].map(group => (
                  <div key={group.group}>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2 mt-1">{group.group}</div>
                    <div className="glass rounded-2xl overflow-hidden">
                      {group.items.map((item, j) => (
                        <button
                          key={item.label}
                          onClick={item.label === "Выйти" ? handleLogout : undefined}
                          className={`w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/60 transition-colors text-left ${j > 0 ? "border-t border-white/50" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                            <Icon name={item.icon} size={16} className={item.label === "Выйти" ? "text-red-400" : "text-orange-500"} />
                          </div>
                          <span className={`text-sm font-medium flex-1 text-left ${item.label === "Выйти" ? "text-red-400" : "text-slate-700"}`}>{item.label}</span>
                          <Icon name="ChevronRight" size={15} className="text-slate-300" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="md:hidden shrink-0 px-4 py-3 flex justify-center border-t border-white/40 glass-dark">
          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-xl border border-white/80 rounded-2xl px-2 py-1.5 shadow-xl">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setActiveChat(null); }}
                className={`relative flex flex-col items-center gap-0.5 px-3.5 py-2 rounded-xl transition-all duration-200 ${
                  section === item.id
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icon name={item.icon} size={20} />
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
                {item.id === "chats" && totalUnread > 0 && section !== "chats" && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}