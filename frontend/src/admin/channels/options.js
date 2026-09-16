export const blank = {
  name: "",
  slug: "",
  bio: "",
  avatar: "",
  agency_name: "",
  agency_id: null,
  country: "Thailand",
  debut_date: "",
  banner_url: "",
  youtube_url: "",
  twitch_url: "",
  x_url: "",
  category: "other",
  affiliation: "indie",
  channel_url: "",
  platform: "youtube",
  is_active: true,
  notes: "",
};
export const platforms = [
  ["youtube", "YouTube"],
  ["twitch", "Twitch"],
  ["bilibili", "Bilibili"],
  ["other", "อื่นๆ"],
];
export const categories = [
  ["gaming", "เกม"],
  ["singing", "ร้องเพลง"],
  ["chatting", "พูดคุย"],
  ["art", "วาดรูป"],
  ["asmr", "ASMR"],
  ["education", "ความรู้"],
  ["other", "อื่นๆ"],
];
export const affiliations = [
  ["indie", "อิสระ"],
  ["agency", "สังกัด"],
];
// ฟิลด์ที่ API ยอมรับสำหรับ POST/PUT /vtubers (ตรงกับ channelFields ฝั่ง server)
export const channelFields = Object.keys(blank);
