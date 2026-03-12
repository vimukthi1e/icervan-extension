(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  async function render() {
    const logs = await api.runtime.sendMessage({ type: 'NAVGUARD_GET_LOGS' });
    document.getElementById('output').textContent = JSON.stringify(logs, null, 2);
  }

  async function onExport() {
    const logs = await api.runtime.sendMessage({ type: 'NAVGUARD_EXPORT_LOGS' });
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `navguard-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('refresh').addEventListener('click', render);
  document.getElementById('export').addEventListener('click', onExport);
  document.getElementById('clear').addEventListener('click', async () => {
    await api.runtime.sendMessage({ type: 'NAVGUARD_CLEAR_LOGS' });
    render();
  });

  render();
})();
