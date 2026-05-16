import { useState, useMemo, useEffect } from "react";
import { supabase } from "./supabase";
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Typography, IconButton, Tooltip, Chip, Box,
  Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Stack, Avatar, Alert, TextField, CircularProgress, Card,
  CardActionArea,
} from "@mui/material";
import {
  LightMode, DarkMode, Logout, ChevronLeft, ChevronRight,
  AccessTime, Delete, History, CalendarMonth,
} from "@mui/icons-material";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SHIFT_PRESETS = [
  { label: "10–3",       start: "10:00", end: "15:00" },
  { label: "2–10",       start: "14:00", end: "22:00" },
  { label: "3–11",       start: "15:00", end: "23:00" },
  { label: "4:30–11:30", start: "16:30", end: "23:30" },
  { label: "10–4",       start: "10:00", end: "16:00" },
];

// ─── UTILS ───────────────────────────────────────────────────────────────────

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

// ─── THEME ───────────────────────────────────────────────────────────────────

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

// ─── TIME INPUT ───────────────────────────────────────────────────────────────

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

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────

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
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } }
        });
        if (error) throw error;
        setMessage("Check your email to confirm registration!");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin(data.user);
      }
    } catch (e) {
      setError(e.message);
    }
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

        <Typography variant="overline" color="primary" sx={{ letterSpacing: "0.2em", mb: 0.5 }}>
          Please! Beverage Co.
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 4, letterSpacing: "-0.5px" }}>
          Staff Schedule
        </Typography>

        <Box sx={{ width: "100%", maxWidth: 360 }}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2.5 }}>
              {isRegister ? "Create account" : "Sign in"}
            </Typography>

            {isRegister && (
              <TextField label="Your name" fullWidth size="small" value={name}
                onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />
            )}

            <TextField label="Email" type="email" fullWidth size="small" value={email}
              onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />

            <TextField label="Password" type="password" fullWidth size="small" value={password}
              onChange={e => setPassword(e.target.value)} sx={{ mb: 2.5 }}
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />

            {error && <Alert severity="error" sx={{ mb: 2, py: 0 }}>{error}</Alert>}
            {message && <Alert severity="success" sx={{ mb: 2, py: 0 }}>{message}</Alert>}

            <Button fullWidth variant="contained" size="large" onClick={handleSubmit} disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : isRegister ? "Create account" : "Sign in"}
            </Button>

            <Button fullWidth size="small" color="inherit" sx={{ mt: 1.5 }}
              onClick={() => { setIsRegister(!isRegister); setError(""); setMessage(""); }}>
              {isRegister ? "Already have an account? Sign in" : "No account? Register"}
            </Button>
          </Paper>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

// ─── SHIFT MODAL ─────────────────────────────────────────────────────────────

