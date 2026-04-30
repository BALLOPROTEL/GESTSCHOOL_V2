import type { ModuleIconName } from "../types/app";
import type { HeaderNavigationAction } from "../../app/navigation/header-navigation";
import { ModuleIcon } from "./module-icon";

type AppSidebarGroup = {
  id: string;
  title: string;
  items: HeaderNavigationAction[];
};

type AppSidebarProps = {
  brandName: string;
  currentRoleLabel: string;
  groups: AppSidebarGroup[];
};

const SIDEBAR_ICON_BY_ACTION: Record<string, ModuleIconName> = {
  dashboard: "chart",
  iam: "shield",
  teachers: "teacher",
  rooms: "room",
  students: "users",
  messages: "messages",
  reference: "settings",
  enrollments: "clipboard",
  finance: "wallet",
  reports: "chart",
  mosquee: "calendar",
  grades: "book",
  schoolLifeOverview: "chart",
  schoolLifeAttendance: "bell",
  schoolLifeTimetable: "calendar",
  schoolLifeNotifications: "bell",
  teacherPortal: "teacher",
  parentPortal: "users"
};

export function AppSidebar(props: AppSidebarProps): JSX.Element {
  const { brandName, currentRoleLabel, groups } = props;

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.disabled)
    }))
    .filter((group) => group.items.length > 0);

  const resolveIcon = (actionId: string): ModuleIconName =>
    SIDEBAR_ICON_BY_ACTION[actionId] || "settings";

  return (
    <aside className="panel app-sidebar app-sidebar-v2" aria-label="Navigation laterale">
      <div className="sidebar-brand-row">
        <span className="sidebar-brand-mark" aria-hidden="true">
          GS
        </span>
        <div className="sidebar-head">
          <p className="eyebrow">GestSchool Admin</p>
          <strong>{brandName}</strong>
          <p className="subtle">{currentRoleLabel}</p>
        </div>
      </div>

      <div className="sidebar-scroll-region">
        {visibleGroups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <p className="sidebar-title">{group.title}</p>
            <div className="sidebar-nav-list">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sidebar-link ${item.active ? "is-active" : ""}`.trim()}
                  onClick={item.onSelect}
                >
                  <span className="sidebar-link-visual">
                    <span className="sidebar-link-icon" aria-hidden="true">
                      <ModuleIcon name={resolveIcon(item.id)} />
                    </span>
                    <span className="sidebar-link-copy">
                      <span>{item.label}</span>
                      {item.helperText ? <small>{item.helperText}</small> : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
