// Re-export everything from the central store so existing imports of
// "@/lib/store-server" continue to work without changes.
export {
  getAllTasks,
  getTasksByDate,
  getTasksByWeek,
  addTask,
  completeTask,
  deleteTask,
  toggleTask,
  updateTask,
  getAllVoiceLogs,
  addVoiceLog,
  getAllCalendars,
  addCalendar,
  addEvent,
  updateUser,
  setWeeklyPlan,
  getAppState,
  getState,
  replaceState,
  applyCommands,
} from "./store";
