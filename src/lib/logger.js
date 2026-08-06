export function addLog(user, action, details = "") {
  const logs = JSON.parse(localStorage.getItem("axion_logs") || "[]");
  const newLog = {
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    user: user || "Sistema",
    action,
    details
  };
  logs.unshift(newLog); // Add to beginning
  // Keep only last 1000 logs to prevent infinite growth
  if (logs.length > 1000) logs.pop();
  localStorage.setItem("axion_logs", JSON.stringify(logs));
}

export function getLogs() {
  return JSON.parse(localStorage.getItem("axion_logs") || "[]");
}
