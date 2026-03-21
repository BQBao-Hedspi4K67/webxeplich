import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, ChevronRight, Wifi } from 'lucide-react';
import apiClient from '../services/api';

const Login = ({ onLogin }) => {
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.auth.login(form.username, form.password);
      const token = response?.data?.token;
      const profile = response?.data?.user;

      if (!token || !profile) {
        throw new Error('Đăng nhập thất bại. Dữ liệu phản hồi không hợp lệ.');
      }

      apiClient.setAuthToken(token);
      onLogin(profile);
    } catch (err) {
      setError(err?.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#0a1628] via-[#0d2240] to-[#0a1628] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-blue-800/15 rounded-full blur-3xl" />
        {/* Grid pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Animated lines */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute h-px opacity-10"
            style={{
              top: `${15 + i * 15}%`,
              left: 0, right: 0,
              background: 'linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)',
              animation: `pulse ${2 + i * 0.5}s ease-in-out infinite`,
              animationDelay: `${i * 0.3}s`
            }} />
        ))}
      </div>

      {/* Left panel – branding */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] p-14 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">HV KỸ THUẬT & CN AN NINH</div>
            <div className="text-blue-300 text-xs">Học viện Kỹ thuật và Công nghệ An ninh</div>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/25 rounded-full mb-6">
            <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-cyan-300 text-xs font-medium">Hệ thống nội bộ bảo mật</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Hệ thống quản lý<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              Lịch công tác &amp; Trực ban
            </span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed mb-8">
            Nền tảng số hóa quy trình lập lịch công tác, lịch trực ban, quản lý cán bộ và
            tra cứu thông tin một cách trực quan, hiệu quả và bảo mật.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '📅', title: 'Lập lịch thông minh', desc: 'Tự động hóa quy trình lập lịch công tác và trực ban' },
              { icon: '🔒', title: 'Bảo mật cao', desc: 'Phân quyền truy cập theo vai trò, mã hóa dữ liệu' },
              { icon: '📊', title: 'Thống kê trực quan', desc: 'Báo cáo và biểu đồ phân tích chi tiết' },
              { icon: '🖨️', title: 'Xuất báo cáo', desc: 'Xuất PDF, Excel và in trực tiếp dễ dàng' },
            ].map((item, i) => (
              <div key={i} className="flex gap-3 p-4 bg-white/5 rounded-2xl border border-white/8 hover:bg-white/8 transition-colors">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <div className="text-white text-sm font-semibold mb-0.5">{item.title}</div>
                  <div className="text-slate-400 text-xs leading-relaxed">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-500 text-xs">
          <span>© 2026 HVKTCNAN</span>
          <span>|</span>
          <span>Phiên bản 1.0.0</span>
          <span>|</span>
          <div className="flex items-center gap-1.5">
            <Wifi size={12} className="text-emerald-400" />
            <span className="text-emerald-400">Kết nối mạng nội bộ</span>
          </div>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative z-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">HV KỸ THUẬT & CN AN NINH</div>
              <div className="text-blue-300 text-xs">Hệ thống Lịch công tác nội bộ</div>
            </div>
          </div>

          <div className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-white">Đăng nhập</h2>
              <p className="text-slate-400 text-sm mt-1">Vui lòng đăng nhập để tiếp tục</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Tên đăng nhập</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nhập tên đăng nhập"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/70 border border-white/15 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1.5 block">Mật khẩu</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-3 bg-slate-800/70 border border-white/15 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${form.remember ? 'bg-blue-600 border-blue-600' : 'border-slate-500 group-hover:border-slate-400'}`}
                    onClick={() => setForm({ ...form, remember: !form.remember })}>
                    {form.remember && <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-white rotate-45 mb-0.5" />}
                  </div>
                  <span className="text-sm text-slate-400">Ghi nhớ đăng nhập</span>
                </label>
                <button type="button" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                  Quên mật khẩu?
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full flex-shrink-0" />
                  <span className="text-sm text-red-300">{error}</span>
                </div>
              )}

              {/* Submit */}
              <button type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-blue-800 disabled:to-blue-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-blue-900/40 hover:shadow-blue-800/50 hover:-translate-y-px active:translate-y-0 mt-2">
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Đang xác thực...</span></>
                ) : (
                  <><span>Đăng nhập</span><ChevronRight size={16} /></>
                )}
              </button>
            </form>

            <div className="mt-6 p-3.5 bg-blue-500/8 border border-blue-500/15 rounded-xl">
              <div className="text-blue-300 text-xs font-semibold">Tài khoản cán bộ và quản lý mới do Ban Giám đốc hoặc Quản lý hiện có tạo.</div>
              <p className="text-[10px] text-slate-500 mt-2">Hệ thống không hỗ trợ tự đăng ký tài khoản.</p>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-6">
            Học viện Kỹ thuật và Công nghệ An ninh · Hệ thống nội bộ
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
