import type { FormEvent } from "react";

export function HeaderSearchBar(props: {
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  value: string;
}): JSX.Element {
  const { onChange, onSubmit, placeholder, value } = props;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  return (
    <form className="header-searchbar" role="search" onSubmit={submit}>
      <span className="header-searchbar-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm9.2 11.8 1.4 1.4-3.1 3.1-1.4-1.4 3.1-3.1Z" />
        </svg>
      </span>
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <span className="header-searchbar-shortcut" aria-hidden="true">
        /
      </span>
    </form>
  );
}
