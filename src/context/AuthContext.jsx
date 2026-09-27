import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [communityProfile, setCommunityProfile] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('unsubmitted');
  const [verificationBadge, setVerificationBadge] = useState('none');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'https://api.interplanetary.tv/api';

  const fetchCommunityMe = async (token) => {
    try {
      const res = await fetch(`${API_URL}/community/me`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setCommunityProfile(data.communityProfile);
        setVerificationStatus(data.verificationStatus);
        setVerificationBadge(data.verificationBadge);
        setIsSubscribed(data.isSubscribed);
        return data;
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch (err) {
      console.error('Error fetching community user:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCommunityMe(token).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.msg || 'Login failed');

    if (data.requires2FA) return data;

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await fetchCommunityMe(data.token);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setCommunityProfile(null);
    setIsSubscribed(false);
  };

  const refreshProfile = async () => {
    const token = localStorage.getItem('token');
    if (token) await fetchCommunityMe(token);
  };

  const value = {
    currentUser,
    communityProfile,
    verificationStatus,
    verificationBadge,
    isSubscribed,
    loading,
    login,
    logout,
    refreshProfile,
    API_URL
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
