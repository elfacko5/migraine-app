// Side-effect module, imported **first** in main.tsx: Data → Delete all data
// asked for a delete and reloaded, and it must run before anything else is
// even evaluated. Module bodies run in import order, so this lands before
// `lib/supabase`'s `createClient` (pulled in by App's imports) can read a
// session — today that read is behind an `await` and would lose the race
// anyway, but this makes the order certain rather than lucky.
import { runPendingDelete } from './utils/backup';
import { cancelNotification, clearDeliveredReminders } from './utils/notifications';

runPendingDelete(cancelNotification, clearDeliveredReminders);
