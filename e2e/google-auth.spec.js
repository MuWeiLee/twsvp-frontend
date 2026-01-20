const { test, expect } = require('@playwright/test');

test('Google OAuth 登录流程测试', async ({ page, context }) => {
  // 导航到应用首页
  await page.goto('/');
  
  // 点击 Google 登录按钮（假设页面上有一个 id 为 'google-login' 的按钮）
  // 注意：这里需要根据实际页面结构调整选择器
  const loginButton = page.locator('#google-login');
  await expect(loginButton).toBeVisible();
  
  // 拦截并重定向 Google OAuth 请求到本地处理
  // 这是一种模拟方式，避免真实的 Google 登录
  await page.route('**/auth/v1/authorize', async (route) => {
    // 模拟成功的 OAuth 响应
    const mockResponse = {
      data: {
        provider: 'google',
        url: 'http://localhost:5173/callback?code=mock-auth-code&state=mock-state'
      },
      error: null
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse)
    });
  });
  
  // 点击登录按钮
  await loginButton.click();
  
  // 检查是否成功发起了 OAuth 请求
  // 注意：实际测试中，这里会重定向到 Google 登录页面
  // 由于我们使用了路由拦截，所以不会发生实际的重定向
});

// 测试 OAuth 回调处理
test('Google OAuth 回调处理测试', async ({ page }) => {
  // 直接导航到回调 URL，模拟 Google 登录成功后的重定向
  await page.goto('/callback?code=mock-auth-code&state=mock-state');
  
  // 验证是否成功登录（根据实际应用的登录状态指示调整）
  // 例如，检查是否显示用户头像或用户名
  // 注意：这里需要根据实际应用的 DOM 结构调整选择器
  const userProfile = page.locator('.user-profile');
  await expect(userProfile).toBeVisible();
  
  // 或者检查是否设置了认证 cookie
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(cookie => cookie.name.includes('auth'));
  expect(hasAuthCookie).toBeTruthy();
});

// 测试登出功能
test('Google OAuth 登出测试', async ({ page }) => {
  // 先登录，然后测试登出
  await page.goto('/');
  
  // 模拟已经登录的状态（例如，设置一个测试用的认证 cookie）
  await page.context().addCookies([{
    name: 'auth_token',
    value: 'mock-token',
    url: 'http://localhost:5173',
    path: '/',
    httpOnly: true,
    secure: false
  }]);
  
  // 刷新页面以应用 cookie
  await page.reload();
  
  // 点击登出按钮
  const logoutButton = page.locator('#logout');
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  
  // 验证是否成功登出
  const loginButtonAfterLogout = page.locator('#google-login');
  await expect(loginButtonAfterLogout).toBeVisible();
  
  // 验证认证 cookie 是否被清除
  const cookies = await page.context().cookies();
  const hasAuthCookie = cookies.some(cookie => cookie.name === 'auth_token');
  expect(hasAuthCookie).toBeFalsy();
});
