/**
 * Real Google Provider Integration Test: Gemini 3.8 Live Access, Token Minting, WebSocket Handshake & Generated Content
 * Task B5 — Verification for PR #24 Review
 * Developer B — AI & Model Integration Lead
 * 
 * Demonstrates real Google Provider capability:
 * 1. Project credential & model catalog inspection for models/gemini-3.8-live
 * 2. Real ephemeral token creation via @google/genai client.authTokens.create (v1alpha)
 * 3. Real WebSocket handshake (setupComplete)
 * 4. Actual conversational model content generation (text transcription & streaming audio synthesis)
 */

import dotenv from 'dotenv';
dotenv.config();
import { strict as assert } from 'node:assert';
import { GoogleGenAI } from '@google/genai';

async function runProviderLiveTest() {
  console.log('================================================================');
  console.log('   Startup Buildathon 2026 — Real Google Provider Live Test    ');
  console.log('   Gemini 3.8 Live Token, WebSocket Handshake & Content Test    ');
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

  // --- Step 1: Model Catalog Inspection ---
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

  // --- Step 2: Ephemeral Token Minting ---
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

  // --- Step 3: WebSocket Session Handshake & Actual Generated Content ---
  console.log(`\n[Step 3] Establishing WebSocket Handshake & Generated Content Exchange: ${targetModel}`);
  const wsEndpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained';
  const connectionUrl = `${wsEndpoint}?access_token=${tokenResponse.name}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(connectionUrl);
    let setupAcknowledged = false;
    let accumulatedText = '';
    let audioBytesReceived = 0;
    let turnCompleteReceived = false;

    const timeout = setTimeout(() => {
      ws.close();
      if (!setupAcknowledged) {
        reject(new Error('Timeout: WebSocket connection did not complete setup handshake within 12s'));
      } else if (!accumulatedText && audioBytesReceived === 0) {
        reject(new Error('Timeout: No model-generated content received in response turn'));
      } else {
        resolve();
      }
    }, 12000);

    ws.onopen = () => {
      console.log('   - WebSocket connection opened');
      const setupMessage = {
        setup: {
          model: targetModel,
          generationConfig: {
            responseModalities: ['AUDIO'],
          },
        },
      };
      ws.send(JSON.stringify(setupMessage));
    };

    ws.onmessage = async (event) => {
      const text = event.data instanceof Blob ? await event.data.text() : event.data.toString();
      try {
        const parsed = JSON.parse(text);

        // 1. Setup acknowledgment
        if (parsed.setupComplete) {
          setupAcknowledged = true;
          console.log('   - Server acknowledged setupComplete: {}');
          const turnMessage = {
            clientContent: {
              turns: [
                {
                  role: 'user',
                  parts: [{ text: 'Respond with exactly the single word "READY".' }],
                },
              ],
              turnComplete: true,
            },
          };
          console.log('   - Transmitted client prompt turn: \'Respond with exactly the single word "READY".\'');
          ws.send(JSON.stringify(turnMessage));
        }

        // 2. Session resumption
        if (parsed.sessionResumptionUpdate) {
          console.log(`   - Session resumption handle received: ${parsed.sessionResumptionUpdate.newHandle?.slice(0, 8)}...`);
        }

        // 3. Model generated transcription / text
        if (parsed.serverContent?.outputTranscription?.text) {
          accumulatedText += parsed.serverContent.outputTranscription.text;
          console.log(`   - Received outputTranscription text chunk: "${parsed.serverContent.outputTranscription.text}"`);
        }

        // 4. Model generated audio parts
        if (parsed.serverContent?.modelTurn?.parts) {
          for (const part of parsed.serverContent.modelTurn.parts) {
            if (part.text) {
              accumulatedText += part.text;
              console.log(`   - Received modelTurn text part: "${part.text}"`);
            }
            if (part.inlineData?.data) {
              audioBytesReceived += part.inlineData.data.length;
            }
          }
        }

        // 5. Turn completion
        if (parsed.serverContent?.turnComplete) {
          turnCompleteReceived = true;
          console.log(`   - Turn complete received from model (audioBytes: ${audioBytesReceived}, text: "${accumulatedText.trim()}")`);
          clearTimeout(timeout);
          ws.close(1000, 'Handshake and generation verified');
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
      if (setupAcknowledged && (accumulatedText.length > 0 || audioBytesReceived > 0)) {
        console.log(`✅ Live session content verified & cleanly closed (code=${event.code})`);
        resolve();
      } else if (!setupAcknowledged) {
        reject(new Error(`WebSocket closed unexpectedly before setup complete: code=${event.code}`));
      } else {
        reject(new Error('WebSocket closed without generating response content'));
      }
    };
  });

  console.log('\n================================================================');
  console.log('Provider Live Verification: 3/3 checks PASSED successfully:');
  console.log('  1. Model Catalog Access: PASSED');
  console.log('  2. Ephemeral Token Issuance: PASSED');
  console.log('  3. WebSocket Handshake & Generated Content: PASSED');
  console.log('================================================================');
}

runProviderLiveTest().catch((err) => {
  console.error('Fatal error in Provider Live Test:', err);
  process.exit(1);
});
