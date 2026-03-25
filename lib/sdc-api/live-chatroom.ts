/**
 * SDC live voyeur list, chatroom list, and webinar list APIs.
 */
import type {
  ChatroomListFixedRoom,
  ChatroomListResponse,
  OnlineV2Member,
  VoyeurCamListGroup,
  VoyeurCamListV2Response,
  WebinarListResponse,
} from '@/lib/sdc-api-types';
import { resolvePeopleApiMuid } from '@/lib/sdc-api/session-credentials';

const JSON_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://www.sdc.com',
  referer: 'https://www.sdc.com/',
} as const;

export function voyeurGroupToOnlineMember(g: VoyeurCamListGroup): OnlineV2Member {
  const app = typeof g.is_app_user === 'number' ? g.is_app_user : g.is_app_user ? 1 : 0;
  const web = typeof g.is_web_user === 'number' ? g.is_web_user : g.is_web_user ? 1 : 0;
  return {
    db_id: g.db_id,
    account_id: g.account_id,
    gender1: g.gender1,
    gender2: g.gender2,
    location_how_far: g.location_how_far,
    birthday_for: g.birthday_for,
    psg: g.psg,
    speed: g.speed,
    photo_count: g.photo_count,
    age: g.age,
    this_birthday: g.this_birthday,
    primary_photo: g.primary_photo,
    profile_type: g.profile_type,
    online: g.online,
    business_type: g.business_type ?? '',
    valid_count: g.valid_count,
    video_count: g.video_count,
    likes_count: g.likes_count,
    travel_counter: g.travel_counter,
    service_counter: g.service_counter,
    reviews_counter: g.reviews_counter,
    follows_counter: 0,
    club_id: g.club_id,
    sdcdiscount: g.sdcdiscount ?? '',
    summary_int: g.summary_int,
    location: g.location,
    lifetime_status: g.lifetime_status,
    is_app_user: app,
    is_web_user: web,
    biz_type_subcategories: g.biz_type_subcategories as OnlineV2Member['biz_type_subcategories'],
    timed: g.timed,
    count_live: g.count_live,
  };
}

export async function getVoyeurCamListV2(
  page: number = 0,
  muid?: string | null
): Promise<VoyeurCamListV2Response> {
  const currentMuid = await resolvePeopleApiMuid(muid ?? null);
  const url = new URL('https://api.sdc.com/v1/voyeur_cam_list_v2');
  url.searchParams.set('muid', currentMuid);
  url.searchParams.set('page', String(page));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...JSON_HEADERS },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`voyeur_cam_list_v2 failed: ${response.status} — ${errorText}`);
  }

  return (await response.json()) as VoyeurCamListV2Response;
}

const CHATROOM_INFO_SKIP = new Set([
  'code',
  'personal_list',
  'personal_chatroom_created',
  'events_chat',
  'access',
  'allow_post',
  'can_create_rooms',
  'chatroom_counter',
  'livestreams_counter',
]);

export function extractFixedChatrooms(info: ChatroomListResponse['info']): ChatroomListFixedRoom[] {
  const out: ChatroomListFixedRoom[] = [];
  const raw = info as unknown as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (CHATROOM_INFO_SKIP.has(key)) continue;
    const val = raw[key];
    if (!val || typeof val !== 'object') continue;
    const o = val as Record<string, unknown>;
    if (
      typeof o.id === 'number' &&
      typeof o.chat_name === 'string' &&
      typeof o.url === 'string' &&
      typeof o.total === 'number'
    ) {
      out.push({
        id: o.id,
        chat_name: o.chat_name,
        image: typeof o.image === 'string' ? o.image : '',
        total: o.total,
        url: o.url,
      });
    }
  }
  return out.sort((a, b) => a.chat_name.localeCompare(b.chat_name, undefined, { sensitivity: 'base' }));
}

export async function getChatroomList(
  page: number = 0,
  muid?: string | null
): Promise<ChatroomListResponse> {
  const currentMuid = await resolvePeopleApiMuid(muid ?? null);
  const url = new URL('https://api.sdc.com/v1/chatroom_list');
  url.searchParams.set('muid', currentMuid);
  url.searchParams.set('page', String(page));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...JSON_HEADERS },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`chatroom_list failed: ${response.status} — ${errorText}`);
  }

  return (await response.json()) as ChatroomListResponse;
}

export async function getWebinarList(
  options: {
    page_p?: number;
    page_u?: number;
    page_size?: number;
    muid?: string | null;
  } = {}
): Promise<WebinarListResponse> {
  const currentMuid = await resolvePeopleApiMuid(options.muid ?? null);
  const url = new URL('https://api.sdc.com/v1/webinar_list');
  url.searchParams.set('muid', currentMuid);
  url.searchParams.set('page_p', String(options.page_p ?? 0));
  url.searchParams.set('page_u', String(options.page_u ?? 0));
  url.searchParams.set('page_size', String(options.page_size ?? 6));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { ...JSON_HEADERS },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`webinar_list failed: ${response.status} — ${errorText}`);
  }

  return (await response.json()) as WebinarListResponse;
}

export function webinarPartyUrl(webinarId: number): string {
  return `https://www.sdc.com/react/#/party?idParty=${webinarId}&partyType=1`;
}

/**
 * Live publisher page on chat.sdc.com — `db_id` is the member’s own DB_ID; `t1` is a cache-buster.
 */
export function buildOwnLiveStreamChatroomUrl(dbId: string): string {
  const t1 = Date.now();
  const u = new URL('https://chat.sdc.com/live/v1/chatroom.php');
  u.searchParams.set('db_id', dbId);
  u.searchParams.set('t1', String(t1));
  return u.toString();
}
