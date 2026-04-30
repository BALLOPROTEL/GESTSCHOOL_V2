export type HeaderGlyphName =
  | "layout"
  | "apps"
  | "calendar"
  | "email"
  | "files"
  | "support"
  | "rocket"
  | "warning"
  | "check"
  | "theme"
  | "messages"
  | "notifications"
  | "profile"
  | "settings"
  | "activity"
  | "billing"
  | "logout";

export function HeaderGlyph(props: { icon: HeaderGlyphName }): JSX.Element {
  const { icon } = props;

  switch (icon) {
    case "layout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5.5 5.5h5.5v5.5H5.5zm7.5 0h5.5v13H13zm-7.5 7.5h5.5v5.5H5.5z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "apps":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3zM6 10.5h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3zM6 15h3v3H6zm4.5 0h3v3h-3zm4.5 0h3v3h-3z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
          />
        </svg>
      );
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7.5 4.5v2.2m9-2.2v2.2M5.5 8.2h13M7 6h10A1.5 1.5 0 0 1 18.5 7.5v9A1.5 1.5 0 0 1 17 18H7A1.5 1.5 0 0 1 5.5 16.5v-9A1.5 1.5 0 0 1 7 6Zm1.5 4h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "email":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5.5 7.5A1.5 1.5 0 0 1 7 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 17 18H7a1.5 1.5 0 0 1-1.5-1.5Zm1.2.6 5.3 4.2 5.3-4.2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "files":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 6h3l1.4 1.6H17A1.5 1.5 0 0 1 18.5 9v7.5A1.5 1.5 0 0 1 17 18H7A1.5 1.5 0 0 1 5.5 16.5v-9A1.5 1.5 0 0 1 7 6Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "support":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.4 9.4a3.6 3.6 0 1 1 7.2 0c0 1.4-.8 2.1-1.8 2.8-.8.5-1.4 1-1.4 1.8v.4M12 17.9v.1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "rocket":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.8 5.2c1.6.1 3 .8 4 1.8-1 4.2-3.7 7.3-7.6 8.8l-2.5-2.5c1.5-3.9 4.6-6.6 8.8-7.6ZM9.2 14.8l-2 2c-.6.6-1.5 1-2.4 1H4v-.8c0-.9.4-1.8 1-2.4l2-2M13.6 10.4l0 .1M8.4 18.5l-2.9 1 .9-2.9"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m12 5.3 6.7 11.4a1 1 0 0 1-.9 1.5H6.2a1 1 0 0 1-.9-1.5L12 5.3Zm0 4.2v4.2m0 2.6v.1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m8 12.3 2.8 2.8L16.5 9.4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "theme":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.5v2.2m0 12.6v2.2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M3.5 12h2.2m12.6 0h2.2M4.9 19.1l1.5-1.5m11.2-11.2 1.5-1.5M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "messages":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 6.5h10A2.5 2.5 0 0 1 19.5 9v5A2.5 2.5 0 0 1 17 16.5h-4.4l-3.3 2.6V16.5H7A2.5 2.5 0 0 1 4.5 14V9A2.5 2.5 0 0 1 7 6.5Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "notifications":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.5a4 4 0 0 1 4 4V11c0 1 .3 2 .9 2.8l.8 1a1 1 0 0 1-.8 1.7H7.1a1 1 0 0 1-.8-1.7l.8-1A4.9 4.9 0 0 0 8 11V8.5a4 4 0 0 1 4-4Zm-1.8 13h3.6a1.8 1.8 0 0 1-3.6 0Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "profile":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 6.2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Zm0 9.1c3.4 0 6 1.7 6 3.8v.4H6v-.4c0-2.1 2.6-3.8 6-3.8Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 8.4h4m4 0h7M8.5 8.4a2 2 0 1 0 0 .1m7 7.1h4m-15 0h7m4 0a2 2 0 1 0 0 .1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4.5 12h4l2.2-4 2.5 8 2.1-4H19.5"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "billing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5v9A1.5 1.5 0 0 1 17.5 18h-11A1.5 1.5 0 0 1 5 16.5Zm0 2.2h14"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "logout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10 7.5V6A1.5 1.5 0 0 1 11.5 4.5h6A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 10 18v-1.5M14 12H5.5m0 0 2.7-2.7M5.5 12l2.7 2.7"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}
