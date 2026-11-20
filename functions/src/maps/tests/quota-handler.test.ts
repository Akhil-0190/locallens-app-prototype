import { describe, it } from 'node:test';
import assert from 'node:assert';
import { QuotaHandlerService } from '../services/quota-handler.service.ts';

describe('QuotaHandlerService', () => {
  describe('classifyError', () => {
    it('should classify 403 as PERMISSION_DENIED and non-retryable', () => {
      const err = QuotaHandlerService.classifyError(
        403,
        JSON.stringify({
          error: {
            code: 403,
            message: 'Permission denied on the service.',
            status: 'PERMISSION_DENIED',
          },
        })
      );

      assert.strictEqual(err.statusCode, 403);
      assert.strictEqual(err.category, 'PERMISSION_DENIED');
      assert.strictEqual(err.isRetryable, false);
      assert.ok(err.suggestedAction.includes('Enable Places API'));
    });

    it('should classify 429 as QUOTA_EXHAUSTED and retryable', () => {
      const err = QuotaHandlerService.classifyError(
        429,
        JSON.stringify({
          error: {
            code: 429,
            message: 'Resource has been exhausted (e.g. check quota).',
          },
        })
      );

      assert.strictEqual(err.statusCode, 429);
      assert.strictEqual(err.category, 'QUOTA_EXHAUSTED');
      assert.strictEqual(err.isRetryable, true);
    });

    it('should classify 503 as TRANSIENT_SERVER_ERROR and retryable', () => {
      const err = QuotaHandlerService.classifyError(503, 'Service Unavailable');

      assert.strictEqual(err.statusCode, 503);
      assert.strictEqual(err.category, 'TRANSIENT_SERVER_ERROR');
      assert.strictEqual(err.isRetryable, true);
    });

    it('should classify 400 as INVALID_REQUEST and non-retryable', () => {
      const err = QuotaHandlerService.classifyError(400, 'Invalid field mask');

      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.category, 'INVALID_REQUEST');
      assert.strictEqual(err.isRetryable, false);
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first try if no error is thrown', async () => {
      let attempts = 0;
      const res = await QuotaHandlerService.executeWithRetry(async () => {
        attempts++;
        return 'success';
      }, 3, 50);

      assert.strictEqual(res, 'success');
      assert.strictEqual(attempts, 1);
    });

    it('should retry on transient retryable error and succeed', async () => {
      let attempts = 0;
      const res = await QuotaHandlerService.executeWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          const err: any = new Error('Rate limit exceeded');
          err.status = 429;
          throw err;
        }
        return 'recovered';
      }, 3, 20);

      assert.strictEqual(res, 'recovered');
      assert.strictEqual(attempts, 2);
    });

    it('should not retry on non-retryable 403 error', async () => {
      let attempts = 0;
      await assert.rejects(
        async () => {
          await QuotaHandlerService.executeWithRetry(async () => {
            attempts++;
            const err: any = new Error('Permission denied');
            err.status = 403;
            throw err;
          }, 3, 20);
        },
        (err: any) => {
          assert.strictEqual(err.status, 403);
          return true;
        }
      );

      assert.strictEqual(attempts, 1);
    });
  });
});
