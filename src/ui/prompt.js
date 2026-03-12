(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  async function load() {
    const prompt = await api.runtime.sendMessage({ type: 'NAVGUARD_GET_PROMPT', id });
    if (!prompt) {
      document.getElementById('details').textContent = 'Prompt not found or expired.';
      return;
    }
    document.getElementById('details').textContent = JSON.stringify(prompt.context, null, 2);
  }

  async function resolve(action) {
    const result = await api.runtime.sendMessage({ type: 'NAVGUARD_RESOLVE_PROMPT', id, action });
    document.getElementById('status').textContent = result && result.ok ? 'Done.' : 'Failed.';
  }

  document.getElementById('continueOnce').addEventListener('click', () => resolve('continue_once'));
  document.getElementById('alwaysAllow').addEventListener('click', () => resolve('always_allow_origin'));
  document.getElementById('alwaysBlock').addEventListener('click', () => resolve('always_block_origin'));
  document.getElementById('cancel').addEventListener('click', () => resolve('cancel_stay'));

  load();
})();
