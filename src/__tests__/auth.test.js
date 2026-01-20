import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGoogleSupabase } from '../services/auth';
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
          redirectTo: 'http://localhost:5173',
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
