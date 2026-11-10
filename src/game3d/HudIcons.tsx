// HUD pictograms: the game has no words, the HUD included.
// All drawn on a 24×24 grid in the current text colour.

function Icon({ children, size = 22 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Drag to turn the box: a cube with a turning arrow under it.
export function TurnBoxIcon() {
  return (
    <Icon>
      <path d="M12 3 L18 6 L12 9 L6 6 Z M6 6 V12 L12 15 V9 M18 6 V12 L12 15" />
      <path d="M4 17 Q12 23 20 17" />
      <path d="M17.5 15.6 L20 17 L18.6 19.6" />
    </Icon>
  );
}

// Tap a face to look closer: a face with a tap ripple on it.
export function TapFaceIcon() {
  return (
    <Icon>
      <rect x="3" y="3" width="13" height="13" rx="1.5" />
      <circle cx="14" cy="14" r="1.6" fill="currentColor" />
      <path d="M18.5 14 A4.5 4.5 0 0 1 14 18.5" />
      <path d="M21.5 14 A7.5 7.5 0 0 1 14 21.5" />
    </Icon>
  );
}

// Play in landscape: a phone turning on its side.
export function LandscapeIcon() {
  return (
    <Icon>
      <rect x="3" y="9" width="15" height="9" rx="1.5" />
      <path d="M8 5 Q14 2 19 6 M19 6 L19.5 3 M19 6 L16 6.4" />
    </Icon>
  );
}

// Drag the disk round: a circle with an arrow running along it.
export function SpinDiskIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 3 A9 9 0 1 1 3.6 9" />
      <path d="M3.6 9 L3 5.6 M3.6 9 L6.8 7.8" />
    </Icon>
  );
}

// Back to the whole box: an arrow curling back.
export function BackIcon() {
  return (
    <Icon size={24}>
      <path d="M9 14 L4 9 L9 4" />
      <path d="M4 9 H14.5 a5 5 0 0 1 0 10 H10" />
    </Icon>
  );
}

// The inventory: an open tray.
export function TrayIcon() {
  return (
    <Icon size={18}>
      <path d="M3 13 L6 5 H18 L21 13 V19 H3 Z M3 13 H8 L9.5 15.5 H14.5 L16 13 H21" />
    </Icon>
  );
}
