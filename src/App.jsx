import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase";
import html2pdf from "html2pdf.js";
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Typography, IconButton, Tooltip, Chip, Box,
  Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Stack, Avatar, Alert, TextField, CircularProgress, Card,
  CardActionArea, MenuItem, Select, FormControl, InputLabel,
} from "@mui/material";
import {
  LightMode, DarkMode, Logout, ChevronLeft, ChevronRight,
  AccessTime, Delete, History, CalendarMonth, PersonAdd, People, PictureAsPdf,
} from "@mui/icons-material";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_PRESETS = [
  { label: "10–3",       start: "10:00", end: "15:00" },
  { label: "2–10",       start: "14:00", end: "22:00" },
  { label: "3–11",       start: "15:00", end: "23:00" },
  { label: "4:30–11:30", start: "16:30", end: "23:30" },
  { label: "10–4",       start: "10:00", end: "16:00" },
];

const ROLE_META = {
  admin:      { label: "Manager",   color: "#F5A623" },
  cook_admin: { label: "Cook",      color: "#F5A623" },
  chef:       { label: "Chef",      color: "#FF9F43" },
  bartender:  { label: "Bartender", color: "#4ECDC4" },
  cook:       { label: "Cook",      color: "#FF6B6B" },
  staff:      { label: "Staff",     color: "#C3A6FF" },
};

const ROLE_ORDER = { admin: 0, cook_admin: 0, chef: 1, bartender: 2, cook: 3, staff: 4 };

function getMondayOfWeek(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}

function getWeekDates(mondayStr) {
  const monday = new Date(mondayStr);
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });
}

function parseHours(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let h = eh + em / 60 - sh - sm / 60;
  if (h < 0) h += 24;
  return Math.round(h * 10) / 10;
}

