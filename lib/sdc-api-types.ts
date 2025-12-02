/**
 * Type definitions for SDC API responses
 */

export interface ProfileV2Info {
    code: number;
    profile_user: ProfileUser;
    extra1?: string;
    extra2?: string;
    ownProf?: number;
    settings?: string;
    report_trial_accounts?: number;
}

export interface ProfileV2Response {
    info: ProfileV2Info;
}

export interface ProfileUser {
    db_id: number;
    account_id: string;
    friends_common?: number;
    linked_account?: any[];
    party_review?: number;
    parties_reviews?: any[];
    note?: string;
    blocked?: number;
    slogan?: string;
    g1_age?: number;
    g2_age?: number;
    ages?: string;
    eyes?: string;
    hair_color?: string;
    hair_length?: string;
    body_hair?: string;
    height?: string;
    weight?: string;
    body_type?: string;
    race?: string;
    smoke?: string;
    piercings?: string;
    tattoos?: string;
    languages?: string;
    languages_join?: string;
    circumcised?: string;
    look_imp?: string;
    inte_imp?: string;
    sexuality?: string;
    relationship?: string;
    experience?: string;
    interests?: string;
    interests1?: string;
    interests2?: string;
    interests_st?: string;
    gender1?: number;
    gender2?: number;
    g1_nick?: string;
    g2_nick?: string;
    g1_lang?: string;
    g2_lang?: string;
    messenger_count?: number;
    my_validations?: Validation[];
    birthday_for?: string;
    what_like?: string;
    location?: string;
    location2?: string;
    location_how_far?: number;
    location_how_far2?: string;
    profile_description?: string;
    hope_to_find?: string;
    validations?: number;
    friend_status?: number;
    membership?: string;
    lifetime_status?: boolean;
    speeddating_list?: any[];
    speeddating_active?: number;
    speeddating_details?: SpeedDatingDetails;
    photo_list?: string;
    photo_file_list?: string[];
    like?: number;
    profile_type?: number;
    business_data?: BusinessData;
    party_plans_up?: any[];
    party_plans_up2?: any[];
    party_plans_past?: any[];
    memberservices_data?: any[];
    video_counter?: number;
    photo_counter?: number;
    vanilla_photo_counter?: number;
    vanilla_photo_album?: string[];
    no_vanilla_photo_counter?: number;
    no_vanilla_photo_album?: string[];
    blur_primary_pic?: number;
    profile_photo_type?: number;
    friend_counter?: number;
    validation_counter?: number;
    friends?: Friend[];
    following?: any[];
    follower_counter?: number;
    online?: number;
    likes?: number;
    travel_plans?: TravelPlan[];
    validation_status?: number;
    validation_id?: number;
    download?: boolean;
    otherlang?: string;
    isstaff?: number;
    video_list?: any[];
    video_next_pag?: number;
    photoalbum_list?: PhotoAlbum[];
    remember_status?: number;
    communities?: Community[];
    isAmbassador?: number;
    isRepresentative?: number;
    isBizPreferred?: number;
    cnt_invite?: number;
    community_list?: any[];
    party_list?: any[];
    private_party_list?: any[];
    show_all?: boolean;
    group_id?: number;
    is_app_user?: number;
    is_web_user?: number;
}

export interface Validation {
    validation_id: number;
    db_id: number;
    business_type?: string;
    account_id: string;
    gender1: number;
    gender2: number;
    subject: string;
    date: string;
    profile_type: number;
    online: number;
    speed: number;
    photo_count: number;
    video_count: number;
    valid_count: number;
    likes_count: number;
    travel_count: number;
    service_count: number;
    summary_int: string;
    age: string;
    birthday_for: string;
    primary_photo: string;
    blur_primary_pic: number;
    location: string;
    location_how_far: number;
    hide_sender: number;
    lifetime_status: boolean;
    is_app_user: number;
    is_web_user: number;
    biz_type_subcategories?: any[];
}

export interface SpeedDatingDetails {
    date_list?: string;
    dating_date?: string;
    dating_hours?: string;
    how_far?: number;
    personal_text?: string | null;
    location?: string;
    interests?: any;
    type?: any;
}

export interface BusinessData {
    none?: number;
    [key: string]: any;
}

export interface Friend {
    db_id: string;
    account_id: string;
    gender1: number;
    gender2: number;
    location_how_far: string;
    speed: number;
    age: string;
    birthday_for: string;
    primary_photo: string;
    blur_primary_pic: number;
    video_count: number;
    photo_count: number;
    location: string;
    profile_type: number;
    business_type: string;
    online: number;
    valid_count: number;
    likes_count: number;
    travel_counter: number;
    service_counter: number;
    follows_counter: number;
    reviews_counter: number;
    travel_count: number;
    service_count: number;
    club_id: string | null;
    sdcdiscount: string;
    summary_int: string;
    lifetime_status: boolean;
    is_app_user: number;
    is_web_user: number;
    biz_type_subcategories?: any[];
}

export interface TravelPlan {
    travel_id: number;
    date_from: string;
    date_until: string;
    description: string;
    distance: number;
    lon: string;
    lat: string;
    location: string;
    text_description: string;
}

export interface PhotoAlbum {
    id: string;
    name: string;
    password: number;
    photo_album: string;
    pwd: string;
    counter_images: string;
    counter_videos: string;
}

export interface Community {
    id: number;
    belongs: number;
    club_name: string;
    account_id: string;
    picture: string;
    gender1: number;
    gender2: number;
    profile_type: number;
    location: string;
    total_members: number;
    long_description: string;
    short_description: string;
    how_far: number;
    category_name: string;
    account_since: string;
    group_type: number;
    count_blogs: number;
    status: number;
}

/**
 * Messenger API Types
 */
export interface MessengerChatItem {
    db_id: number;
    folder_id?: number;
    account_id: string;
    gender1: number;
    gender2: number;
    profile_type: number;
    unread_counter: number;
    last_message: string;
    message_status: number;
    date: string;
    date_time: string;
    start_chat: number;
    primary_photo: string;
    muted: number | null;
    pin_chat: number;
    time_elapsed: string;
    isFriend: boolean;
    online: number;
    group_type: number;
    group_id: number;
    blocked_profile: number;
    extra1: string;
    // Broadcast message fields (when broadcast: true or type: 100)
    type?: number;
    broadcast?: boolean;
    id_broadcast?: number;
    extra_data?: any;
    subject?: string;
    body?: string;
}

export interface MessengerLatestInfo {
    code: string;
    chat_list: MessengerChatItem[];
    url_more?: string;
}

export interface MessengerLatestResponse {
    info: MessengerLatestInfo;
}

export interface MessengerIOV2Info {
    code: number;
    db_id: number;
    messenger_conn_id: number;
    messenger_id1: string;
    messenger_version: number;
    messenger_hh: string;
}

export interface MessengerIOV2Response {
    info: MessengerIOV2Info;
}

/**
 * Counters API Types
 */
export interface CountersInfo {
    code: number;
    online: number;
    count_live_streams: number;
    email: number;
    messenger: number;
    viewed: number;
    chatroom: number;
    feed_counter: number;
    admin_feed_counter: number;
    notification_timed: string;
    last_build_date: string;
    stream_status: number;
    speeddating_counter: number;
    video_counter: number;
    party_counter: number;
    business_counter: number;
    travelplanner_counter: number;
    lifetime_offer: number;
    saved_search: number;
    sdc_live_url: string | null;
    live_button: number;
    count_live: number;
    isActiveBot: number;
}

export interface CountersResponse {
    info: CountersInfo;
}