function ShiftModal({ open, userName, existing, onSave, onClose, mode }) {
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
            {initials(userName)}
          </Avatar>
          <Typography variant="subtitle1" fontWeight={700}>{userName}</Typography>
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
          <Button fullWidth variant="outlined" color="error" startIcon={<Delete />} onClick={() => onSave(null)}>
            Remove shift
          </Button>
        )}
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <Button fullWidth variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
          <Button fullWidth variant="contained" disabled={!start || !end} onClick={() => onSave({ start, end, note })}>
            Save shift
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [monday, setMonday] = useState(getMondayOfWeek(new Date().toISOString().split("T")[0]));
  const [tab, setTab] = useState(0);
  const [modal, setModal] = useState(null);
  const [mode, setMode] = useState("dark");
  const [schedules, setSchedules] = useState([]);
  const [allWeeks, setAllWeeks] = useState([]);
  const [saving, setSaving] = useState(false);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  // Check auth on load
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

  // Load schedule for current week
  useEffect(() => {
    if (!user) return;
    loadWeekSchedule();
  }, [user, monday]);

  // Load all weeks for history
  useEffect(() => {
    if (!user) return;
    loadAllWeeks();
  }, [user]);

  async function loadWeekSchedule() {
    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("week_monday", monday);
    setSchedules(data || []);
  }

  async function loadAllWeeks() {
    const { data } = await supabase
      .from("schedules")
      .select("week_monday")
      .order("week_monday", { ascending: false });
    const unique = [...new Set((data || []).map(r => r.week_monday))];
    setAllWeeks(unique);
  }

  async function saveShift(dayIndex, shift) {
    setSaving(true);
    if (shift === null) {
      await supabase.from("schedules").delete()
        .eq("week_monday", monday)
        .eq("user_id", modal.userId)
        .eq("day_index", dayIndex);
    } else {
      await supabase.from("schedules").upsert({
        week_monday: monday,
        user_id: modal.userId,
        day_index: dayIndex,
        shift_start: shift.start,
        shift_end: shift.end,
        note: shift.note,
      }, { onConflict: "week_monday,user_id,day_index" });
    }
    await loadWeekSchedule();
    await loadAllWeeks();
    setSaving(false);
    setModal(null);
  }

  function getShift(userId, dayIndex) {
    return schedules.find(s => s.user_id === userId && s.day_index === dayIndex);
  }

  function getWeekHours(userId) {
    return schedules
      .filter(s => s.user_id === userId)
      .reduce((sum, s) => sum + parseHours(s.shift_start, s.shift_end), 0);
  }

  function shiftWeek(dir) {
    const d = new Date(monday); d.setDate(d.getDate() + dir * 7);
    setMonday(d.toISOString().split("T")[0]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0e10" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={setUser} mode={mode} setMode={setMode} />;
  }

  const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* AppBar */}
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
            label={userName}
            variant="outlined" size="small"
            sx={{ borderColor: "#F5A62360", color: "#F5A623" }}
          />

          <Tooltip title="Sign out">
            <IconButton size="small" onClick={handleLogout}><Logout fontSize="small" /></IconButton>
          </Tooltip>
        </Toolbar>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, minHeight: 40 }}>
          <Tab icon={<CalendarMonth sx={{ fontSize: 16 }} />} iconPosition="start" label="Schedule" sx={{ minHeight: 40, py: 0 }} />
          <Tab icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" label="History" sx={{ minHeight: 40, py: 0 }} />
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
                    <Box>
                      <Typography variant="body1" fontWeight={600}>{fmtDate(dates[0])} – {fmtDate(dates[6])}</Typography>
                    </Box>
                    <ChevronRight color="primary" />
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}

      {/* SCHEDULE */}
      {tab === 0 && (
        <>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 1.5, px: 2 }}>
            <IconButton onClick={() => shiftWeek(-1)} size="small" sx={{ border: "1px solid", borderColor: "divider" }}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 160, textAlign: "center" }}>
              {fmtDate(weekDates[0])} – {fmtDate(weekDates[6])}
            </Typography>
            <IconButton onClick={() => shiftWeek(1)} size="small" sx={{ border: "1px solid", borderColor: "divider" }}>
              <ChevronRight />
            </IconButton>
          </Box>

          {/* My own schedule row */}
          <Box sx={{ overflowX: "auto", px: 2, pb: 6 }}>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
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
                  <TableRow hover>
                    <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 2 }}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: "#F5A62325", color: "#F5A623" }}>
                          {initials(userName)}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600}>{userName}</Typography>
                      </Stack>
                    </TableCell>
                    {DAYS.map((_, di) => {
                      const sh = getShift(user.id, di);
                      return (
                        <TableCell key={di} align="center"
                          onClick={() => setModal({ userId: user.id, dayIndex: di, existing: sh || null })}
                          sx={{ cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}>
                          {sh ? (
                            <Chip label={`${fmtTime(sh.shift_start)}–${fmtTime(sh.shift_end)}`} size="small"
                              sx={{ bgcolor: "#F5A62320", color: "#F5A623", border: "1px solid #F5A62350", fontSize: 10, height: 22, fontWeight: 600 }} />
                          ) : (
                            <Box sx={{ width: 20, height: 20, border: "1.5px dashed", borderColor: "divider", borderRadius: 1, mx: "auto" }} />
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center">
                      {getWeekHours(user.id) > 0
                        ? <Typography variant="body2" fontWeight={700} color="secondary.main">{getWeekHours(user.id)}h</Typography>
                        : <Typography variant="body2" color="text.disabled">—</Typography>
                      }
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 2 }}>
              Tap any cell to assign or edit your shift
            </Typography>
          </Box>
        </>
      )}

      {modal && (
        <ShiftModal
          open={!!modal}
          userName={userName}
          existing={modal.existing}
          onSave={(shift) => saveShift(modal.dayIndex, shift)}
          onClose={() => setModal(null)}
          mode={mode}
        />
      )}
    </ThemeProvider>
  );
}