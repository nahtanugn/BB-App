export const awardHandbookSource = "BB Malaysia Senior Member's Handbook · Aug 2024";

export type AwardBadgeRegion =
  | "right_arm"
  | "left_arm_special"
  | "left_arm_service"
  | "left_breast"
  | "medal";

export type AwardBadgeMetadata = {
  side: "left" | "right";
  order: number;
  group: "target" | "proficiency" | "service" | "special";
  source: string;
  artwork_key: string | null;
  artwork_src: string | null;
  artwork_source: string | null;
  region: AwardBadgeRegion;
  row_group: string;
  display_order: number;
  advanced_backing: boolean;
};

const availableArtwork = new Set([
  "arts",
  "athletics",
  "bandsman",
  "bugler",
  "camping",
  "christian_education",
  "citizenship",
  "communication",
  "community_service",
  "computer_knowledge",
  "crafts",
  "cross_of_heroism",
  "drill",
  "drummer",
  "duke_of_edinburgh_bronze",
  "duke_of_edinburgh_gold",
  "duke_of_edinburgh_silver",
  "environmental_conservation",
  "expedition",
  "financial_stewardship",
  "fire_rescue",
  "first_aid",
  "founders_award",
  "gallant_conduct",
  "gold_award",
  "gymnastics",
  "hobbies",
  "international_relations",
  "life_saving",
  "martial_arts",
  "link_badge",
  "junior_service_award",
  "long_year_service",
  "nature_awareness",
  "nco_proficiency",
  "one_year_service",
  "physical_training",
  "piper",
  "presidents_award",
  "recruitment",
  "safety",
  "scholastics_bronze",
  "scholastics_gold",
  "scholastics_silver",
  "social_entrepreneurship",
  "sports",
  "sustainability",
  "swimming",
  "target",
  "three_year_service",
  "water_adventure",
]);

const artworkSources: Record<string, string> = {
  citizenship: "User-provided badge artwork",
  cross_of_heroism: "https://www.sallybosleysbadgeshop.com/shop.php?code=63403",
  duke_of_edinburgh_gold: "https://doemalaysia.org/programmes/dofe",
  duke_of_edinburgh_silver: "https://doemalaysia.org/programmes/dofe",
  gold_award: "https://bbmalaysia.org/achievements/",
  link_badge: "BB Malaysia Senior Member's Handbook · Aug 2024",
  junior_service_award: "User-provided Junior service badge artwork",
};

const rightArmOrder = [
  "target",
  "arts",
  "athletics",
  "bandsman",
  "bugler",
  "camping",
  "christian_education",
  "citizenship",
  "communication",
  "community_service",
  "computer_knowledge",
  "crafts",
  "drill",
  "drummer",
  "environmental_conservation",
  "expedition",
  "financial_stewardship",
  "fire_rescue",
  "first_aid",
  "gymnastics",
  "hobbies",
  "international_relations",
  "life_saving",
  "martial_arts",
  "nature_awareness",
  "physical_training",
  "piper",
  "recruitment",
  "safety",
  "social_entrepreneurship",
  "sports",
  "sustainability",
  "swimming",
  "water_adventure",
];

const artwork = (code: string) => availableArtwork.has(code) ? code : null;
const metadata = (
  code: string,
  region: AwardBadgeRegion,
  rowGroup: string,
  displayOrder: number,
  group: AwardBadgeMetadata["group"],
): AwardBadgeMetadata => {
  const artworkKey = artwork(code);
  return {
    side: region === "right_arm" ? "right" : "left",
    order: displayOrder,
    group,
    source: awardHandbookSource,
    artwork_key: artworkKey,
    artwork_src: artworkKey
      ? `/award-badges/${artworkKey}.${["athletics", "citizenship", "martial_arts", "gallant_conduct", "junior_service_award"].includes(artworkKey) ? "png" : "webp"}`
      : null,
    artwork_source: artworkKey ? artworkSources[code] ?? null : null,
    region,
    row_group: rowGroup,
    display_order: displayOrder,
    advanced_backing: region === "right_arm" && code !== "target",
  };
};

export const awardBadgeMetadata: Record<string, AwardBadgeMetadata> = Object.fromEntries([
  ...rightArmOrder.map((code, index) => [
    code,
    metadata(code, "right_arm", "proficiency", index, code === "target" ? "target" : "proficiency"),
  ]),
  ["founders_award", metadata("founders_award", "left_arm_special", "special_top", 0, "special")],
  ["presidents_award", metadata("presidents_award", "left_arm_special", "president_doe_gold", 10, "special")],
  ["gold_award", metadata("gold_award", "left_arm_special", "president_doe_gold", 11, "special")],
  ["duke_of_edinburgh_bronze", metadata("duke_of_edinburgh_bronze", "left_arm_special", "president_doe_gold", 12, "special")],
  ["duke_of_edinburgh_silver", metadata("duke_of_edinburgh_silver", "left_arm_special", "president_doe_gold", 12, "special")],
  ["duke_of_edinburgh_gold", metadata("duke_of_edinburgh_gold", "left_arm_special", "president_doe_gold", 12, "special")],
  ["scholastics_gold", metadata("scholastics_gold", "left_arm_special", "scholastic", 20, "special")],
  ["scholastics_silver", metadata("scholastics_silver", "left_arm_special", "scholastic", 21, "special")],
  ["scholastics_bronze", metadata("scholastics_bronze", "left_arm_special", "scholastic", 22, "special")],
  ["long_year_service", metadata("long_year_service", "left_arm_service", "nco_service", 30, "service")],
  ["nco_proficiency", metadata("nco_proficiency", "left_arm_special", "nco_service", 31, "special")],
  ["three_year_service", metadata("three_year_service", "left_arm_service", "nco_service", 32, "service")],
  ["one_year_service", metadata("one_year_service", "left_arm_service", "service_lower", 40, "service")],
  ["link_badge", metadata("link_badge", "left_arm_special", "special_row", 31, "special")],
  ["junior_service_award", metadata("junior_service_award", "left_arm_special", "special_row", 32, "special")],
  ["cross_of_heroism", metadata("cross_of_heroism", "medal", "medal", 60, "special")],
  ["gallant_conduct", metadata("gallant_conduct", "medal", "medal", 61, "special")],
]);
