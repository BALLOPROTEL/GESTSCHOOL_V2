import type { HeaderGlyphName } from "./header-glyph";

export type HeaderNavigationAction = {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  helperText?: string;
  onSelect: () => void;
};

export type HeaderPreferenceAction = {
  id: string;
  label: string;
  helperText?: string;
  iconSrc?: string;
  onSelect: () => void;
};

export type HeaderNavigationGroup = {
  id: string;
  label: string;
  helperText?: string;
  items: HeaderNavigationAction[];
};

export type HeaderUserAction = {
  id: string;
  icon: HeaderGlyphName;
  label: string;
  onSelect: () => void;
};

export type HeaderQuickAction = {
  id: string;
  icon: HeaderGlyphName;
  label: string;
  onSelect: () => void;
};

export type HeaderFeedItemTone = "cyan" | "amber" | "green" | "indigo";

export type HeaderFeedItem = {
  id: string;
  avatar?: string;
  description: string;
  icon?: HeaderGlyphName;
  onSelect: () => void;
  timeLabel: string;
  title: string;
  tone?: HeaderFeedItemTone;
};

export type HeaderNavigationUser = {
  avatar: string;
  contextLabel: string;
  roleLabel: string;
  secondaryLabel?: string;
  username: string;
  onLogout: () => void;
};
