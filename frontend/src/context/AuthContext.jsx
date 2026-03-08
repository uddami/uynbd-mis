/**
 * UYNBD MIS - Auth Context
 * Provides authentication state and methods throughout the app.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  chairman: 'Chairman',
  md: 'Managing Director',
  administrator: 'Administrator',
  finance_director: 'Finance Director',
  logistics_director: 'Logistics Director',
  branch_chief: 'Branch Chief',
  event_chief: 'Event Chief',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('uynbd_user');
    const token = localStorage.getItem('uynbd_token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      if (response.success) {
        localStorage.setItem('uynbd_token', response.token);
        localStorage.setItem('uynbd_user', JSON.stringify(response.user));
        setUser(response.user);
        toast.success(`Welcome back, ${response.user.member_name || response.user.email}!`);
        return { success: true };
      }
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('uynbd_token');
    localStorage.removeItem('uynbd_user');
    setUser(null);
    toast.success('Logged out successfully');
  };

  // Permission checks
  const can = (module, action = 'read') => {
    if (!user) return false;
    const perms = {
      members: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
        write: ['super_admin', 'administrator'],
        delete: ['super_admin'],
      },
      finance: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'finance_director'],
        write: ['super_admin', 'administrator', 'finance_director'],
      },
      analytics: { read: ['super_admin', 'chairman', 'md', 'administrator'] },
      events: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief', 'event_chief'],
        write: ['super_admin', 'administrator'],
        approve: ['super_admin', 'administrator'],
      },
      projects: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
        write: ['super_admin', 'administrator'],
      },
      documents: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
        write: ['super_admin', 'administrator'],
        delete: ['super_admin'],
      },
      sponsors: {
        read: ['super_admin', 'chairman', 'md', 'administrator'],
        write: ['super_admin', 'administrator'],
      },
      logistics: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'logistics_director'],
        write: ['super_admin', 'administrator', 'logistics_director'],
      },
      audit: { read: ['super_admin', 'chairman', 'administrator'] },
      users: { read: ['super_admin'], write: ['super_admin'], delete: ['super_admin'] },
      branches: {
        read: ['super_admin', 'chairman', 'md', 'administrator', 'branch_chief'],
        write: ['super_admin', 'administrator'],
      },
    };
    return perms[module]?.[action]?.includes(user.role) || false;
  };

  const isSuperAdmin = () => user?.role === 'super_admin';
  const isAdmin = () => ['super_admin', 'administrator'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, isSuperAdmin, isAdmin, ROLE_LABELS }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
