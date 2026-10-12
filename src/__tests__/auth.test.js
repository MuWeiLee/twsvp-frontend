import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  consumeLoginRedirect,
  rememberLoginRedirect,
  sendEmailLoginCode,
  signInWithGoogleSupabase,
  verifyEmailLoginCode,
} from '../services/auth';
import { supabase } from '../services/supabase';

// 模拟 @supabase/supabase-js 库
vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
    },
  },
}));

describe('auth service', () => {
  beforeEach(() => {
    // 清除所有模拟调用
    vi.clearAllMocks();
    
    // 模拟 window.location.origin
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:5173' },
      writable: true,
    });
  });

  describe('signInWithGoogleSupabase', () => {
    it('should call supabase.auth.signInWithOAuth with correct parameters', async () => {
      // 模拟成功响应
      const mockResponse = {
        data: {
          provider: 'google',
          url: 'https://accounts.google.com/o/oauth2/auth?client_id=...',
        },
        error: null,
      };
      
      supabase.auth.signInWithOAuth.mockResolvedValue(mockResponse);
      
      // 调用函数
      const result = await signInWithGoogleSupabase();
      
      // 验证调用参数
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:5173/auth/callback',
        },
      });
      
      // 验证返回结果
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error when supabase.auth.signInWithOAuth fails', async () => {
      // 模拟错误响应
      const mockError = new Error('OAuth sign in failed');
      
      supabase.auth.signInWithOAuth.mockResolvedValue({
        data: null,
        error: mockError,
      });
      
      // 验证是否抛出错误
      await expect(signInWithGoogleSupabase()).rejects.toThrow(mockError);
    });

    it('should handle unexpected errors', async () => {
      // 模拟抛出异常
      const mockError = new Error('Network error');
      
      supabase.auth.signInWithOAuth.mockRejectedValue(mockError);
      
      // 验证是否抛出错误
      await expect(signInWithGoogleSupabase()).rejects.toThrow(mockError);
    });
  });
});

describe('email code login and login redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('sends a sign-in code that also works for existing Google users', async () => {
    supabase.auth.signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    const address = await sendEmailLoginCode('  User@Gmail.com ');
    expect(address).toBe('user@gmail.com');
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'user@gmail.com',
      options: { shouldCreateUser: true, emailRedirectTo: 'http://localhost:5173/auth/callback' },
    });
  });

  it('rejects malformed emails before calling Supabase', async () => {
    supabase.auth.signInWithOtp = vi.fn();
    await expect(sendEmailLoginCode('not-an-email')).rejects.toThrow();
    expect(supabase.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('verifies the emailed code', async () => {
    const user = { id: 'u1', email: 'user@gmail.com' };
    supabase.auth.verifyOtp = vi.fn().mockResolvedValue({ data: { user, session: {} }, error: null });
    await expect(verifyEmailLoginCode('user@gmail.com', '123 456')).resolves.toEqual(user);
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({ email: 'user@gmail.com', token: '123456', type: 'email' });
  });

  it('remembers the page to return to after login, once', () => {
    rememberLoginRedirect('/feed/42?tab=reply');
    expect(consumeLoginRedirect()).toBe('/feed/42?tab=reply');
    expect(consumeLoginRedirect()).toBeNull();
  });

  it('ignores login pages and external URLs as redirect targets', () => {
    rememberLoginRedirect('/login');
    expect(consumeLoginRedirect()).toBeNull();
    rememberLoginRedirect('//evil.example.com');
    expect(consumeLoginRedirect()).toBeNull();
  });
});
