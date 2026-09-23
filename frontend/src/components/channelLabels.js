const categories = {
  gaming: "เกม",
  singing: "ร้องเพลง",
  chatting: "พูดคุย",
  art: "วาดรูป",
  asmr: "ASMR",
  education: "ความรู้",
  other: "อื่นๆ",
};

const affiliations = {
  indie: "อิสระ",
  agency: "สังกัด",
};

export const categoryLabel = (value) => categories[value] ?? "อื่นๆ";
export const affiliationLabel = (value) => affiliations[value] ?? "ไม่ระบุสังกัด";
