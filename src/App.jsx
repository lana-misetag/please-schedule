import { useState, useMemo } from "react";
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Typography, IconButton, Tooltip, Chip, Box,
  Tabs, Tab, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Grid, Card, CardActionArea, CardContent, Stack,
  Avatar, Alert,
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

const ROLE_META = {
  admin:     { label: "Manager",   color: "#F5A623" },
  bartender: { label: "Bartender", color: "#4ECDC4" },
  cook:      { label: "Cook",      color: "#FF6B6B" },
  host:      { label: "Host",      color: "#95E77E" },
  staff:     { label: "Staff",     color: "#C3A6FF" },
};

const DEMO_USERS = [
  { id: 9,  name: "Chris",   role: "admin",     pin: "1111" },
  { id: 2,  name: "Noelle",  role: "bartender", pin: "2222" },
  { id: 3,  name: "Ryan",    role: "bartender", pin: "3333" },
  { id: 4,  name: "Lana",    role: "cook",      pin: "4444" },
  { id: 5,  name: "Adithya", role: "cook",      pin: "5555" },
  { id: 6,  name: "Kiernen", role: "host",      pin: "6666" },
  { id: 7,  name: "Brett",   role: "bartender", pin: "7777" },
  { id: 8,  name: "Sarah",   role: "staff",     pin: "8888" },
  { id: 10, name: "Adam",    role: "bartender", pin: "9999" },
  { id: 11, name: "Kamila",  role: "host",      pin: "0000" },
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
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const r = localStorage.getItem("please_schedule_v3");
    if (r) return JSON.parse(r);
  } catch {}
  return { schedules: {}, users: DEMO_USERS };
}

function saveData(d) {
  try { localStorage.setItem("please_schedule_v3", JSON.stringify(d)); } catch {}
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
    typography: {
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      h6: { fontWeight: 700, letterSpacing: "-0.3px" },
    },
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
      MuiTab: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600, fontSize: 14 } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, fontSize: 11 } },
      },
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
      MuiButton: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 16 } },
      },
    },
  });
}

// ─── TIME INPUT COMPONENT ─────────────────────────────────────────────────────

function TimeInput({ label, value, onChange, mode }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Typography variant="caption" sx={{
        display: "block", mb: 0.5, fontWeight: 600, letterSpacing: "0.06em",
        color: mode === "dark" ? "#6a9aaa" : "#8a7a65", fontSize: 11,
      }}>
        {label.toUpperCase()}
      </Typography>
      <Box sx={{
        border: "1px solid", borderColor: mode === "dark" ? "#2a3a45" : "#d5c8b5",
        borderRadius: 2, overflow: "hidden",
        "&:focus-within": { borderColor: "primary.main" },
      }}>
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", border: "none", outline: "none",
            background: "transparent",
            color: mode === "dark" ? "#e0eef0" : "#2a2218",
            fontSize: 15, fontFamily: "inherit", boxSizing: "border-box",
            cursor: "pointer",
          }}
        />
      </Box>
    </Box>
  );
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

