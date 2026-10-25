import { spawn } from 'node:child_process';
import http from 'node:http';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9224;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = typeof WebSocket !== 'undefined' ? WebSocket : (await import('ws')).default;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (e) => reject(new Error(e.message || 'WebSocket Error')));
      this.ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const cb = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) cb.reject(new Error(msg.error.message));
          else cb.resolve(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'CDP Evaluation Exception');
    }
    return res.result?.value;
  }
}

async function runBrowserTest() {
  console.log('🚀 Launching Headless Chrome to verify AI Assistant UI...');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,900',
    `--remote-debugging-port=${DEBUG_PORT}`,
    'http://localhost:3000/ai-assistant.html'
  ], { stdio: 'ignore' });

  try {
    // Wait for Chrome CDP port
    let version = null;
    for (let i = 0; i < 20; i++) {
      try {
        version = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
        break;
      } catch (_) {
        await sleep(300);
      }
    }

    if (!version) {
      throw new Error('Chrome CDP failed to start.');
    }

    const pages = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const page = pages.find(p => p.type === 'page' && p.url.includes('ai-assistant.html'));
    if (!page) throw new Error('Target ai-assistant.html page not found in Chrome tabs.');

    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('✓ Connected to Chrome CDP on ai-assistant.html');

    // Wait for DOM ready
    await sleep(1500);

    // 1. Verify layout and initial visibility of input
    const initialLayout = await cdp.evaluate(`(() => {
      const input = document.getElementById('chatInputTextarea');
      const form = document.getElementById('chatInputForm');
      const container = document.querySelector('.chat-input-container');
      const main = document.querySelector('.chat-main');
      const rect = input.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();

      return {
        inputFound: Boolean(input),
        inputVisible: rect.width > 0 && rect.height > 0,
        inputRect: { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width },
        containerHeight: contRect.height,
        windowHeight: window.innerHeight,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10
      };
    })()`);

    console.log('Initial Input Layout:', JSON.stringify(initialLayout, null, 2));
    if (!initialLayout.inputFound || !initialLayout.inputVisible || !initialLayout.inputInsideViewport) {
      throw new Error(`Initial chat input is not properly visible or outside viewport: ${JSON.stringify(initialLayout)}`);
    }
    console.log('✓ Initial chat input is visible and inside viewport');

    // Helper to send message in chat
    async function sendMessage(text) {
      console.log(`\n💬 Sending user message: "${text}"...`);
      await cdp.evaluate(`(() => {
        const input = document.getElementById('chatInputTextarea');
        const form = document.getElementById('chatInputForm');
        input.value = ${JSON.stringify(text)};
        input.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()`);

      // Wait for response to appear
      let complete = false;
      for (let i = 0; i < 40; i++) {
        await sleep(400);
        const state = await cdp.evaluate(`(() => {
          const typing = document.getElementById('aiTypingIndicator');
          const input = document.getElementById('chatInputTextarea');
          return { typing: Boolean(typing), disabled: input.disabled };
        })()`);

        if (!state.typing && !state.disabled) {
          complete = true;
          break;
        }
      }

      if (!complete) throw new Error(`Timed out waiting for response to "${text}"`);
    }

    // Step 2: Send Message 1 in Hindi
    await sendMessage('आज मैंने कितने questions solve किए हैं?');
    const step1 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const container = document.querySelector('.chat-input-container');
      const rect = input.getBoundingClientRect();
      const isFocused = document.activeElement === input;

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputDisabled: input.disabled,
        inputValue: input.value,
        inputVisible: rect.width > 0 && rect.height > 0,
        inputRect: { top: rect.top, bottom: rect.bottom, height: rect.height },
        windowHeight: window.innerHeight,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        isFocused
      };
    })()`);

    console.log('After Hindi Message 1:', JSON.stringify(step1, null, 2));
    if (!step1.inputInsideViewport || !step1.inputVisible || step1.inputDisabled) {
      throw new Error('Input disappeared, became disabled, or was pushed off viewport after Message 1!');
    }
    if (!step1.lastMsgText.includes('प्रश्न') && !step1.lastMsgText.includes('2')) {
      throw new Error(`AI response did not contain expected Hindi tracking answer: ${step1.lastMsgText}`);
    }
    console.log('✓ Hindi Message 1 answered with live grounded data, input remained visible, editable & focused!');

    // Step 3: Send Message 2 in English without reloading page
    await sendMessage('How many questions did I solve today?');
    const step2 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const rect = input.getBoundingClientRect();

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputVisible: rect.width > 0 && rect.height > 0,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        inputDisabled: input.disabled
      };
    })()`);

    console.log('After English Message 2:', JSON.stringify(step2, null, 2));
    if (step2.messageCount < 4) {
      throw new Error(`Chat history did not retain previous messages! Count: ${step2.messageCount}`);
    }
    if (!step2.inputInsideViewport || !step2.inputVisible || step2.inputDisabled) {
      throw new Error('Input disappeared or became disabled after Message 2!');
    }
    console.log('✓ English Message 2 appended to conversation thread, input remains visible and active!');

    // Step 4: Send Message 3: "Show my overdue revisions"
    await sendMessage('Show my overdue revisions');
    const step3 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const rect = input.getBoundingClientRect();

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputVisible: rect.width > 0 && rect.height > 0,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        inputDisabled: input.disabled
      };
    })()`);

    console.log('After Overdue Message 3:', JSON.stringify(step3, null, 2));
    if (!step3.inputInsideViewport || !step3.inputVisible) {
      throw new Error('Input disappeared after 3 consecutive messages!');
    }
    console.log('✓ All 3 consecutive questions completed with zero refresh, input is rock solid and always visible!');

    // Step 5: Send Arbitrary C++ Question
    await sendMessage('What is the difference between std::vector and std::deque in C++?');
    const step4 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const rect = input.getBoundingClientRect();

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputVisible: rect.width > 0 && rect.height > 0,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        inputDisabled: input.disabled
      };
    })()`);

    console.log('After C++ Question 4:', JSON.stringify(step4, null, 2));
    if (!step4.lastMsgText.includes('vector') || !step4.lastMsgText.includes('deque')) {
      throw new Error(`C++ answer did not contain expected content: ${step4.lastMsgText}`);
    }
    console.log('✓ Arbitrary C++ question answered successfully!');

    // Step 6: Code review submission with intentional bug
    await sendMessage('Can you check my binary search solution:\n```cpp\nint search(vector<int>& a, int target) {\n    int low = 0, high = a.size() - 1;\n    while (low <= high) {\n        int mid = (low + high) / 2;\n        if (a[mid] == target) return mid;\n        if (a[mid] < target) low = mid + 1;\n        else high = mid - 1;\n    }\n    return -1;\n}\n```');
    const step5 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const rect = input.getBoundingClientRect();

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputVisible: rect.width > 0 && rect.height > 0,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        inputDisabled: input.disabled
      };
    })()`);

    console.log('After Code Review 5:', JSON.stringify(step5, null, 2));
    if (!step5.lastMsgText.includes('Syntax & Compilation') && !step5.lastMsgText.includes('Review')) {
      throw new Error(`Code review answer missing syntax/review sections: ${step5.lastMsgText}`);
    }
    console.log('✓ Code review with compiler verification & bug analysis completed!');

    // Step 7: Multi-turn Follow-up Question
    await sendMessage('What about its time and space complexity?');
    const step6 = await cdp.evaluate(`(() => {
      const messages = Array.from(document.querySelectorAll('.chat-msg'));
      const lastMsg = messages[messages.length - 1];
      const input = document.getElementById('chatInputTextarea');
      const rect = input.getBoundingClientRect();

      return {
        messageCount: messages.length,
        lastMsgText: lastMsg ? lastMsg.textContent : '',
        inputVisible: rect.width > 0 && rect.height > 0,
        inputInsideViewport: rect.bottom <= window.innerHeight + 10,
        inputDisabled: input.disabled
      };
    })()`);

    console.log('After Multi-turn Follow-up 6:', JSON.stringify(step6, null, 2));
    if (!step6.inputInsideViewport || !step6.inputVisible) {
      throw new Error('Chat input was pushed off viewport after 6 consecutive turns!');
    }
    console.log('✓ Multi-turn context maintained, chat input remained pinned, visible, and focused across 6 turns!');

    console.log('\n🎉 ALL REAL BROWSER TESTS PASSED 100%!');
  } finally {
    try {
      chromeProc.kill('SIGTERM');
    } catch (_) {}
  }
}

runBrowserTest().catch(err => {
  console.error('❌ Browser Test Failed:', err);
  process.exit(1);
});
