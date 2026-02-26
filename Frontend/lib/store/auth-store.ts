import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  jwt: string | null;
  userId: string | null;
  walletAddress: string | null;
  login: (jwt: string, userId: string, walletAddress: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      jwt: null,
      userId: null,
      walletAddress: null,
      login: (jwt, userId, walletAddress) =>
        set({ isAuthenticated: true, jwt, userId, walletAddress }),
      logout: () =>
        set({ isAuthenticated: false, jwt: null, userId: null, walletAddress: null }),
    }),
    { name: 'liquidot-auth' }
  )
);
