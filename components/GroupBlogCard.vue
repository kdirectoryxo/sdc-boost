<script lang="ts" setup>
import { computed } from 'vue';
import type { NewsfeedItem } from '@/lib/sdc-api/newsfeed';

interface Props {
  item: NewsfeedItem;
  index?: number;
}

const props = defineProps<Props>();

const sender = computed(() => props.item.sender);
const receiver = computed(() => props.item.receiver);
const extraData = computed(() => props.item.extra_data);

const photoUrl = computed(() => {
  if (receiver.value?.primary_photo) {
    if (receiver.value.primary_photo.startsWith('http')) {
      return receiver.value.primary_photo;
    }
    if (receiver.value.primary_photo === '/thumbnail/') {
      return null;
    }
    return `https://pictures.sdc.com/photos/${receiver.value.primary_photo}`;
  }
  return null;
});

// Parse age string (format: "48|50" or similar)
const parseAge = () => {
  if (!receiver.value?.age) return { first: null, second: null };
  const parts = receiver.value.age.split('|');
  return {
    first: parts[0]?.trim() || null,
    second: parts[1]?.trim() || null,
  };
};

const ages = computed(() => parseAge());

// Check if second person age is real (not a placeholder)
const isGender2Real = computed(() => {
  if (!ages.value.second) return false;
  const age = parseInt(ages.value.second, 10);
  return !isNaN(age) && age >= 18 && age <= 100;
});

// Get age color based on gender (1 = female = pink, 0 = male = blue)
const getAgeColor = (gender: number | undefined) => {
  return gender === 1 ? 'rgb(255, 96, 223)' : 'rgb(58, 151, 254)';
};

const formatDistance = (km: number | undefined) => {
  if (!km) return '';
  return `${km} km`;
};

// Parse interests from summary_int
const parseInterests = (interests: string | undefined) => {
  if (!interests || interests.length < 6) {
    return {
      coupleMaleFemale: false,
      coupleFemaleFemale: false,
      coupleMaleMale: false,
      singleFemale: false,
      singleMale: false,
      transgender: false,
    };
  }
  
  const chars = interests.split('');
  return {
    coupleMaleFemale: chars[0] === '1',
    coupleFemaleFemale: chars[1] === '1',
    coupleMaleMale: chars[2] === '1',
    singleFemale: chars[3] === '1',
    singleMale: chars[4] === '1',
    transgender: chars[5] === '1',
  };
};

const receiverInterests = computed(() => {
  const interestsStr = receiver.value?.summary_int || '';
  return parseInterests(interestsStr);
});

// Get interests icons - only show couple icons if gender2 is real, otherwise filter them out
const receiverInterestsIcons = computed(() => {
  const icons: Array<{ type: string; url: string; width: number; height: number }> = [];
  
  if (isGender2Real.value && receiverInterests.value.coupleMaleFemale) {
    icons.push({
      type: 'couple',
      url: 'https://www.sdc.com/react/assets/couple_male_female_icon.a2db86e4.svg',
      width: 14,
      height: 20,
    });
  }
  
  if (!isGender2Real.value) {
    if (receiverInterests.value.singleFemale) {
      icons.push({
        type: 'single-female',
        url: 'https://www.sdc.com/react/assets/single_female_icon.e150c7be.svg',
        width: 24,
        height: 20,
      });
    }
    
    if (receiverInterests.value.singleMale) {
      icons.push({
        type: 'single-male',
        url: 'https://www.sdc.com/react/assets/single_male_icon.6eca46f8.svg',
        width: 20,
        height: 20,
      });
    }
  }
  
  return icons;
});

// Get blog post content - prefer extra_data.comment, fallback to body
const blogContent = computed(() => {
  // For action 100 (party announcements), use body with subject
  if (props.item.action === 100) {
    const subject = props.item.subject ? `<h3>${props.item.subject}</h3>` : '';
    return subject + (props.item.body || '');
  }
  // For action 18 & 38, don't show blog content (show group card instead)
  if (props.item.action === 18 || props.item.action === 38) {
    return '';
  }
  return extraData.value?.comment || props.item.body || '';
});

// Get group image URL for action 18
const groupImageUrl = computed(() => {
  if ((props.item.action === 18 || props.item.action === 38) && extraData.value?.picture) {
    return `https://pictures.sdc.com/group/logo/${extraData.value.picture}`;
  }
  return null;
});

// Get group category name
const groupCategory = computed(() => {
  return extraData.value?.category_name || '';
});

