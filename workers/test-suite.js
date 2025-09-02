// Comprehensive test suite for Cloudflare Workers backend
// This will test all workers and ensure they're working correctly

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = 'http://localhost:8787'; // Default Wrangler dev server port
const TEST_EMAIL = 'test@example.com';
const TEST_FIRST_NAME = 'Test';
const TEST_LAST_NAME = 'User';

// Test data
let authToken = null;
let magicLinkToken = null;

test.describe('Cloudflare Workers Backend Tests', () => {
  
  test.beforeAll(async () => {
    console.log('Starting comprehensive backend tests...');
  });

  test.describe('Email Worker Tests', () => {
    
    test('should handle email signup successfully', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/email/signup`, {
        data: {
          email: TEST_EMAIL,
          firstName: TEST_FIRST_NAME,
          lastName: TEST_LAST_NAME
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Welcome');
      expect(data.discountCode).toBeDefined();
      expect(data.hasAccess).toBe(true);
      
      console.log('✅ Email signup test passed');
    });

    test('should handle duplicate email signup', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/email/signup`, {
        data: {
          email: TEST_EMAIL,
          firstName: TEST_FIRST_NAME,
          lastName: TEST_LAST_NAME
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Welcome back');
      
      console.log('✅ Duplicate email signup test passed');
    });

    test('should reject invalid email', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/email/signup`, {
        data: {
          email: 'invalid-email',
          firstName: TEST_FIRST_NAME
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('email');
      
      console.log('✅ Invalid email rejection test passed');
    });

    test('should check email worker health', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/email/health`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.worker).toBe('email-worker');
      
      console.log('✅ Email worker health check passed');
    });
  });

  test.describe('Authentication Worker Tests', () => {
    
    test('should request magic link successfully', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/magic-link`, {
        data: {
          email: TEST_EMAIL
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Magic link sent');
      
      console.log('✅ Magic link request test passed');
    });

    test('should reject magic link for non-existent user', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/magic-link`, {
        data: {
          email: 'nonexistent@example.com'
        }
      });

      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data.error).toContain('User not found');
      
      console.log('✅ Non-existent user magic link rejection test passed');
    });

    test('should reject invalid email for magic link', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/auth/magic-link`, {
        data: {
          email: 'invalid-email'
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('email');
      
      console.log('✅ Invalid email magic link rejection test passed');
    });

    test('should check auth worker health', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/auth/health`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.worker).toBe('auth-worker');
      
      console.log('✅ Auth worker health check passed');
    });
  });

  test.describe('Progress Worker Tests', () => {
    
    test('should update reading progress successfully', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/progress`, {
        data: {
          email: TEST_EMAIL,
          chapterNumber: 1,
          completed: true,
          timeSpent: 300,
          videosWatched: ['video1', 'video2'],
          quizzesPassed: ['quiz1']
        }
      });

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.progress).toBeDefined();
      expect(data.progress[0].chapter_number).toBe(1);
      expect(data.progress[0].completed).toBe(true);
      
      console.log('✅ Progress update test passed');
    });

    test('should get reading progress successfully', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/progress?email=${TEST_EMAIL}`);

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.progress).toBeDefined();
      expect(Array.isArray(data.progress)).toBe(true);
      
      console.log('✅ Progress retrieval test passed');
    });

    test('should get progress analytics successfully', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/progress/analytics?email=${TEST_EMAIL}`);

      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.completion).toBeDefined();
      expect(data.engagement).toBeDefined();
      expect(data.progress).toBeDefined();
      expect(data.completion.totalChapters).toBeGreaterThanOrEqual(0);
      expect(data.completion.completedChapters).toBeGreaterThanOrEqual(0);
      
      console.log('✅ Progress analytics test passed');
    });

    test('should reject invalid email for progress', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/progress`, {
        data: {
          email: 'invalid-email',
          chapterNumber: 1
        }
      });

      expect(response.status()).toBe(400);
      
      const data = await response.json();
      expect(data.error).toContain('email');
      
      console.log('✅ Invalid email progress rejection test passed');
    });

    test('should check progress worker health', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/progress/health`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.worker).toBe('progress-worker');
      
      console.log('✅ Progress worker health check passed');
    });
  });

  test.describe('API Gateway Tests', () => {
    
    test('should check overall system health', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/health`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBeDefined();
      expect(data.checks).toBeDefined();
      expect(data.checks.gateway.status).toBe('healthy');
      
      console.log('✅ System health check passed');
    });

    test('should return API documentation', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/docs`);
      
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      expect(data.title).toContain('Content Creator Handbook API');
      expect(data.endpoints).toBeDefined();
      expect(data.endpoints.authentication).toBeDefined();
      expect(data.endpoints.email).toBeDefined();
      expect(data.endpoints.progress).toBeDefined();
      
      console.log('✅ API documentation test passed');
    });

    test('should handle 404 for unknown routes', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/unknown-route`);
      
      expect(response.status()).toBe(404);
      
      const data = await response.json();
      expect(data.error).toBe('Not Found');
      expect(data.availableEndpoints).toBeDefined();
      
      console.log('✅ 404 handling test passed');
    });

    test('should handle CORS preflight requests', async ({ request }) => {
      const response = await request.fetch(`${BASE_URL}/api/health`, {
        method: 'OPTIONS'
      });
      
      expect(response.status()).toBe(200);
      expect(response.headers()['access-control-allow-origin']).toBe('*');
      expect(response.headers()['access-control-allow-methods']).toContain('GET');
      
      console.log('✅ CORS preflight test passed');
    });
  });

  test.describe('Integration Tests', () => {
    
    test('should complete full user journey', async ({ request }) => {
      // 1. Sign up user
      const signupResponse = await request.post(`${BASE_URL}/api/email/signup`, {
        data: {
          email: 'integration@example.com',
          firstName: 'Integration',
          lastName: 'Test'
        }
      });
      
      expect(signupResponse.status()).toBe(200);
      const signupData = await signupResponse.json();
      expect(signupData.success).toBe(true);
      
      // 2. Update progress
      const progressResponse = await request.post(`${BASE_URL}/api/progress`, {
        data: {
          email: 'integration@example.com',
          chapterNumber: 1,
          completed: true,
          timeSpent: 600
        }
      });
      
      expect(progressResponse.status()).toBe(200);
      const progressData = await progressResponse.json();
      expect(progressData.success).toBe(true);
      
      // 3. Get analytics
      const analyticsResponse = await request.get(`${BASE_URL}/api/progress/analytics?email=integration@example.com`);
      
      expect(analyticsResponse.status()).toBe(200);
      const analyticsData = await analyticsResponse.json();
      expect(analyticsData.completion.completedChapters).toBe(1);
      
      console.log('✅ Full user journey integration test passed');
    });

    test('should handle concurrent requests', async ({ request }) => {
      const promises = [];
      
      // Create 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request.post(`${BASE_URL}/api/progress`, {
            data: {
              email: TEST_EMAIL,
              chapterNumber: i + 1,
              completed: false,
              timeSpent: 60
            }
          })
        );
      }
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status()).toBe(200);
      });
      
      console.log('✅ Concurrent requests test passed');
    });
  });

  test.afterAll(async () => {
    console.log('All backend tests completed successfully! 🎉');
  });
});
