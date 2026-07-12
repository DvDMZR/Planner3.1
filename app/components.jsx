// ─── ICONS + SHARED UI COMPONENTS ──────────────────────────────────────────

// --- INLINE ICONS ---
const IconUsers = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
const IconBriefcase = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
const IconCalendar = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
const IconBarChart = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>;
const IconSettings = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const IconPlus = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const IconX = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconDownload = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const IconUpload = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>;
const IconChevronDown = ({ size=20, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"></polyline></svg>;
const IconChevronRight = ({ size=20, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="9 18 15 12 9 6"></polyline></svg>;
const IconChevronLeft = ({ size=20, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="15 18 9 12 15 6"></polyline></svg>;
const IconArrowLeft = ({ size=20, className }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const IconFileText = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>;
const IconList = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>;
const IconCopy = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>;
const IconClock = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>;
const IconTable = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>;
const IconEdit = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>;
const IconMessageSquare = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconHistory = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.5"></path><circle cx="12" cy="12" r="1" fill="currentColor"/><polyline points="12 7 12 12 15 15"></polyline></svg>;
const IconPin = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>;
const IconRepeat = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>;
const IconUser = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconTag = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>;
const IconGanttChart = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 6h10"/><path d="M6 12h9"/><path d="M11 18h7"/></svg>;
const IconMoreHorizontal = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/></svg>;
const IconTrash = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IconLifebuoy = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>;
const IconLock = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IconLogIn = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>;
const IconLogOut = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconShield = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconUndo = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>;
const IconBookOpen = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
const IconSunset = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>;
const IconExternalLink = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>;
const IconSearch = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconLayoutGrid = ({ className, size=20 }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;

// --- SHARED UI COMPONENTS (module scope) ---
// Bind window-keydown so pressing Escape closes the current modal. Pass the
// same onClose the modal already uses for its X button. Several modals open
// at once nest naturally: every level installs its own listener, all of them
// fire on a single keystroke, the topmost one's onClose runs last (or its
// parent re-renders without it before this listener's setState commits –
// which is fine, idempotent).
const useEscapeToClose = (onClose) => {
    React.useEffect(() => {
        if (typeof onClose !== 'function') return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
};

// Defined outside App() so they keep a stable component identity across
// App re-renders; otherwise any internal useState inside a modal would
// reset whenever the parent re-renders (e.g. from remote sync polling).
const ModalHeader = ({ title, subtitle, onClose }) => (
    <div className="p-4 border-b border-slate-300 flex justify-between items-center bg-slate-50">
        <div>
            <h3 className="text-slate-900 text-lg font-medium">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><IconX size={20}/></button>
    </div>
);

const StatusBadge = ({ status, t }) => {
    const s = PROJECT_STATUSES.find(x => x.value === status) || PROJECT_STATUSES[0];
    const label = t ? t('status.' + s.value) : s.label;
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{label}</span>;
};

// --- TOAST CONTAINER ---
const ToastContainer = ({ toasts, onDismiss }) => (
    <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
            <div key={t.id} className={`pointer-events-auto min-w-[280px] max-w-md shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 border ${
                t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                t.type === 'error'   ? 'bg-rose-50 border-rose-200 text-rose-800' :
                t.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                       'bg-white border-slate-200 text-slate-800'
            }`}>
                <span className="text-sm flex-1">{t.message}</span>
                {t.action && (
                    <button onClick={() => { t.action.onClick(); onDismiss(t.id); }}
                        className="text-xs font-semibold underline hover:no-underline shrink-0">
                        {t.action.label}
                    </button>
                )}
                <button onClick={() => onDismiss(t.id)} className="text-current opacity-50 hover:opacity-100 shrink-0">
                    <IconX size={14}/>
                </button>
            </div>
        ))}
    </div>
);

// --- EMPTY STATE ---
const EmptyState = ({ icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        {icon && <div className="bg-slate-100 text-slate-400 rounded-full p-4 mb-4">{icon}</div>}
        <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
        {description && <p className="text-sm text-slate-500 max-w-sm mb-6">{description}</p>}
        {action && (
            <button onClick={action.onClick}
                className="bg-gea-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gea-700 transition-colors">
                {action.label}
            </button>
        )}
    </div>
);

// --- TOOLTIP (faster + stylable replacement for native title="") ---
const Tooltip = ({ text, children, side = 'top', delay = 250, wrap = false }) => {
    const [show, setShow] = React.useState(false);
    const timer = React.useRef(null);
    React.useEffect(() => () => clearTimeout(timer.current), []);
    if (!text) return children;
    const onEnter = () => { timer.current = setTimeout(() => setShow(true), delay); };
    const onLeave = () => { clearTimeout(timer.current); setShow(false); };
    return (
        <span className="relative inline-flex" onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave}>
            {children}
            {show && (
                <span className={`absolute z-50 px-2 py-1 rounded text-xs bg-slate-900 text-white shadow-lg pointer-events-none ${
                    wrap ? 'whitespace-pre-wrap max-w-xs' : 'whitespace-nowrap'
                } ${
                    side === 'top'    ? 'bottom-full mb-1 left-1/2 -translate-x-1/2' :
                    side === 'bottom' ? 'top-full mt-1 left-1/2 -translate-x-1/2' :
                    side === 'left'   ? 'right-full mr-1 top-1/2 -translate-y-1/2' :
                                        'left-full ml-1 top-1/2 -translate-y-1/2'
                }`}>{text}</span>
            )}
        </span>
    );
};

// --- WEEK CALENDAR PICKER ---
const WeekCalendarPicker = ({ value, onChange, minWeek }) => {
    const getMonthFromWeek = (weekId) => {
        const [yearStr, wStr] = weekId.split('-W');
        const year = parseInt(yearStr), week = parseInt(wStr);
        const jan4 = new Date(year, 0, 4);
        const dow = jan4.getDay() || 7;
        const monday = new Date(year, jan4.getMonth(), jan4.getDate() - dow + 1 + (week - 1) * 7);
        return { year: monday.getFullYear(), month: monday.getMonth() };
    };
    const initial = getMonthFromWeek(value);
    const [navYear, setNavYear] = React.useState(initial.year);
    const [navMonth, setNavMonth] = React.useState(initial.month);

    const weeksInView = React.useMemo(() => {
        const firstDay = new Date(navYear, navMonth, 1);
        const lastDay = new Date(navYear, navMonth + 1, 0);
        const dow = firstDay.getDay() || 7;
        let mon = new Date(navYear, navMonth, firstDay.getDate() - dow + 1);
        const weeks = [];
        while (mon <= lastDay) {
            const sun = new Date(mon.getTime() + 6 * 86400000);
            const weekId = getWeekString(mon);
            weeks.push({ weekId, mon: new Date(mon), sun: new Date(sun) });
            mon = new Date(mon.getTime() + 7 * 86400000);
        }
        return weeks;
    }, [navYear, navMonth]);

    const prevMonth = () => {
        if (navMonth === 0) { setNavMonth(11); setNavYear(y => y - 1); }
        else setNavMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (navMonth === 11) { setNavMonth(0); setNavYear(y => y + 1); }
        else setNavMonth(m => m + 1);
    };

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
                <button type="button" onClick={prevMonth} className="text-slate-500 hover:text-slate-800 p-0.5 rounded hover:bg-slate-200 transition-colors">
                    <IconChevronLeft size={14}/>
                </button>
                <span className="text-xs font-semibold text-slate-700">{MONTH_NAMES[navMonth]} {navYear}</span>
                <button type="button" onClick={nextMonth} className="text-slate-500 hover:text-slate-800 p-0.5 rounded hover:bg-slate-200 transition-colors">
                    <IconChevronRight size={14}/>
                </button>
            </div>
            <div className="p-1 space-y-0.5 max-h-48 overflow-y-auto">
                {weeksInView.map(({ weekId, mon, sun }) => {
                    const isSelected = weekId === value;
                    const isDisabled = minWeek && compareWeekIds(weekId, minWeek) <= 0;
                    const kw = parseInt(weekId.split('-W')[1]);
                    return (
                        <button key={weekId} type="button"
                            disabled={isDisabled}
                            onClick={() => !isDisabled && onChange(weekId)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors
                                ${isSelected ? 'bg-gea-600 text-white font-medium' :
                                  isDisabled ? 'text-slate-300 cursor-not-allowed' :
                                  'text-slate-700 hover:bg-gea-50 hover:text-gea-700 cursor-pointer'}`}>
                            <span className="font-semibold">KW {kw}</span>
                            <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>
                                {mon.getDate()}.{mon.getMonth()+1}. – {sun.getDate()}.{sun.getMonth()+1}.
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// Einheitliche Wochen-Auswahl für Formulare: Button zeigt "KW 40/26", Klick
// klappt den WeekCalendarPicker INLINE darunter aus (kein Popover – vermeidet
// Clipping in scrollenden Modal-Bodies). Ersetzt die browserabhängigen
// <input type="week">-Felder (Firefox/Safari rendern dort keinen KW-Picker).
const WeekPickerInput = ({ value, onChange, minWeek, placeholder = 'KW wählen …', invalid = false }) => {
    const [open, setOpen] = React.useState(false);
    // WeekCalendarPicker braucht einen gültigen Startwert für die Monats-Navigation
    const calendarValue = value || getWeekString(new Date());
    return (
        <div>
            <button type="button" onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className={`w-full p-2 border rounded-md text-sm text-left flex items-center justify-between gap-2 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-gea-400 ${
                    invalid ? 'border-rose-400 ring-1 ring-rose-300' : open ? 'border-gea-500' : 'border-slate-300 hover:border-gea-400'}`}>
                <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>
                    {value ? formatKW(value) : placeholder}
                </span>
                <IconCalendar size={15} className="text-slate-400 shrink-0"/>
            </button>
            {open && (
                <div className="mt-1">
                    <WeekCalendarPicker value={calendarValue} minWeek={minWeek}
                        onChange={(w) => { onChange(w); setOpen(false); }}/>
                </div>
            )}
        </div>
    );
};

// --- COMMAND PALETTE (Strg/⌘+K) ---
// Self-contained: owns its own query/keyboard-nav state. Navigation- und
// Aktions-Einträge kommen fertig aufbereitet (auth-gated) von App(); Projekte/
// Mitarbeiter werden hier aus den rohen Arrays gefiltert, damit App() nicht
// bei jedem Tastendruck neu rendern muss. Daten-Gruppen (Projekte/Mitarbeiter)
// erscheinen erst, sobald etwas getippt wurde – leere Eingabe zeigt nur
// Navigation + Aktionen (schnelles Springen ohne Rauschen).
const CommandPalette = ({ open, onClose, navItems, actionItems, projects, employees, onSelectProject, onSelectEmployee, t }) => {
    const inputRef = React.useRef(null);
    const [query, setQuery] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(0);
    useEscapeToClose(open ? onClose : null);

    React.useEffect(() => {
        if (!open) return;
        setQuery('');
        setActiveIndex(0);
        const timer = setTimeout(() => inputRef.current?.focus(), 10);
        return () => clearTimeout(timer);
    }, [open]);

    const q = query.trim().toLowerCase();
    React.useEffect(() => { setActiveIndex(0); }, [q]);

    const groups = React.useMemo(() => {
        const out = [];
        const matches = (label) => !q || label.toLowerCase().includes(q);

        const nav = (navItems || []).filter(it => matches(it.label));
        if (nav.length) out.push({ id: 'nav', label: t('cmdk.groupNav'), items: nav });

        const actions = (actionItems || []).filter(it => matches(it.label));
        if (actions.length) out.push({ id: 'actions', label: t('cmdk.groupActions'), items: actions });

        if (q) {
            const projItems = (projects || [])
                .filter(p => (p.name || '').toLowerCase().includes(q) || (p.projectNumber || '').toLowerCase().includes(q))
                .slice(0, 8)
                .map(p => ({
                    id: 'proj-' + p.id,
                    label: p.name,
                    sublabel: p.category || '',
                    icon: <span className={`w-2.5 h-2.5 rounded-full inline-block ${resolveProjectColor(p.color).dot}`}/>,
                    onSelect: () => onSelectProject(p),
                }));
            if (projItems.length) out.push({ id: 'projects', label: t('cmdk.groupProjects'), items: projItems });

            const empItems = (employees || [])
                .filter(e => e.active !== false && (e.name || '').toLowerCase().includes(q))
                .slice(0, 8)
                .map(e => ({
                    id: 'emp-' + e.id,
                    label: e.name,
                    sublabel: e.category || '',
                    icon: <IconUser size={15}/>,
                    onSelect: () => onSelectEmployee(e),
                }));
            if (empItems.length) out.push({ id: 'employees', label: t('cmdk.groupEmployees'), items: empItems });
        }
        return out;
    }, [q, navItems, actionItems, projects, employees, onSelectProject, onSelectEmployee, t]);

    const flatItems = React.useMemo(() => groups.flatMap(g => g.items), [groups]);

    const select = (item) => { if (!item) return; item.onSelect(); onClose(); };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatItems.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); select(flatItems[activeIndex]); }
    };

    if (!open) return null;
    let flatIdx = -1;
    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-start justify-center pt-24 p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                    <IconSearch size={16} className="text-slate-400 shrink-0"/>
                    <input ref={inputRef} type="text" value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={t('cmdk.placeholder')}
                        className="flex-1 text-sm outline-none placeholder:text-slate-400"/>
                    <kbd className="hidden sm:inline text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
                </div>
                <div className="max-h-96 overflow-y-auto py-2">
                    {flatItems.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-slate-400">{t('cmdk.noResults')}</p>
                    )}
                    {groups.map(group => (
                        <div key={group.id} className="mb-1">
                            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{group.label}</p>
                            {group.items.map(item => {
                                flatIdx++;
                                const isActive = flatIdx === activeIndex;
                                return (
                                    <button key={item.id} onClick={() => select(item)}
                                        onMouseEnter={() => setActiveIndex(flatIdx)}
                                        className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${isActive ? 'bg-gea-50 text-gea-900' : 'text-slate-700 hover:bg-slate-50'}`}>
                                        <span className="shrink-0 text-slate-400 flex items-center justify-center w-5">{item.icon}</span>
                                        <span className="flex-1 min-w-0 truncate font-medium">{item.label}</span>
                                        {item.sublabel && <span className="text-xs text-slate-400 shrink-0 max-w-[8rem] truncate">{item.sublabel}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Rechnungs-Status-Chip eines Projekts (getInvoiceState, utils.js).
// 'submitted' rendert bewusst nie – dieser Zustand hat mit costs_submitted
// bereits einen eigenen StatusBadge; 'open' nur auf Wunsch (Projektdetails),
// damit Listen nicht mit "Rechnung offen"-Chips fluten.
const InvoiceStateChip = ({ project, t, showOpen = false }) => {
    const state = getInvoiceState(project);
    if (state === 'submitted') return null;
    if (state === 'open' && !showOpen) return null;
    const cls = state === 'exported'
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : 'bg-slate-50 text-slate-500 border-slate-200';
    const title = project.invoiceExportedAt
        ? t('invoice.state.exportedAt', { date: new Date(project.invoiceExportedAt).toLocaleDateString() })
        : undefined;
    return (
        <span title={title}
            className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cls}`}>
            {t('invoice.state.' + state)}
        </span>
    );
};

// --- EXTRACTED MODAL COMPONENTS (module scope) ---
// Defined outside App() so their internal useState survives parent re-renders.
// If they were defined inside App() they'd get a new function identity every
// render — React would treat each render as a new component type, unmount the
// previous instance, and reset form state (e.g. while sync polling is active).