// Get group admin name
const groupAdmin = computed(() => {
  return extraData.value?.account_id || '';
});

// Get group description
const groupDescription = computed(() => {
  return extraData.value?.long_description || extraData.value?.short_description || '';
});

// Get group location
const groupLocation = computed(() => {
  return extraData.value?.location_comm || '';
});

// Get group member count
const groupMemberCount = computed(() => {
  return extraData.value?.total_members || 0;
});

// Get group creation date
const groupCreatedDate = computed(() => {
  return extraData.value?.account_since || '';
});

// Get group/club name
const groupName = computed(() => {
  // For action 18 & 38 (group joins), use extra_data.clubname
  if ((props.item.action === 18 || props.item.action === 38) && extraData.value?.clubname) {
    return extraData.value.clubname;
  }
  return extraData.value?.club_name || '';
});

// Get header text based on action type
const headerText = computed(() => {
  if (props.item.action === 100) {
    // Action 100: Party announcements from SDC staff (receiver is the staff account)
    const accountId = receiver.value?.account_id || sender.value?.account_id || 'SDC';
    return `${accountId} heeft een party aankondiging geplaatst`;
  }
  if (props.item.action === 18 || props.item.action === 38) {
    // Action 18 & 38: Group join - sender/receiver are the same (the user who joined)
    const accountId = sender.value?.account_id || receiver.value?.account_id || 'Iemand';
    return `${accountId} is lid geworden van ${groupName.value || 'een groep'}`;
  }
  // Action 300: Group/blog posts
  return `${receiver.value?.account_id || 'Iemand'} heeft ${groupName.value ? `in ${groupName.value}` : 'een bericht'} geplaatst`;
});
</script>

