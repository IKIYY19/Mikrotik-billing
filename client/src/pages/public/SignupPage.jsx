import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import {
  Wifi,
  User,
  Phone,
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

export function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    pin: "",
    confirmPin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.pin !== form.confirmPin) {
      setError("PINs do not match");
      return;
    }
    if (form.pin.length < 4 || form.pin.length > 8) {
      setError("PIN must be 4-8 digits");
      return;
    }

    setLoading(true);
    try {
      // Store info in sessionStorage before proceeding to plans
      sessionStorage.setItem("signup_name", form.name);
      sessionStorage.setItem("signup_phone", form.phone);
      sessionStorage.setItem("signup_email", form.email);
      sessionStorage.setItem("signup_pin", form.pin);
      navigate("/plans");
    } catch (err) {
      setError(
        err.response?.data?.error || "Registration failed. Please try again.",
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Wifi className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Get Connected</h1>
          <p className="text-zinc-400 mt-2">
            Sign up for high-speed internet today
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-800/50 backdrop-blur border border-zinc-700/50 rounded-2xl p-8 space-y-4"
        >
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="0712 345 678"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Email (optional)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Set PIN (4-8 digits)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={form.pin}
                onChange={(e) =>
                  setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="1234"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">
              Confirm PIN
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={form.confirmPin}
                onChange={(e) =>
                  setForm({
                    ...form,
                    confirmPin: e.target.value.replace(/\D/g, ""),
                  })
                }
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-zinc-700/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="1234"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-violet-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Please wait..." : "Continue to Plans"}
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-center text-xs text-zinc-500 mt-4">
            Already have an account?{" "}
            <Link
              to={`/portal/login?phone=${encodeURIComponent(form.phone || "")}`}
              className="text-blue-400 hover:text-blue-300"
            >
              Sign in to portal
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
