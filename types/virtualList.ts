// Siyahidaki her bir elementin strukturu
export interface FeedItem {
  id: string;
  title: string;
  category: string;
  content: string;
  author: string;
  timestamp: string;
  likes: number;
}

// Olculmus hundurluk ve ofsetlerin struktur interfeysi
export interface RowMeasurement {
  index: number;
  height: number;
  offset: number;
}