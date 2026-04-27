export interface ItemDefinition {
  id: string;
  name: string;
  sub: string;
  sizes: string[];
}

export const ITEMS: ItemDefinition[] = [
  {
    id: "jumper_spring",
    name: "점퍼",
    sub: "춘추",
    sizes: [
      "90(S)",
      "95(M)",
      "100(L)",
      "105(XL)",
      "110(2XL)",
      "115(3XL)",
      "120(4XL)",
      "125(5XL)",
    ],
  },
  {
    id: "jumper_winter",
    name: "점퍼",
    sub: "동계",
    sizes: ["90(M)", "95(L)", "100(XL)", "105(2XL)", "110(3XL)", "115(4XL)", "115(5XL)"],
  },
  {
    id: "tshirt_short",
    name: "티셔츠(근무복)",
    sub: "반팔",
    sizes: ["85(S)", "90(M)", "95(L)", "100(XL)", "105(2XL)", "110(3XL)", "115(4XL)", "120(5XL)", "125(6XL)"],
  },
  {
    id: "tshirt_long",
    name: "티셔츠(근무복)",
    sub: "긴팔",
    sizes: ["85(S)", "90(M)", "95(L)", "100(XL)", "105(2XL)", "110(3XL)", "115(4XL)", "120(5XL)", "125(6XL)"],
  },
  {
    id: "work_spring",
    name: "근무복",
    sub: "춘추",
    sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44"],
  },
  {
    id: "safety_office",
    name: "안전화",
    sub: "사무직·연마",
    sizes: ["235", "240", "245", "250", "255", "260", "265", "270", "275", "280", "285", "290"],
  },
  {
    id: "safety_work",
    name: "안전화",
    sub: "가공(하이퍼)",
    sizes: ["240", "245", "250", "255", "260", "265", "270", "275", "280", "285", "290"],
  },
];