function fmtDate(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, "0")}${ampm}`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function buildTheme(mode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: "#F5A623" },
      secondary: { main: "#4ECDC4" },
      background: {
        default: mode === "dark" ? "#0a0e10" : "#f5f1eb",
        paper:   mode === "dark" ? "#111820" : "#ffffff",
      },
    },
    typography: { fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" },
    shape: { borderRadius: 10 },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: mode === "dark" ? "#0d1519" : "#ffffff",
            borderBottom: `1px solid ${mode === "dark" ? "#1e2e35" : "#e5ddd0"}`,
            boxShadow: "none",
          },
        },
      },
      MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: mode === "dark" ? "#1a2830" : "#e5ddd0", padding: "8px 10px" },
          head: {
            fontWeight: 700, fontSize: 11, letterSpacing: "0.08em",
            textTransform: "uppercase", color: mode === "dark" ? "#6a9aaa" : "#8a7a65",
            backgroundColor: mode === "dark" ? "#0d1519" : "#f0ece4",
          },
        },
      },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    },
  });
}

function TimeInput({ label, value, onChange, mode }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600, letterSpacing: "0.06em", color: mode === "dark" ? "#6a9aaa" : "#8a7a65", fontSize: 11 }}>
        {label.toUpperCase()}
      </Typography>
      <Box sx={{ border: "1px solid", borderColor: mode === "dark" ? "#2a3a45" : "#d5c8b5", borderRadius: 2, "&:focus-within": { borderColor: "primary.main" } }}>
        <input type="time" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", border: "none", outline: "none", background: "transparent", color: mode === "dark" ? "#e0eef0" : "#2a2218", fontSize: 15, fontFamily: "inherit", boxSizing: "border-box" }} />
      </Box>
    </Box>
  );
}

function LoginScreen({ onLogin, mode, setMode }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const theme = buildTheme(mode);

  async function handleSubmit() {
    setError(""); setMessage(""); setLoading(true);
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (error) throw error;
        setMessage("Check your email to confirm registration!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin(data.user);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 3, position: "relative" }}>
        <Box sx={{ position: "absolute", top: 16, right: 16 }}>
          <IconButton onClick={() => setMode(m => m === "dark" ? "light" : "dark")} color="primary">
            {mode === "dark" ? <LightMode /> : <DarkMode />}
          </IconButton>
        </Box>
        <Typography variant="overline" color="primary" sx={{ letterSpacing: "0.2em", mb: 0.5 }}>Please! Beverage Co.</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 4, letterSpacing: "-0.5px" }}>Staff Schedule</Typography>
        <Box sx={{ width: "100%", maxWidth: 360 }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>{isRegister ? "Create account" : "Sign in"}</Typography>
            {isRegister && <TextField label="Your name" fullWidth size="small" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />}
            <TextField label="Email" type="email" fullWidth size="small" value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />
            <TextField label="Password" type="password" fullWidth size="small" value={password} onChange={e => setPassword(e.target.value)} sx={{ mb: 2.5 }} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            {error && <Alert severity="error" sx={{ mb: 2, py: 0 }}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2, py: 0 }}>{message}</Alert>}
            <Button fullWidth variant="contained" size="large" onClick={handleSubmit} disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : isRegister ? "Create account" : "Sign in"}
            </Button>
            <Button fullWidth size="small" color="inherit" sx={{ mt: 1.5 }} onClick={() => { setIsRegister(!isRegister); setError(""); setMessage(""); }}>
              {isRegister ? "Already have an account? Sign in" : "No account? Register"}
            </Button>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function ShiftModal({ open, staffName, existing, onSave, onClose, mode }) {
  const [start, setStart] = useState(existing?.shift_start?.slice(0, 5) || "");
  const [end, setEnd]     = useState(existing?.shift_end?.slice(0, 5)   || "");
  const [note, setNote]   = useState(existing?.note || "");
  const [preset, setPreset] = useState("");
  const hours = parseHours(start, end);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: "#F5A62325", color: "#F5A623", width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
            {initials(staffName)}
          </Avatar>
          <Typography variant="subtitle1" fontWeight={700}>{staffName}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, letterSpacing: "0.08em" }}>QUICK PRESETS</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          {SHIFT_PRESETS.map(p => (
            <Chip key={p.label} label={p.label} size="small" clickable
              variant={preset === p.label ? "filled" : "outlined"}
              color={preset === p.label ? "primary" : "default"}
              onClick={() => { setPreset(p.label); setStart(p.start); setEnd(p.end); }} />
          ))}
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TimeInput label="Start" value={start} onChange={v => { setStart(v); setPreset(""); }} mode={mode} />
          <TimeInput label="End"   value={end}   onChange={v => { setEnd(v);   setPreset(""); }} mode={mode} />
        </Stack>
        {hours > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            <AccessTime sx={{ fontSize: 16, color: "secondary.main" }} />
            <Typography variant="body2" color="secondary.main" fontWeight={600}>{hours} hours</Typography>
          </Stack>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600, fontSize: 11 }}>NOTE (OPTIONAL)</Typography>
        <Box sx={{ border: "1px solid", borderColor: mode === "dark" ? "#2a3a45" : "#d5c8b5", borderRadius: 2 }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. training shift"
            style={{ width: "100%", padding: "10px 12px", border: "none", outline: "none", background: "transparent", color: mode === "dark" ? "#e0eef0" : "#2a2218", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: "column", gap: 1 }}>
        {existing && (
          <Button fullWidth variant="outlined" color="error" startIcon={<Delete />} onClick={() => onSave(null)}>Remove shift</Button>
        )}
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <Button fullWidth variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
          <Button fullWidth variant="contained" disabled={!start || !end} onClick={() => onSave({ start, end, note })}>Save shift</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

function AddStaffModal({ open, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setLoading(true);
    await onAdd({ name: name.trim(), role });
    setName(""); setRole("staff");
    setLoading(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight={700}>Add Staff Member</DialogTitle>
      <DialogContent>
        <TextField label="Name" fullWidth size="small" value={name} onChange={e => setName(e.target.value)} sx={{ mb: 2, mt: 1 }} />
        <FormControl fullWidth size="small">
          <InputLabel>Role</InputLabel>
          <Select value={role} label="Role" onChange={e => setRole(e.target.value)}>
            {Object.entries(ROLE_META).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={loading || !name.trim()}>
          {loading ? <CircularProgress size={18} color="inherit" /> : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monday, setMonday] = useState(getMondayOfWeek(new Date().toISOString().split("T")[0]));
  const [tab, setTab] = useState(0);
  const [modal, setModal] = useState(null);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [mode, setMode] = useState("dark");
  const [staff, setStaff] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [allWeeks, setAllWeeks] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    loadStaff();
    loadAllWeeks();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadWeekSchedule();
  }, [user, monday]);

  async function loadStaff() {
    const { data } = await supabase.from("staff").select("*");
    const sorted = (data || []).sort((a, b) => (ROLE_ORDER[a.role] ?? 5) - (ROLE_ORDER[b.role] ?? 5));
    setStaff(sorted);
    const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    const me = sorted.find(s => s.name.toLowerCase() === userName.toLowerCase());
    setIsAdmin(me?.role === "admin" || me?.role === "cook_admin");
  }

  async function loadWeekSchedule() {
    const { data } = await supabase.from("schedules").select("*").eq("week_monday", monday);
    setSchedules(data || []);
  }

  async function loadAllWeeks() {
    const { data } = await supabase.from("schedules").select("week_monday").order("week_monday", { ascending: false });
    const unique = [...new Set((data || []).map(r => r.week_monday))];
    setAllWeeks(unique);
  }

  async function saveShift(staffId, dayIndex, shift) {
    if (shift === null) {
      await supabase.from("schedules").delete()
        .eq("week_monday", monday).eq("staff_id", staffId).eq("day_index", dayIndex);
    } else {
      await supabase.from("schedules").upsert({
        week_monday: monday, staff_id: staffId, day_index: dayIndex,
        shift_start: shift.start, shift_end: shift.end, note: shift.note,
      }, { onConflict: "week_monday,staff_id,day_index" });
    }
    await loadWeekSchedule();
    await loadAllWeeks();
    setModal(null);
  }

  async function addStaff({ name, role }) {
    await supabase.from("staff").insert({ name, role });
    await loadStaff();
  }

  async function removeStaff(id) {
    if (!window.confirm("Remove this staff member?")) return;
    await supabase.from("staff").delete().eq("id", id);
    await loadStaff();
  }

  function getShift(staffId, dayIndex) {
    return schedules.find(s => s.staff_id === staffId && s.day_index === dayIndex);
  }

  function getWeekHours(staffId) {
    return schedules.filter(s => s.staff_id === staffId)
      .reduce((sum, s) => sum + parseHours(s.shift_start, s.shift_end), 0);
  }

  function shiftWeek(dir) {
    const d = new Date(monday); d.setDate(d.getDate() + dir * 7);
    setMonday(d.toISOString().split("T")[0]);
  }

  function exportPDF() {
  const weekLabel = `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}`;
  
  const rows = staff.map(s => {
    const shifts = DAYS.map((_, di) => {
      const sh = getShift(s.id, di);
      return sh ? `${fmtTime(sh.shift_start)}–${fmtTime(sh.shift_end)}` : "";
    });
    const hrs = getWeekHours(s.id);
    return `<tr>
      <td>${s.name}<br><small>${ROLE_META[s.role]?.label || s.role}</small></td>
      ${shifts.map(sh => `<td>${sh}</td>`).join("")}
      <td><b>${hrs > 0 ? hrs + "h" : "—"}</b></td>
    </tr>`;
  }).join("");

  const html = `<html><head><style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h2 { margin-bottom: 4px; }
    p { color: #666; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f0f0f0; padding: 8px; border: 1px solid #ccc; font-weight: bold; }
    td { padding: 7px 8px; border: 1px solid #ccc; text-align: center; }
    td:first-child { text-align: left; font-weight: 600; }
    small { color: #888; font-weight: 400; }
    tr:nth-child(even) { background: #fafafa; }
  </style></head><body>
    <h2>Please! Beverage Co. — Staff Schedule</h2>
    <p>Week: ${weekLabel}</p>
    <table>
      <tr>
        <th>Name</th>
        ${DAYS.map((d, i) => `<th>${d}<br><small>${fmtDate(weekDates[i])}</small></th>`).join("")}
        <th>Hrs</th>
      </tr>
      ${rows}
    </table>
  </body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.print();
}

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0e10" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} mode={mode} setMode={setMode} />;

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
  const modalStaff = modal ? staff.find(s => s.id === modal.staffId) : null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" color="default">
        <Toolbar sx={{ gap: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: "0.2em", lineHeight: 1, display: "block", fontSize: 10 }}>
              Please! Beverage Co.
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 700 }}>Schedule</Typography>
          </Box>
          <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
            <IconButton onClick={() => setMode(m => m === "dark" ? "light" : "dark")} size="small">
              {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Chip
            avatar={<Avatar sx={{ bgcolor: "#F5A62330 !important", color: "#F5A623 !important", fontSize: "11px !important", fontWeight: 700 }}>{initials(userName)}</Avatar>}
            label={userName} variant="outlined" size="small"
            sx={{ borderColor: "#F5A62360", color: "#F5A623" }}
          />
          <Tooltip title="Sign out">
            <IconButton size="small" onClick={() => supabase.auth.signOut()}><Logout fontSize="small" /></IconButton>
          </Tooltip>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, minHeight: 40 }}>
          <Tab icon={<CalendarMonth sx={{ fontSize: 16 }} />} iconPosition="start" label="Schedule" sx={{ minHeight: 40, py: 0 }} />
          <Tab icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" label="History" sx={{ minHeight: 40, py: 0 }} />
          {isAdmin && <Tab icon={<People sx={{ fontSize: 16 }} />} iconPosition="start" label="Staff" sx={{ minHeight: 40, py: 0 }} />}
        </Tabs>
      </AppBar>

      {/* HISTORY */}
      {tab === 1 && (
        <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.15em" }}>All Weeks</Typography>
          {allWeeks.length === 0 && <Typography color="text.disabled" sx={{ mt: 2 }}>No saved weeks yet.</Typography>}
          <Stack spacing={1.5} sx={{ mt: 1.5 }}>
            {allWeeks.map(wk => {
              const dates = getWeekDates(wk);
              const active = wk === monday;
              return (
                <Card key={wk} variant="outlined" sx={{ borderColor: active ? "primary.main" : "divider", bgcolor: active ? "#F5A62310" : "background.paper" }}>
                  <CardActionArea onClick={() => { setMonday(wk); setTab(0); }} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body1" fontWeight={600}>{fmtDate(dates[0])} – {fmtDate(dates[6])}</Typography>
                    <ChevronRight color="primary" />
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* STAFF */}
      {tab === 2 && isAdmin && (
        <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.15em" }}>Staff Members</Typography>
            <Button variant="contained" size="small" startIcon={<PersonAdd />} onClick={() => setAddStaffOpen(true)}>
              Add Staff
            </Button>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 1.5 }}>
            {staff.map(s => (
              <Paper key={s.id} variant="outlined" sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Avatar sx={{ width: 36, height: 36, fontSize: 13, fontWeight: 700, bgcolor: (ROLE_META[s.role]?.color || "#F5A623") + "25", color: ROLE_META[s.role]?.color || "#F5A623" }}>
                  {initials(s.name)}
                </Avatar>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{ROLE_META[s.role]?.label || s.role}</Typography>
                </Box>
                <Chip label={ROLE_META[s.role]?.label || s.role} size="small"
                  sx={{ bgcolor: (ROLE_META[s.role]?.color || "#F5A623") + "20", color: ROLE_META[s.role]?.color || "#F5A623", border: `1px solid ${ROLE_META[s.role]?.color || "#F5A623"}40` }} />
                {s.role !== "admin" && s.role !== "cook_admin" && (
                  <IconButton size="small" color="error" onClick={() => removeStaff(s.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* SCHEDULE */}
      {tab === 0 && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 1.5, px: 2 }}>
            <IconButton onClick={() => shiftWeek(-1)} size="small" sx={{ border: "1px solid", borderColor: "divider" }}><ChevronLeft /></IconButton>
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160, textAlign: "center" }}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
            </Typography>
            <IconButton onClick={() => shiftWeek(1)} size="small" sx={{ border: "1px solid", borderColor: "divider" }}><ChevronRight /></IconButton>
          </Box>

          <Box sx={{ overflowX: "auto", px: 2, pb: 6 }}>
            <TableContainer id="schedule-table" component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              {/* PDF header - only visible in PDF */}
              <Box sx={{ display: "none" }} className="pdf-header">
                <Typography variant="h5" fontWeight={700} sx={{ p: 2, pb: 0 }}>Please! Beverage Co. — Staff Schedule</Typography>
                <Typography variant="body2" sx={{ px: 2, pb: 1, color: "#666" }}>
                  Week: {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
                </Typography>
              </Box>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 110, position: "sticky", left: 0, zIndex: 3 }}>NAME</TableCell>
                    {DAYS.map((d, i) => (
                      <TableCell key={d} align="center" sx={{ minWidth: 90 }}>
                        <div>{d}</div>
                        <div style={{ fontSize: 9, opacity: 0.6, fontWeight: 400 }}>{fmtDate(weekDates[i])}</div>
                      </TableCell>
                    ))}
                    <TableCell align="center" sx={{ minWidth: 55 }}>HRS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staff.map(s => {
                    const color = ROLE_META[s.role]?.color || "#F5A623";
                    const hrs = getWeekHours(s.id);
                    return (
                      <TableRow key={s.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                        <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: color + "25", color }}>
                              {initials(s.name)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{ROLE_META[s.role]?.label}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        {DAYS.map((_, di) => {
                          const sh = getShift(s.id, di);
                          return (
                            <TableCell key={di} align="center"
                              onClick={() => isAdmin && setModal({ staffId: s.id, dayIndex: di, existing: sh || null })}
                              sx={{ cursor: isAdmin ? "pointer" : "default", "&:hover": isAdmin ? { bgcolor: "action.hover" } : {} }}>
                              {sh ? (
                                <Chip label={`${fmtTime(sh.shift_start)}–${fmtTime(sh.shift_end)}`} size="small"
                                  sx={{ bgcolor: color + "20", color, border: `1px solid ${color}50`, fontSize: 10, height: 22, fontWeight: 600 }} />
                              ) : isAdmin ? (
                                <Box sx={{ width: 20, height: 20, border: "1.5px dashed", borderColor: "divider", borderRadius: 1, mx: "auto" }} />
                              ) : null}
                            </TableCell>
                          );
                        })}
                        <TableCell align="center">
                          {hrs > 0
                            ? <Typography variant="body2" fontWeight={700} color="secondary.main">{hrs}h</Typography>
                            : <Typography variant="body2" color="text.disabled">—</Typography>
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {isAdmin && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.disabled">
                  Tap any cell to assign or edit a shift
                </Typography>
                <Button variant="contained" size="small" startIcon={<PictureAsPdf />} onClick={exportPDF}>
                  Export PDF
                </Button>
              </Stack>
            )}
          </Box>
        </>
      )}

      {modal && (
        <ShiftModal
          open={!!modal}
          staffName={modalStaff?.name || ""}
          existing={modal.existing}
          onSave={(shift) => saveShift(modal.staffId, modal.dayIndex, shift)}
          onClose={() => setModal(null)}
          mode={mode}
        />
      )}

      <AddStaffModal
        open={addStaffOpen}
        onClose={() => setAddStaffOpen(false)}
        onAdd={addStaff}
      />
    </ThemeProvider>
  );
}