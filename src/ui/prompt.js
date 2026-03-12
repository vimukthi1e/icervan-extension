(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  let promptAvailable = false;

  function toOrigin(url) {
    try {
      return new URL(url).origin;
    } catch (_) {
      return '';
    }
  }

  function setButtonsDisabled(disabled) {
    ['continueOnce', 'alwaysAllow', 'alwaysBlock', 'cancel'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
    });
  }

  function renderSummary(context) {
    const source = context.sourceUrl || 'unknown source';
    const target = context.targetUrl || 'unknown destination';
    const sourceOrigin = toOrigin(source) || '(unknown)';
    const targetOrigin = toOrigin(target) || '(unknown)';
    const risk = context.decision && context.decision.classification ? context.decision.classification : 'unknown';

    document.getElementById('summary').innerHTML = [
      `<p><strong>From:</strong> ${source}</p>`,
      `<p><strong>To:</strong> ${target}</p>`,
      `<p><strong>Source origin:</strong> ${sourceOrigin}</p>`,
      `<p><strong>Destination origin:</strong> ${targetOrigin}</p>`,
      `<p><strong>Risk class:</strong> ${risk}</p>`
    ].join('');
  }

  function renderReasons(context) {
    const reasons = (context.decision && context.decision.reasons) || [];
    const list = document.getElementById('reasons');
    if (!reasons.length) {
      list.innerHTML = '<li>No detailed reasons were recorded.</li>';
      return;
    }

    const labels = {
      main_frame: 'Top-level navigation attempt',
      cross_origin: 'Cross-origin destination',
      no_recent_gesture: 'No recent trusted user gesture',
      popup_target: 'Popup/new-tab style navigation',
      redirect_chain: 'Redirect chain detected',
      script_navigation_hook: 'Script navigation signal detected',
      same_document_signal: 'Recent same-document navigation trick signal',
      history_burst: 'Rapid history/hash activity burst',
      repeated_suspicious_origin: 'Repeated suspicious attempts for this origin'
    };

    list.innerHTML = reasons.map((reason) => `<li>${labels[reason] || reason}</li>`).join('');
  }

  async function load() {
    const prompt = await api.runtime.sendMessage({ type: 'NAVGUARD_GET_PROMPT', id });
    if (!prompt) {
      document.getElementById('summary').textContent = 'Prompt not found or expired.';
      document.getElementById('details').textContent = 'No technical details available.';
      setButtonsDisabled(true);
      return;
    }
    promptAvailable = true;
    renderSummary(prompt.context);
    renderReasons(prompt.context);
    document.getElementById('details').textContent = JSON.stringify(prompt.context, null, 2);
  }

  async function resolve(action) {
    if (!promptAvailable) return;
    setButtonsDisabled(true);
    document.getElementById('status').textContent = 'Applying decision…';

    const result = await api.runtime.sendMessage({ type: 'NAVGUARD_RESOLVE_PROMPT', id, action });
    if (result && result.ok) {
      document.getElementById('status').textContent = 'Decision applied. Closing…';
      setTimeout(() => {
        try {
          window.close();
        } catch (_) {}
      }, 250);
      return;
    }

    document.getElementById('status').textContent = 'Failed to apply decision. This prompt may have expired.';
    setButtonsDisabled(false);
  }

  document.getElementById('continueOnce').addEventListener('click', () => resolve('continue_once'));
  document.getElementById('alwaysAllow').addEventListener('click', () => resolve('always_allow_origin'));
  document.getElementById('alwaysBlock').addEventListener('click', () => resolve('always_block_origin'));
  document.getElementById('cancel').addEventListener('click', () => resolve('cancel_stay'));

  load();
})();
