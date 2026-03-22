/**
 * Chatroom list cards on sdc.com/react use static assets under `/react/assets/`, not `image` from the API (`1.gif`).
 * Map official room `id` to the same PNG/SVG files the main app loads.
 */
const SDC_REACT_ASSETS = 'https://www.sdc.com/react/assets';

/** Member-created rooms use a shared illustration (matches main site). */
export const CHATROOM_PERSONAL_IMAGE_URL = `${SDC_REACT_ASSETS}/chatroom.fc831eee.svg`;

/**
 * Official room IDs from `chatroom_list` → hashed filenames on the React CDN.
 * @see same layout as MUI chatroom grid on www.sdc.com
 */
const OFFICIAL_CHATROOM_ID_TO_FILE: Record<number, string> = {
  100: 'rect818.640fba79.png',
  101: 'rect818.640fba79.png',
  102: 'rect818.640fba79.png',
  103: 'rect822.7bd857e8.png',
  104: 'rect822.7bd857e8.png',
  105: 'rect826.8e390a4d.png',
  106: 'rect820.03d19018.png',
  107: 'rect819.193cb1bd.png',
  108: 'rect824.a4c787c3.png',
  109: 'rect823.0375d3ab.png',
};

export function getOfficialChatroomCardImageUrl(roomId: number): string {
  const file = OFFICIAL_CHATROOM_ID_TO_FILE[roomId] ?? 'rect818.640fba79.png';
  return `${SDC_REACT_ASSETS}/${file}`;
}
