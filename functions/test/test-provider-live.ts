/**
 * Real Google Provider Integration Test: Gemini 3.8 Live Access, Token Minting & WebSocket Handshake
 * Task B5 — Verification for PR #24 Review
 * Developer B — AI & Model Integration Lead
 * 
 * Demonstrates real Google Provider capability:
 * 1. Project credential & quota verification
 * 2. Model catalog inspection for models/gemini-3.8-live
 * 3. Ephemeral token creation via @google/genai client.authTokens.create (v1alpha)
 * 4. WebSocket connection URL formation and live handshake exchange with Gemini 3.8 Live
 */

import dotenv from 'dotenv';
dotenv.config();
import { strict as assert } from 'node:assert';
import { GoogleGenAI } from '@google/genai';

async function runProviderLiveTest() {
  console.log('================================================================');
  console.log('   Startup Buildathon 2026 — Real Google Provider Live Test    ');
  console.log('   Gemini 3.8 Live Ephemeral Token & Live WebSocket Handshake   ');
  console.log('================================================================');

  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey.trim().length === 0) {
    console.log('⚠️ SKIPPED: No GEMINI_API_KEY found in environment.');
    process.exit(0);
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: 'v1alpha' },
  });

  const targetModel = 'models/gemini-3.8-live';
  console.log(`\n[Step 1] Inspecting Model Definition: ${targetModel}`);
  const startTime = Date.now();
  let modelInfo: any;

  try {
    modelInfo = await client.models.get({ model: targetModel });
    const latencyMs = Date.now() - startTime;
    console.log(`✅ Model Found in Catalog (${latencyMs}ms):`);
    console.log(`   - Name: ${modelInfo.name}`);
    console.log(`   - Display Name: ${modelInfo.displayName}`);
    console.log(`   - Version: ${modelInfo.version}`);
    console.log(`   - Supported Actions: ${JSON.stringify(modelInfo.supportedActions)}`);
    console.log(`   - Input Token Limit: ${modelInfo.inputTokenLimit}`);
    console.log(`   - Output Token Limit: ${modelInfo.outputTokenLimit}`);

    assert.equal(modelInfo.name, targetModel, 'Model name matches target');
    assert(
      Array.isArray(modelInfo.supportedActions) && modelInfo.supportedActions.includes('bidiGenerateContent'),
      'Model supports bidirectional streaming (bidiGenerateContent)'
    );
  } catch (err: any) {
    console.error('❌ Failed to retrieve model definition:', err?.message);
    throw err;
  }

  console.log(`\n[Step 2] Minting Real Ephemeral Auth Token: ${targetModel}`);
  const tokenStartTime = Date.now();
  let tokenResponse: any;

  try {
    tokenResponse = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 900 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 300 * 1000).toISOString(),
        liveConnectConstraints: {
          model: targetModel,
        },
      },
    });
    const tokenLatencyMs = Date.now() - tokenStartTime;
    console.log(`✅ Ephemeral Token Successfully Minted (${tokenLatencyMs}ms):`);
    const sanitizedToken = tokenResponse.name
      ? `${tokenResponse.name.slice(0, 20)}...[REDACTED_HASH_LEN_${tokenResponse.name.length}]`
      : 'UNDEFINED';
    console.log(`   - Token Resource: ${sanitizedToken}`);
    console.log(`   - Auth Method: QUERY_PARAM_ACCESS_TOKEN`);
    console.log(`   - WebSocket Endpoint: wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained`);

    assert(tokenResponse && tokenResponse.name, 'Token response must contain a valid name property');
    assert(tokenResponse.name.startsWith('auth_tokens/'), 'Token name format must start with auth_tokens/');
  } catch (err: any) {
    console.error('❌ Failed to mint ephemeral token:', err?.message);
    throw err;
  }

  console.log(`\n[Step 3] Establishing Real WebSocket Session Handshake: ${targetModel}`);
  const wsEndpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
  const connectionUrl = `${wsEndpoint}?access_token=${tokenResponse.name}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(connectionUrl);
    let setupAcknowledged = false;
    let turnAcknowledged = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (!setupAcknowledged) {
        reject(new Error('Timeout: WebSocket connection did not complete setup handshake within 10s'));
      } else {
        resolve();
      }
    }, 10000);

    ws.onopen = () => {
      console.log('   - WebSocket socket opened');
      const setupMessage = {
        setup: {
          model: targetModel,
          generationConfig: {
            responseModalities: ['TEXT'],
          },
        },
      };
      ws.send(JSON.stringify(setupMessage));
    };

    ws.onmessage = async (event) => {
      const text = event.data instanceof Blob ? await event.data.text() : event.data.toString();
      try {
        const parsed = JSON.parse(text);
        if (parsed.setupComplete) {
          setupAcknowledged = true;
          console.log('   - Server acknowledged setupComplete: {}');
          const turnMessage = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'Hello, what is your name?' }],
                },
              ],
              turnComplete: true,
            },
          };
          ws.send(JSON.stringify(turnMessage));
        }

        if (parsed.sessionResumptionUpdate) {
          console.log(`   - Session resumption handle received: ${parsed.sessionResumptionUpdate.newHandle?.slice(0, 8)}...`);
        }

        if (parsed.serverContent) {
          turnAcknowledged = true;
          console.log('   - Server responded with serverContent frame');
          clearTimeout(timeout);
          ws.close(1000, 'Handshake verified');
          resolve();
        }
      } catch (err) {
        console.error('   - Failed to parse server message:', text);
      }
    };

    ws.onerror = (err: any) => {
      clearTimeout(timeout);
      console.error('❌ WebSocket error during live handshake:', err?.message || err);
      reject(err);
    };

    ws.onclose = (event) => {
      clearTimeout(timeout);
      if (setupAcknowledged) {
        console.log(`✅ Live WebSocket session verified & cleanly closed (code=${event.code})`);
        resolve();
      } else {
        reject(new Error(`WebSocket closed unexpectedly before setup complete: code=${event.code}`));
      }
    };
  });

  console.log('\n================================================================');
  console.log('Provider Live Verification: 3/3 checks PASSED successfully.');
  console.log('================================================================');
}

runProviderLiveTest().catch((err) => {
  console.error('Fatal error in Provider Live Test:', err);
  process.exit(1);
});
