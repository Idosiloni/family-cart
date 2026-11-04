// One consistent line-icon set (24px grid, 1.9 stroke, round caps). Static markup only.
const NS = "http://www.w3.org/2000/svg";

const PATHS = {
  produce: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14Z"/><path d="M5 19 13 11"/>',
  bakery: '<path d="M5 11a4 4 0 0 1 3-3.6h8A4 4 0 0 1 19 11c0 1.2-.7 2-1.5 2.4V19a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5.6C5.700 13 5 12.200 5 11Z"/><path d="m9.500 10 1.400 2M13.500 10l1.400 2"/>',
  dairy: '<path d="M8 3h8l2 4v14H6V7l2-4Z"/><path d="M6 7h12"/>',
  meat: '<path d="M15 4.500a4.500 4.500 0 0 1 4.500 4.500c0 2.500-2 4-4 4.500l-3 3-2.500-2.500 3-3C12.500 10.300 12 8.500 12.800 7 13.500 5.500 14 4.800 15 4.500Z"/><path d="m9.500 15.500-4 3.500M5.500 15.500l3.500 3.500"/>',
  pantry: '<rect x="6" y="8" width="12" height="13" rx="2.500"/><path d="M7.500 4h9v4h-9z"/>',
  snacks: '<rect x="8" y="8" width="8" height="8" rx="3"/><path d="m8 12-4-3v6l4-3ZM16 12l4-3v6l-4-3Z"/>',
  drinks: '<path d="M6 6h12l-1.600 14H7.600L6 6Z"/><path d="M9 2.500 12 6"/>',
  frozen: '<path d="M12 3v18M4.200 7.500l15.600 9M19.800 7.500 4.200 16.500"/><path d="m9.500 4.800 2.500 2 2.500-2M9.500 19.200l2.500-2 2.500 2"/>',
  cleaning: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z"/>',
  hygiene: '<path d="M9 3h6v3H9z"/><rect x="7" y="6" width="10" height="15" rx="2.500"/><path d="M10 12h4"/>',
  baby: '<path d="M12 20s-7-4.300-7-10a4 4 0 0 1 7-2.500A4 4 0 0 1 19 10c0 5.700-7 10-7 10Z"/>',
  other: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  edit: '<path d="M4 20h4L19 9a2.100 2.100 0 0 0-3-3L5 17l-1 3Z"/><path d="m14.500 7.500 3 3"/>',
  deli: '<path d="M3 18V9l18 2v7Z"/><path d="M3 9 14 5l7 6"/><circle cx="8" cy="14" r="1.300"/><circle cx="15" cy="15" r="1"/>',
  fish: '<path d="M3 12c2.500-4 6-5.500 10-4.500 2 .5 3.500 2 4.500 4.500-1 2.500-2.500 4-4.500 4.500-4 1-7.500-.5-10-4.500Z"/><path d="M17.500 12 22 8v8Z"/><circle cx="8" cy="11" r=".9"/>',
  canned: '<ellipse cx="12" cy="6" rx="6" ry="2.500"/><path d="M6 6v12c0 1.400 2.700 2.500 6 2.500s6-1.100 6-2.500V6"/><path d="M6 12c0 1.400 2.700 2.500 6 2.500s6-1.100 6-2.500"/>',
  spices: '<path d="M10 3h4v4h-4Z"/><path d="M8 7h8l1 3H7Z"/><path d="M7 10v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v3M12 3v3"/>',
  alcohol: '<path d="M7 3h10l-1 7a4 4 0 0 1-8 0Z"/><path d="M12 14v7M8 21h8"/>',
  disposable: '<path d="M6 4h12l-1.500 16h-9Z"/><path d="M6.500 9h11"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.600 13.500l6.800 4M15.400 6.500l-6.800 4"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.400 0 2-1 1.600-2.200-.4-1.300.4-2.300 1.700-2.300H17a4 4 0 0 0 4-4C21 6.700 17 3 12 3Z"/><circle cx="7.500" cy="11" r="1"/><circle cx="10" cy="7.500" r="1"/><circle cx="14.500" cy="7.500" r="1"/>',
  route: '<circle cx="6" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.500 6H15a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6.500"/>',
  cart: '<path d="M3 4h2.500l2 11h10l2-8H7"/><circle cx="9" cy="19.500" r="1.400"/><circle cx="17" cy="19.500" r="1.400"/>',
  check: '<path d="m5 12.500 5 5L19 7"/>',
  dots: '<circle cx="5" cy="12" r="1.600"/><circle cx="12" cy="12" r="1.600"/><circle cx="19" cy="12" r="1.600"/>',
  star: '<path d="m12 3.500 2.700 5.500 6 .9-4.400 4.200 1 6-5.300-2.800-5.300 2.800 1-6L3.300 9.900l6-.9Z"/>',
  phone: '<rect x="7" y="2.500" width="10" height="19" rx="2.500"/><path d="M11 18.500h2"/>',
};

const cache = new Map();

export function icon(name, size = 22) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", name === "check" ? "3" : "1.9");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (!cache.has(name)) {
    const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${PATHS[name] || PATHS.other}</svg>`, "image/svg+xml");
    cache.set(name, [...doc.documentElement.childNodes]);
  }
  for (const n of cache.get(name)) svg.append(document.importNode(n, true));
  return svg;
}
