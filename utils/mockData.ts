import { FeedItem } from '../types/virtualList';

const CATEGORIES = ['Engineering', 'Design', 'Product', 'AI & Data', 'Culture'];
const AUTHORS = ['Alex Mercer', 'Samaya Guliyeva', 'Jordan Lee', 'Elena Rostova', 'David Chen'];

const PARAGRAPHS = [
  'Virtualization limits DOM nodes to keep 60fps performance.',
  'Dynamic heights require measuring rendered nodes via ResizeObserver and maintaining a cumulative offset array for precise scroll translation.',
  'By combining binary search for visible bounds with a measured height cache, we eliminate layout thrashing and stutter even with 10,000+ complex feed items.',
  'Infinite scrolling uses an IntersectionObserver sentinel to load paginated data chunks smoothly as the user approaches the bottom of the feed container.',
  'Custom virtualized rendering without libraries provides complete frontend control over layout, keyboard navigation, and memory optimization.',
];

// Dinamik uzunluqlu metne malik mock elementler yaradan funksiya
export function generateMockItems(startIndex: number, count: number): FeedItem[] {
  return Array.from({ length: count }, (_, i) => {
    const idIndex = startIndex + i + 1;
    // Dinamik hundurluk yaratmaq ucun tesadufi sayda paraqraf birlesdirilir
    const textLength = (idIndex % 4) + 1;
    const content = Array.from({ length: textLength }, (_, pIdx) => PARAGRAPHS[(idIndex + pIdx) % PARAGRAPHS.length]).join(' ');

    return {
      id: `item-${idIndex}`,
      title: `Article #${idIndex}: High-Performance Rendering in React`,
      category: CATEGORIES[idIndex % CATEGORIES.length],
      content,
      author: AUTHORS[idIndex % AUTHORS.length],
      timestamp: `${(idIndex % 12) + 1}h ago`,
      likes: (idIndex * 42) % 999,
    };
  });
}