function LoginScreen({ users, onLogin, mode, setMode }) {
  const [sel, setSel] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const theme = buildTheme(mode);

  function handleDigit(d) {
    if (pin.length >= 4) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 4) {
      if (sel.pin === np) { onLogin(sel); }
      else {
        setError(true);
        setTimeout(() => { setPin(""); setError(false); }, 700);
      }
    }
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

        {!sel ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, letterSpacing: "0.1em" }}>
              SELECT YOUR NAME
            </Typography>
            <Grid container spacing={1.5} sx={{ maxWidth: 380, mb: 3 }}>
              {users.map(u => (
                <Grid item xs={4} key={u.id}>
                  <Card variant="outlined" sx={{ cursor: "pointer", transition: "all 0.15s", "&:hover": { borderColor: ROLE_META[u.role].color } }}>
                    <CardActionArea onClick={() => setSel(u)} sx={{ p: 1.5, textAlign: "center" }}>
                      <Avatar sx={{ bgcolor: ROLE_META[u.role].color + "30", color: ROLE_META[u.role].color, width: 36, height: 36, fontSize: 13, fontWeight: 700, mx: "auto", mb: 0.5 }}>
                        {initials(u.name)}
                      </Avatar>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block", lineHeight: 1.3 }}>
                        {u.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {ROLE_META[u.role].label}
                      </Typography>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Typography variant="caption" color="text.disabled">
              Chris (Manager) PIN: 1111 · Others: 2222–0000
            </Typography>
          </>
        ) : (
          <Box sx={{ textAlign: "center" }}>
            <Avatar sx={{ bgcolor: ROLE_META[sel.role].color + "25", color: ROLE_META[sel.role].color, width: 56, height: 56, fontSize: 20, fontWeight: 700, mx: "auto", mb: 1.5 }}>
              {initials(sel.name)}
            </Avatar>
            <Typography variant="h6" sx={{ mb: 0.5 }}>{sel.name}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: "block" }}>
              Enter your PIN
            </Typography>

            <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mb: 2 }}>
              {[0,1,2,3].map(i => (
                <Box key={i} sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: i < pin.length ? "primary.main" : "transparent", border: "2px solid", borderColor: error ? "error.main" : "primary.main", transition: "all 0.15s" }} />
              ))}
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2, py: 0 }}>Wrong PIN</Alert>}

            <Grid container spacing={1} sx={{ width: 220, mx: "auto", mb: 2 }}>
              {[1,2,3,4,5,6,7,8,9,null,0,"⌫"].map((n, i) => (
                <Grid item xs={4} key={i}>
                  {n !== null ? (
                    <Button fullWidth variant="outlined" size="large"
                      onClick={() => n === "⌫" ? setPin(p => p.slice(0,-1)) : handleDigit(String(n))}
                      sx={{ fontSize: n === "⌫" ? 18 : 20, fontWeight: 400, py: 1.5, borderColor: "divider" }}>
                      {n}
                    </Button>
                  ) : <Box />}
                </Grid>
              ))}
            </Grid>

            <Button size="small" color="inherit" onClick={() => { setSel(null); setPin(""); }}>
              ← Back
            </Button>
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

// ─── SHIFT MODAL ─────────────────────────────────────────────────────────────

