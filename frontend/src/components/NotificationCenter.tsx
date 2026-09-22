"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface NotificationItem {
  id: number;
  user_id: number | null;
  role: string | null;
  department_id: number | null;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "SUCCESS" | "ALERT";
  link: string | null;
  is_read: number;
  created_at: string;
}

const API_BASE = "http://localhost:8000";

export default function NotificationCenter() {
  const { token, authFetch } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_BASE}/api/notifications`);
      if (res.ok) {
        const data: NotificationItem[] = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter((n) => n.is_read === 0).length);
      }
    } catch {
      // Offline fallback
    }
  }, [token, authFetch]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close drawer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: number) => {
    try {
      await authFetch(`${API_BASE}/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await authFetch(`${API_BASE}/api/notifications/read-all`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
        title="Operational Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse border-2 border-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">Operational Alerts</h4>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 rounded border border-amber-500/40">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 font-medium transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto divide-y divide-slate-100 flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                <Bell size={28} className="mx-auto mb-2 text-slate-300 opacity-60" />
                No alerts at this moment
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => n.is_read === 0 && markAsRead(n.id)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors hover:bg-slate-50/80 ${
                    n.is_read === 0 ? "bg-blue-50/40" : "bg-white"
                  }`}
                >
                  {/* Icon according to type */}
                  <div className="shrink-0 mt-0.5">
                    {n.type === "ALERT" && (
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                        <AlertTriangle size={14} />
                      </div>
                    )}
                    {n.type === "SUCCESS" && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={14} />
                      </div>
                    )}
                    {n.type === "WARNING" && (
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={14} />
                      </div>
                    )}
                    {n.type === "INFO" && (
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Info size={14} />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className={`text-xs truncate ${n.is_read === 0 ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                        {n.title}
                      </h5>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {formatTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  </div>

                  {/* Unread indicator dot */}
                  {n.is_read === 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