<template>
  <div :class="['newsfeed-card', `newsfeed-card-${props.index !== undefined && props.index % 2 === 0 ? 'even' : 'odd'}`]">
    <!-- Header -->
    <div :class="['newsfeed-card-header', { 'newsfeed-card-header-party': item.action === 100 }]">
      <div class="newsfeed-card-header-content">
        <p class="newsfeed-card-header-text">
          {{ headerText }}
        </p>
        <p class="newsfeed-card-header-time">{{ item.timed }}</p>
      </div>
    </div>

    <!-- Content -->
    <div class="newsfeed-card-content">
      <!-- Left: Profile Info -->
      <div class="newsfeed-card-section">
        <div class="newsfeed-card-profile">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            :alt="receiver?.account_id"
            class="newsfeed-card-profile-img"
          />
          <div v-else class="newsfeed-card-profile-placeholder">
            <span>{{ receiver?.account_id?.charAt(0) || '?' }}</span>
          </div>
          <div class="newsfeed-card-profile-info">
            <div class="newsfeed-card-profile-header">
              <p class="newsfeed-card-profile-name">{{ receiver?.account_id }}</p>
              <div class="newsfeed-card-device-icons">
                <img 
                  v-if="receiver?.is_web_user" 
                  src="https://www.sdc.com/react/assets/web_user_icon.d5f27f46.svg" 
                  alt="is-web-user" 
                  class="newsfeed-card-device-icon"
                  title="Web-gebruiker"
                />
                <img 
                  v-if="receiver?.is_app_user" 
                  src="https://www.sdc.com/react/assets/mobile_user_icon.07eafea0.svg" 
                  alt="is-app-user" 
                  class="newsfeed-card-device-icon"
                  title="App-gebruiker"
                />
                <img 
                  v-if="receiver?.speed" 
                  src="https://www.sdc.com/react/assets/speed_white.3176d40b.svg" 
                  alt="is-speed-date" 
                  class="newsfeed-card-device-icon"
                  title="Speed Date"
                />
                <img 
                  v-if="receiver?.online === 1" 
                  src="https://www.sdc.com/react/assets/messenger_online_icon.0a87dd19.svg" 
                  alt="user-is-online" 
                  class="newsfeed-card-device-icon"
                  title="Chat nu"
                />
              </div>
            </div>
            
            <!-- Age with colors -->
            <div v-if="ages.first || (ages.second && isGender2Real)" class="newsfeed-card-age">
              <span 
                v-if="ages.first" 
                class="newsfeed-card-age-first"
                :style="{ color: getAgeColor(receiver?.gender1) }"
              >
                {{ ages.first }}
              </span>
              <span v-if="ages.first && ages.second && isGender2Real" class="newsfeed-card-age-separator"> | </span>
              <span 
                v-if="ages.second && isGender2Real" 
                class="newsfeed-card-age-second"
                :style="{ color: getAgeColor(receiver?.gender2) }"
              >
                {{ ages.second }}
              </span>
            </div>

            <!-- Stats with icons -->
            <div class="newsfeed-card-profile-stats">
              <div v-if="receiver?.photo_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/photos_white_icon.1b15f7a9.svg" alt="Foto's" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.photo_count }}</span>
              </div>
              <div v-if="receiver?.video_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/videos_white_icon.67fc13b6.svg" alt="Video's" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.video_count }}</span>
              </div>
              <div v-if="receiver?.valid_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/validate_grid_card.d90f25d9.svg" alt="Validaties" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.valid_count }}</span>
              </div>
              <div v-if="receiver?.likes_count" class="newsfeed-card-stat">
                <img src="https://www.sdc.com/react/assets/like_grid_card.c46847a1.svg" alt="Likes" class="newsfeed-card-stat-icon" />
                <span>{{ receiver.likes_count }}</span>
              </div>
            </div>

            <!-- Interests -->
            <div v-if="receiverInterestsIcons.length > 0" class="newsfeed-card-interests">
              <p class="newsfeed-card-interests-label">Interesses</p>
              <div class="newsfeed-card-interests-icons">
                <img 
                  v-for="(icon, index) in receiverInterestsIcons" 
                  :key="index"
                  :src="icon.url" 
                  :alt="icon.type"
                  class="newsfeed-card-interests-icon"
                  :style="{ width: `${icon.width}px`, height: `${icon.height}px` }"
                />
              </div>
            </div>

            <!-- Location -->
            <div v-if="receiver?.location && receiver.location !== ', USA'" class="newsfeed-card-profile-location">
              <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-location-icon" />
              <span>{{ receiver.location }}</span>
              <span v-if="item.location_how_far" class="newsfeed-card-profile-location-distance">
                {{ formatDistance(item.location_how_far) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Blog Post Content or Group Card -->
      <div class="newsfeed-card-section">
        <!-- Group Card for action 18 & 38 -->
        <div v-if="item.action === 18 || item.action === 38" class="newsfeed-card-group-container">
          <div class="newsfeed-card-group-header">
            <img 
              v-if="groupImageUrl"
              :src="groupImageUrl"
              :alt="groupName"
              class="newsfeed-card-group-image"
            />
            <div v-else class="newsfeed-card-group-image-placeholder">
              <span>{{ groupName?.charAt(0) || 'G' }}</span>
            </div>
            <div class="newsfeed-card-group-header-info">
              <p class="newsfeed-card-group-category">{{ groupCategory }}</p>
              <p class="newsfeed-card-group-name-large">{{ groupName }}</p>
              <div v-if="groupLocation" class="newsfeed-card-group-location-row">
                <img src="https://www.sdc.com/react/assets/location_icon.8dcd803b.svg" alt="location" class="newsfeed-card-group-location-icon" />
                <span>{{ groupLocation }}</span>
              </div>
              <p v-if="groupAdmin" class="newsfeed-card-group-admin">
                door <span class="newsfeed-card-group-admin-name">{{ groupAdmin }}</span>
              </p>
            </div>
          </div>
          
          <div v-if="groupDescription" class="newsfeed-card-group-description">
            <p>{{ groupDescription }}</p>
          </div>
          
          <div class="newsfeed-card-group-footer">
            <div class="newsfeed-card-group-details">
              <span v-if="groupCreatedDate">{{ groupCreatedDate }}</span>
              <span v-if="groupCreatedDate && groupMemberCount > 0" class="newsfeed-card-group-separator"> | </span>
              <span v-if="groupMemberCount > 0">{{ groupMemberCount }} Leden</span>
            </div>
          </div>
          
          <!-- Group Icon Badge -->
          <div class="newsfeed-card-group-icon-badge">
            <img 
              src="https://www.sdc.com/react/assets/groups_blue_icon.56f59a0b.svg" 
              alt="group" 
              class="newsfeed-card-group-icon"
            />
          </div>
        </div>
        
        <!-- Blog Content for action 100 & 300 -->
        <div v-else :class="['newsfeed-card-blog-content', { 'newsfeed-card-blog-content-party': item.action === 100 }]">
          <!-- Action Type Badge -->
          <div v-if="item.action === 100 || item.action === 300" class="newsfeed-card-blog-badge">
            <span class="newsfeed-card-blog-badge-text">
              <span v-if="item.action === 100">🎉 Party Aankondiging</span>
              <span v-else-if="item.action === 300">📝 Blog</span>
            </span>
          </div>
          
          <div v-if="groupName && item.action === 300" class="newsfeed-card-blog-group">
            <span class="newsfeed-card-blog-group-label">Groep:</span>
            <span class="newsfeed-card-blog-group-name">{{ groupName }}</span>
          </div>
          <div 
            class="newsfeed-card-blog-text" 
            v-html="blogContent"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.newsfeed-card {
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid rgba(139, 92, 246, 0.4);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s ease;
  position: relative;
}

.newsfeed-card-even {
  background-color: rgba(255, 255, 255, 0.025);
}

.newsfeed-card-odd {
  background-color: rgba(255, 255, 255, 0.035);
}

.newsfeed-card:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  border-left-color: rgba(139, 92, 246, 0.6);
}

.newsfeed-card-header {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
}

.newsfeed-card-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.newsfeed-card-header-party {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%);
  border-bottom-color: rgba(139, 92, 246, 0.2);
}

