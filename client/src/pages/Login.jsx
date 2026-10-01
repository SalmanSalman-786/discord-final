import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    const result = await login({ email, password });
    if (result.success) {
      navigate('/app');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1a1d36] via-[#0f111d] to-[#090a10]">
      <div className="w-full max-w-md rounded-2xl bg-[#131528] border border-[#262a4a] p-8 shadow-2xl backdrop-blur-sm">
        <h2 className="mb-2 text-center text-2xl font-extrabold text-white tracking-tight">Welcome back!</h2>
        <p className="mb-6 text-center text-sm text-indigo-200/60 font-medium">We're so excited to see you again!</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/40 p-3 text-xs font-semibold text-red-200">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              required
              className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder-gray-500"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-indigo-200/70">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              required
              className="w-full rounded-lg bg-[#1a1d34] border border-[#262a4a] p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-[#4f54e5] hover:bg-[#4347d9] py-2.5 font-bold text-white shadow-[0_0_15px_rgba(79,84,229,0.4)] transition-all disabled:opacity-50 cursor-pointer text-sm"
          >
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="mt-5 text-xs text-center text-gray-400">
          Need an account?{' '}
          <Link to="/register" className="text-indigo-400 font-semibold hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
