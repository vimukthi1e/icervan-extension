(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  function summarize(logs) {
    const counts = {};
    for (const item of logs) {
      const k = item.event || 'unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return {
      total: logs.length,
      counts
    };
  }

  async function render() {
    const logs = await api.runtime.sendMessage({ type: 'NAVGUARD_GET_LOGS' });
    const summary = summarize(logs);
    const lines = [
      `Total entries: ${summary.total}`,
      `By event: ${JSON.stringify(summary.counts)}`,
      '',
      JSON.stringify(logs, null, 2)
    ];
    document.getElementById('output').textContent = lines.join('\n');
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
