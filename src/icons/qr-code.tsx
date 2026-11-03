import { IconProps } from "./index";

export function QrCodeIcon(props: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2.5"
        y="2.5"
        width="6"
        height="6"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="11.5"
        y="2.5"
        width="6"
        height="6"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="2.5"
        y="11.5"
        width="6"
        height="6"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="4.75" y="4.75" width="1.5" height="1.5" fill="currentColor" />
      <rect x="13.75" y="4.75" width="1.5" height="1.5" fill="currentColor" />
      <rect x="4.75" y="13.75" width="1.5" height="1.5" fill="currentColor" />
      <path
        d="M11.5 11.5H14V14H11.5V11.5ZM14 14H17.5V17.5H14V14ZM15.5 11.5H17.5V13.5M11.5 15.5V17.5H13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