.newsfeed-card-header-text {
  color: white;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  flex: 1;
  min-width: 0;
}

.newsfeed-card-header-party .newsfeed-card-header-text {
  color: #e9d5ff;
}

.newsfeed-card-header-time {
  color: #6b7280;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.newsfeed-card-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 12px 14px;
}

@media (min-width: 768px) {
  .newsfeed-card-content {
    grid-template-columns: 1fr 1fr;
  }
}

.newsfeed-card-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.newsfeed-card-profile {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.newsfeed-card-profile-img {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  border: 2px solid rgba(139, 92, 246, 0.6);
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.newsfeed-card-profile-placeholder {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%);
  border: 2px solid rgba(139, 92, 246, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.newsfeed-card-profile-placeholder span {
  color: #a78bfa;
  font-size: 20px;
  font-weight: 600;
}

.newsfeed-card-profile-info {
  flex: 1;
}

.newsfeed-card-profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.newsfeed-card-profile-name {
  color: white;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

.newsfeed-card-device-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
}

.newsfeed-card-device-icon {
  width: 14px;
  height: 14px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s ease;
}

.newsfeed-card-device-icon:hover {
  opacity: 1;
}

.newsfeed-card-age {
  font-size: 11px;
  margin-top: 4px;
}

.newsfeed-card-age-first {
  font-weight: 600;
}

.newsfeed-card-age-separator {
  color: rgba(255, 255, 255, 0.4);
  margin: 0 3px;
}

.newsfeed-card-age-second {
  font-weight: 600;
}

.newsfeed-card-profile-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.newsfeed-card-stat {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-stat-icon {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.newsfeed-card-interests {
  margin-top: 6px;
}

.newsfeed-card-interests-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.newsfeed-card-interests-icons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.newsfeed-card-interests-icon {
  display: inline-block;
  object-fit: contain;
  flex-shrink: 0;
}

.newsfeed-card-profile-location {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-location-icon {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.newsfeed-card-profile-location-distance {
  margin-left: 4px;
  color: #6b7280;
}

.newsfeed-card-blog-content {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.03) 100%);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 8px;
  padding: 14px;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

.newsfeed-card-blog-badge {
  display: inline-flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: 6px;
}

.newsfeed-card-blog-badge-text {
  font-size: 10px;
  color: #a78bfa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.newsfeed-card-blog-content::-webkit-scrollbar {
  width: 8px;
}

.newsfeed-card-blog-content::-webkit-scrollbar-track {
  background: rgba(139, 92, 246, 0.05);
  border-radius: 4px;
}

.newsfeed-card-blog-content::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(139, 92, 246, 0.1);
}

.newsfeed-card-blog-content::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.4);
}

.newsfeed-card-blog-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(139, 92, 246, 0.2);
}

.newsfeed-card-blog-group-label {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.newsfeed-card-blog-group-name {
  font-size: 12px;
  color: #a78bfa;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.newsfeed-card-blog-text {
  font-size: 11px;
  color: #e5e7eb;
  line-height: 1.7;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* Prevent images from overflowing */
.newsfeed-card-blog-text :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
}

.newsfeed-card-blog-text :deep(h1),
.newsfeed-card-blog-text :deep(h2),
.newsfeed-card-blog-text :deep(h3) {
  color: white;
  font-weight: 600;
  margin: 12px 0 8px 0;
  line-height: 1.4;
  letter-spacing: -0.01em;
}

.newsfeed-card-blog-text :deep(h1) {
  font-size: 16px;
}

.newsfeed-card-blog-text :deep(h2) {
  font-size: 14px;
}

.newsfeed-card-blog-text :deep(h3) {
  font-size: 13px;
}

.newsfeed-card-blog-text :deep(p) {
  margin: 0 0 10px 0;
  color: #e5e7eb;
  line-height: 1.7;
}

.newsfeed-card-blog-text :deep(p:last-child) {
  margin-bottom: 0;
}

.newsfeed-card-blog-text :deep(img) {
  max-width: 100%;
  max-height: 300px;
  width: auto;
  height: auto;
  border-radius: 8px;
  margin: 12px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  object-fit: contain;
  display: block;
}

/* For party announcements, make all images smaller */
.newsfeed-card-blog-content-party .newsfeed-card-blog-text :deep(img) {
  max-width: 280px !important;
  max-height: 280px !important;
  width: auto !important;
  height: auto !important;
  margin: 8px auto !important;
}

/* For party announcements (action 100), make images smaller and more contained */
.newsfeed-card-blog-text :deep(.img-swiper),
.newsfeed-card-blog-text :deep(.img-responsive),
.newsfeed-card-blog-text :deep(.swiper-lazy),
.newsfeed-card-blog-text :deep(.img-visible) {
  max-width: 280px !important;
  max-height: 280px !important;
  width: auto !important;
  height: auto !important;
  margin: 8px auto !important;
  display: block;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  object-fit: contain;
}

/* Ensure images inside links are also properly sized */
.newsfeed-card-blog-text :deep(a .img-swiper),
.newsfeed-card-blog-text :deep(a .img-responsive),
.newsfeed-card-blog-text :deep(a .swiper-lazy),
.newsfeed-card-blog-text :deep(a .img-visible) {
  max-width: 280px !important;
  max-height: 280px !important;
}

.newsfeed-card-blog-text :deep(a) {
  color: #a78bfa;
  text-decoration: underline;
  transition: color 0.2s ease;
}

.newsfeed-card-blog-text :deep(a:hover) {
  color: #c4b5fd;
}

.newsfeed-card-blog-text :deep(.ql-align-center) {
  text-align: center;
}

.newsfeed-card-blog-text :deep(.ql-align-center) {
  text-align: center;
}

.newsfeed-card-blog-text :deep(.ql-align-center img),
.newsfeed-card-blog-text :deep(.ql-align-center .img-swiper),
.newsfeed-card-blog-text :deep(.ql-align-center .img-responsive),
.newsfeed-card-blog-text :deep(.ql-align-center .swiper-lazy) {
  display: block;
  margin: 8px auto;
  max-width: 280px !important;
  max-height: 280px !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain;
}

/* Better styling for links containing images */
.newsfeed-card-blog-text :deep(a img) {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.newsfeed-card-blog-text :deep(a:hover img) {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

/* Group Card Styling for action 18 & 38 */
.newsfeed-card-group-container {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(139, 92, 246, 0.03) 100%);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 8px;
  padding: 12px;
  position: relative;
  min-height: 200px;
}

.newsfeed-card-group-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.newsfeed-card-group-image {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(139, 92, 246, 0.3);
}

.newsfeed-card-group-image-placeholder {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 2px solid rgba(139, 92, 246, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.newsfeed-card-group-image-placeholder span {
  color: #a78bfa;
  font-size: 24px;
  font-weight: 600;
}

.newsfeed-card-group-header-info {
  flex: 1;
  min-width: 0;
}

.newsfeed-card-group-category {
  font-size: 10px;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 4px 0;
}

.newsfeed-card-group-name-large {
  font-size: 13px;
  color: white;
  font-weight: 600;
  margin: 0 0 6px 0;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.newsfeed-card-group-location-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 10px;
  color: #9ca3af;
}

.newsfeed-card-group-location-icon {
  width: 12px;
  height: 12px;
  opacity: 0.7;
}

.newsfeed-card-group-admin {
  font-size: 10px;
  color: #9ca3af;
  margin: 0;
}

.newsfeed-card-group-description {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.newsfeed-card-group-description p {
  font-size: 11px;
  color: #d1d5db;
  line-height: 1.6;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.newsfeed-card-group-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.newsfeed-card-group-details {
  font-size: 10px;
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 4px;
}

.newsfeed-card-group-separator {
  color: #6b7280;
}

.newsfeed-card-group-icon-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 5px;
  border: 1px solid rgba(139, 92, 246, 0.2);
}

.newsfeed-card-group-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}
</style>
