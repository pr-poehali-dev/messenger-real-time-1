import { useState } from "react";
import Icon from "@/components/ui/icon";
import { sendOtp, verifyOtp, saveSession } from "@/lib/auth";

type Step = "phone" | "code" | "name";

interface Props {
  onAuth: (user: { id: number; phone: string; name: string; username: string; bio: string }) => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (v: string) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 0) return "";
    let result = "+7";
    if (digits.length > 1) result += " (" + digits.slice(1, 4);
    if (digits.length >= 4) result += ") " + digits.slice(4, 7);
    if (digits.length >= 7) result += "-" + digits.slice(7, 9);
    if (digits.length >= 9) result += "-" + digits.slice(9, 11);
    return result;
  };

  const handlePhoneChange = (v: string) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length <= 11) setPhone(formatPhone(v));
  };

  const rawPhone = () => "+7" + phone.replace(/\D/g, "").slice(1);

  const handleSendCode = async () => {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 11) { setError("Введите полный номер телефона"); return; }
    setLoading(true);
    const res = await sendOtp(rawPhone());
    setLoading(false);
    if (res.ok) {
      setDemoCode(res.demo_code || "");
      setStep("code");
    } else {
      setError(res.error || "Ошибка отправки");
    }
  };

  const handleVerifyCode = async () => {
    setError("");
    if (code.length < 6) { setError("Введите 6-значный код"); return; }
    setLoading(true);
    const res = await verifyOtp(rawPhone(), code);
    setLoading(false);
    if (res.ok) {
      saveSession(res.token, res.user);
      if (res.is_new) {
        setStep("name");
      } else {
        onAuth(res.user);
      }
    } else {
      setError(res.error || "Неверный код");
    }
  };

  const handleSetName = async () => {
    setError("");
    if (!name.trim()) { setError("Введите ваше имя"); return; }
    setLoading(true);
    const { updateProfile, getToken, getStoredUser } = await import("@/lib/auth");
    const token = getToken();
    const user = getStoredUser();
    if (token) {
      await updateProfile(token, { name: name.trim() });
      saveSession(token, { ...user, name: name.trim() });
      onAuth({ ...user, name: name.trim() });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/30 blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-violet-200/20 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-sky-200/25 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="glass rounded-3xl p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-xl mb-4">
              <Icon name="Zap" size={28} className="text-white" />
            </div>
            <h1 className="font-montserrat font-semibold text-slate-700 text-2xl">Prime Chat</h1>
            <p className="text-slate-400 text-sm mt-1 text-center">
              {step === "phone" && "Введите номер телефона для входа"}
              {step === "code" && "Введите код из SMS"}
              {step === "name" && "Как вас зовут?"}
            </p>
          </div>

          {/* Step: PHONE */}
          {step === "phone" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Номер телефона</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-lg">🇷🇺</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSendCode()}
                    placeholder="+7 (000) 000-00-00"
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-base transition-all"
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-400 text-center animate-fade-in">{error}</p>}
              <button
                onClick={handleSendCode}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="Loader2" size={18} className="animate-spin" />
                    Отправляем...
                  </span>
                ) : (
                  "Получить код"
                )}
              </button>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Мы отправим SMS с кодом подтверждения
              </p>
            </div>
          )}

          {/* Step: CODE */}
          {step === "code" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Код из SMS</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={e => e.key === "Enter" && handleVerifyCode()}
                  placeholder="000000"
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-2xl font-mono tracking-widest text-center transition-all"
                  autoFocus
                  maxLength={6}
                />
              </div>
              {demoCode && (
                <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 border border-amber-200/60 bg-amber-50/50">
                  <Icon name="Info" size={15} className="text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700">Демо-код: <strong className="font-mono">{demoCode}</strong></span>
                </div>
              )}
              {error && <p className="text-sm text-red-400 text-center animate-fade-in">{error}</p>}
              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length < 6}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="Loader2" size={18} className="animate-spin" />
                    Проверяем...
                  </span>
                ) : (
                  "Войти"
                )}
              </button>
              <button onClick={() => { setStep("phone"); setCode(""); setError(""); }} className="text-sm text-slate-400 hover:text-slate-600 transition-colors text-center">
                Изменить номер
              </button>
            </div>
          )}

          {/* Step: NAME */}
          {step === "name" && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="text-center mb-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl mx-auto mb-3">
                  <Icon name="UserCheck" size={28} className="text-white" />
                </div>
                <p className="text-slate-500 text-sm">Вы новый пользователь! Укажите имя</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Ваше имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSetName()}
                  placeholder="Имя Фамилия"
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/60 border border-white/80 focus:outline-none focus:ring-2 focus:ring-blue-300/50 text-slate-700 placeholder:text-slate-400 text-base transition-all"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-400 text-center animate-fade-in">{error}</p>}
              <button
                onClick={handleSetName}
                disabled={loading || !name.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Icon name="Loader2" size={18} className="animate-spin" />
                    Сохраняем...
                  </span>
                ) : "Начать общение"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}