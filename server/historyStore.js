const history = [];

function addEntry(entry) {
  if (!entry) return null;
  const id = entry.id || `history-${Date.now()}`;
  const record = {
    id,
    taskDescription: entry.taskDescription || '',
    outputFormat: entry.outputFormat || 'document',
    summary: entry.summary || null,
    document: entry.document || null,
    createdAt: entry.createdAt || Date.now(),
  };

  // prepend and trim
  history.unshift(record);
  if (history.length > 50) {
    history.pop();
  }

  return id;
}

function listEntries(limit = 20) {
  return history.slice(0, limit);
}

function getEntry(id) {
  return history.find((item) => item.id === id) || null;
}

export default {
  addEntry,
  listEntries,
  getEntry,
};