function ShiftModal({ open, user, existing, onSave, onClose, mode }) {
  const [start, setStart] = useState(existing?.start || "");
  const [end, setEnd]     = useState(existing?.end   || "");
  const [note, setNote]   = useState(existing?.note  || "");
  const [preset, setPreset] = useState("");

  const hours = parseHours(start, end);
  const color = ROLE_META[user?.role]?.color || "#F5A623";

  function applyPreset(p) {
    setPreset(p.label);
    setStart(p.start);
    setEnd(p.end);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar sx={{ bgcolor: color + "25", color, width: 36, height: 36, fontSize: 13, fontWeight: 700 }}>
            {user ? initials(user.name) : ""}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{ROLE_META[user?.role]?.label}</Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, letterSpacing: "0.08em" }}>
          QUICK PRESETS
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3 }}>
          {SHIFT_PRESETS.map(p => (
            <Chip key={p.label} label={p.label} size="small" clickable
              variant={preset === p.label ? "filled" : "outlined"}
              color={preset === p.label ? "primary" : "default"}
              onClick={() => applyPreset(p)} />
          ))}
        </Stack>

        {/* Time inputs — native, no label overlap */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TimeInput label="Start" value={start} onChange={v => { setStart(v); setPreset(""); }} mode={mode} />
          <TimeInput label="End"   value={end}   onChange={v => { setEnd(v);   setPreset(""); }} mode={mode} />
        </Stack>

        {hours > 0 && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 2 }}>
            <AccessTime sx={{ fontSize: 16, color: "secondary.main" }} />
            <Typography variant="body2" color="secondary.main" fontWeight={600}>
              {hours} hours
            </Typography>
          </Stack>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, letterSpacing: "0.06em", fontWeight: 600, fontSize: 11 }}>
          NOTE (OPTIONAL)
        </Typography>
        <Box sx={{ border: "1px solid", borderColor: mode === "dark" ? "#2a3a45" : "#d5c8b5", borderRadius: 2, overflow: "hidden" }}>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. training shift"
            style={{
              width: "100%", padding: "10px 12px", border: "none", outline: "none",
              background: "transparent", color: mode === "dark" ? "#e0eef0" : "#2a2218",
              fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
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
  const [data, setData] = useState(loadData);
  const [user, setUser] = useState(null);
  const [monday, setMonday] = useState(getMondayOfWeek(new Date().toISOString().split("T")[0]));
  const [tab, setTab] = useState(0);
  const [modal, setModal] = useState(null);
  const [mode, setMode] = useState("dark");

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);
  const schedule = data.schedules[monday] || {};
  const isAdmin = user?.role === "admin";
  const allWeeks = Object.keys(data.schedules).sort().reverse();

  function persist(nd) { setData(nd); saveData(nd); }

  function saveShift(userId, dayIndex, shift) {
    const ns = { ...data.schedules };
    if (!ns[monday]) ns[monday] = {};
    const ws = { ...ns[monday] };
    const us = { ...(ws[userId] || {}) };
    if (shift === null) delete us[dayIndex]; else us[dayIndex] = shift;
    ws[userId] = us; ns[monday] = ws;
    persist({ ...data, schedules: ns });
    setModal(null);
  }

  function weekHours(uid) {
    return Object.values(schedule[uid] || {}).reduce((s, sh) => s + parseHours(sh.start, sh.end), 0);
  }

  function shiftWeek(dir) {
    const d = new Date(monday); d.setDate(d.getDate() + dir * 7);
    setMonday(d.toISOString().split("T")[0]);
  }

  if (!user) return <LoginScreen users={data.users} onLogin={setUser} mode={mode} setMode={setMode} />;

  const visibleUsers = isAdmin ? data.users : data.users.filter(u => u.id === user.id);
  const modalUser = modal ? data.users.find(u => u.id === modal.userId) : null;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" color="default">
        <Toolbar sx={{ gap: 1 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" color="primary" sx={{ letterSpacing: "0.2em", lineHeight: 1, display: "block", fontSize: 10 }}>
              Please! Beverage Co.
            </Typography>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>Schedule</Typography>
          </Box>

          <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
            <IconButton onClick={() => setMode(m => m === "dark" ? "light" : "dark")} size="small">
              {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Chip
            avatar={
              <Avatar sx={{ bgcolor: ROLE_META[user.role].color + "30 !important", color: ROLE_META[user.role].color + " !important", fontSize: "11px !important", fontWeight: 700 }}>
                {initials(user.name)}
              </Avatar>
            }
            label={`${user.name} · ${ROLE_META[user.role].label}`}
            variant="outlined" size="small"
            sx={{ borderColor: ROLE_META[user.role].color + "60", color: ROLE_META[user.role].color }}
          />

          <Tooltip title="Sign out">
            <IconButton size="small" onClick={() => setUser(null)}><Logout fontSize="small" /></IconButton>
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
              const n = Object.keys(data.schedules[wk] || {}).length;
              const active = wk === monday;
              return (
                <Card key={wk} variant="outlined" sx={{ borderColor: active ? "primary.main" : "divider", bgcolor: active ? "primary.main" + "10" : "background.paper" }}>
                  <CardActionArea onClick={() => { setMonday(wk); setTab(0); }} sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body1" fontWeight={600}>{fmtDate(dates[0])} – {fmtDate(dates[6])}</Typography>
                      <Typography variant="caption" color="text.secondary">{n} staff scheduled</Typography>
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

          <Box sx={{ overflowX: "auto", px: 2, pb: 6 }}>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 110, position: "sticky", left: 0, zIndex: 3, bgcolor: "inherit" }}>NAME</TableCell>
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
                  {visibleUsers.map((u) => {
                    const us = schedule[u.id] || {};
                    const hrs = weekHours(u.id);
                    const color = ROLE_META[u.role]?.color || "#F5A623";
                    return (
                      <TableRow key={u.id} hover sx={{ "&:last-child td": { border: 0 } }}>
                        <TableCell sx={{ position: "sticky", left: 0, bgcolor: "background.paper", zIndex: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: color + "25", color }}>
                              {initials(u.name)}
                            </Avatar>
                            <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                          </Stack>
                        </TableCell>
                        {DAYS.map((_, di) => {
                          const sh = us[di];
                          return (
                            <TableCell key={di} align="center"
                              onClick={() => isAdmin && setModal({ userId: u.id, dayIndex: di, existing: sh || null })}
                              sx={{ cursor: isAdmin ? "pointer" : "default", "&:hover": isAdmin ? { bgcolor: "action.hover" } : {} }}>
                              {sh ? (
                                <Chip label={`${fmtTime(sh.start)}–${fmtTime(sh.end)}`} size="small"
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
              <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 2 }}>
                Tap any cell to assign or edit a shift
              </Typography>
            )}
          </Box>
        </>
      )}

      {modal && (
        <ShiftModal
          open={!!modal}
          user={modalUser}
          existing={modal.existing}
          onSave={(shift) => saveShift(modal.userId, modal.dayIndex, shift)}
          onClose={() => setModal(null)}
          mode={mode}
        />
      )}
    </ThemeProvider>
  );
}