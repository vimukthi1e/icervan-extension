(function () {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  document.getElementById('openOptions').addEventListener('click', () => {
    api.runtime.openOptionsPage();
  });
  document.getElementById('openLogs').addEventListener('click', () => {
    api.tabs.create({ url: api.runtime.getURL('src/ui/logs.html') });
  });
})();
