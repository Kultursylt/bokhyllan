// Texter och listor som flera vyer delar.

export const CATEGORIES = [
  "Skönlitteratur", "Deckare & spänning", "Poesi & dramatik", "Barn & unga", "Serier",
  "Biografier & memoarer", "Historia", "Samhälle & politik", "Filosofi & religion",
  "Psykologi", "Naturvetenskap", "Teknik & data", "Konst, design & foto", "Musik & film",
  "Mat & dryck", "Resor & geografi", "Språk & ordböcker", "Ekonomi & företag",
  "Hälsa & träning", "Hus, hem & trädgård", "Kurslitteratur", "Uppslagsverk", "Övrigt",
];

export const STATUS = {
  shelf: "På plats",
  lent: "Utlånad",
  away: "Okänd plats",
  sold: "Såld",
  gone: "Borta",
};

export const KIND = { room: "Rum", bookcase: "Bokhylla", shelf: "Hyllplan", spot: "Lös plats" };

export const SOURCE = {
  libris: "Libris",
  openlibrary: "Open Library",
  manual: "Inlagd för hand",
  ai: "Avläst, ej verifierad",
};

export const authorsText = (w) => (w?.authors ?? []).join(", ");
