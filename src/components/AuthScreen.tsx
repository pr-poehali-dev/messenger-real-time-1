import { useState } from "react";
import Icon from "@/components/ui/icon";
import { register, login, saveSession } from "@/lib/auth";

type Mode = "login" | "register";

interface AppUser {
  id: number;
  login: string;
  name: string;
  bio: string;
}

interface Props {
  onAuth: (user: AppUser) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [loginVal, setLoginVal] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (m: Mode) => {
    setMode(m);
    setError("");
    setLoginVal("");
    setPassword("");
    setName("");
  };

  const handleSubmit = async () => {
    setError("");
    if (!loginVal.trim() || !password.trim()) {
      setError("Заполните все поля");
      return;
    }
    if (mode === "register" && !name.trim()) {
      setError("Укажите ваше имя");
      return;
    }

    setLoading(true);
    const res = mode === "register"
      ? await register(loginVal.trim(), password, name.trim())
      : await login(loginVal.trim(), password);
    setLoading(false);

    if (res.ok) {
      saveSession(res.token, res.user);
      onAuth(res.user);
    } else {
      setError(res.error || "Что-то пошло не так");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="glass rounded-3xl p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl mb-4">
              <Icon name="Zap" size={28} className="text-white" />
            </div>
            <h1 className="font-montserrat font-semibold text-slate-700 text-2xl">Prime Chat</h1>
            <p className="text-slate-400 text-sm mt-1">
              {mode === "login" ? "Войдите в свой аккаунт" : "Создайте новый аккаунт"}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex rounded-2xl bg-white/50 border border-white/80 p-1 mb-6">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === "login" ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Войти
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === "register" ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Регистрация
            </button>
          </div>

          <div className="flex flex-col gap-4 animate-fade-in" key={mode}>

            {/* Name — только при регистрации */}
            {mode === "register" && (
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Ваше имя</label>
                <div className="relative">
                  <Icon name="User" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="Имя Фамилия"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-sm transition-all"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Login */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Логин</label>
              <div className="relative">
                <Icon name="AtSign" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder="your_login"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-sm transition-all"
                  autoFocus={mode === "login"}
                  autoComplete="username"
                />
              </div>
              {mode === "register" && (
                <p className="text-xs text-slate-400 mt-1 ml-1">Только латинские буквы, цифры, _ и .</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Пароль</label>
              <div className="relative">
                <Icon name="Lock" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSubmit()}
                  placeholder={mode === "register" ? "Минимум 6 символов" : "••••••••"}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-sm transition-all"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <Icon name={showPass ? "EyeOff" : "Eye"} size={16} />
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50/80 border border-red-100">
                <Icon name="AlertCircle" size={15} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Icon name="Loader2" size={18} className="animate-spin" />
                  {mode === "login" ? "Входим..." : "Создаём аккаунт..."}
                </span>
              ) : (
                mode === "login" ? "Войти" : "Создать аккаунт"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
